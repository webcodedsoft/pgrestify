/**
 * JWT Authentication manager for PostgREST
 */

import { 
  isTokenExpired, 
  DEFAULT_AUTH_CONFIG,
  AuthState,
  STORAGE_KEYS 
} from '../types/auth';
import { AuthError } from '../types/errors';
import type {
  AuthManager,
  AuthStorage,
  HttpClient,
} from '../types';
import type {
  AuthSession,
  User,
  SignInCredentials,
  SignUpCredentials,
  AuthResponse,
  AuthResult,
  AuthChangeEvent,
  AuthStateChangeCallback,
  UnsubscribeFunction,
  AuthConfig,
  ResetPasswordCredentials,
  UpdateUserCredentials,
} from '../types/auth';

/**
 * JWT-based authentication manager
 */
export class JWTAuthManager implements AuthManager {
  private session: AuthSession | null = null;
  private user: User | null = null;
  private authState: AuthState = AuthState.SIGNED_OUT;
  private readonly listeners = new Set<AuthStateChangeCallback>();
  private refreshPromise: Promise<AuthSession | null> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: AuthConfig;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly storage: AuthStorage,
    config?: Partial<AuthConfig>
  ) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    
    // Initialize session from storage
    this.initializeFromStorage();
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
    try {
      this.setAuthState(AuthState.SIGNING_IN);

      const response = await this.httpClient.post<AuthResponse>('/auth/v1/token', {
        grant_type: 'password',
        email: credentials.email,
        password: credentials.password,
        ...credentials.options,
      });

      if (response.data.data.session) {
        await this.setSession(response.data.data.session);
        this.setAuthState(AuthState.SIGNED_IN);
        
        this.notifyAuthChange({
          event: 'SIGNED_IN',
          session: this.session,
        });

        return {
          data: response.data.data,
          error: null,
        };
      }

      this.setAuthState(AuthState.SIGNED_OUT);
      return {
        data: { user: null, session: null },
        error: { message: 'Failed to sign in', status: 400 },
      };

    } catch (error) {
      this.setAuthState(AuthState.SIGNED_OUT);
      
      return {
        data: { user: null, session: null },
        error: {
          message: error instanceof Error ? error.message : 'Sign in failed',
          status: (error as any)?.statusCode || 400,
        },
      };
    }
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResult> {
    try {
      const response = await this.httpClient.post<AuthResponse>('/auth/v1/signup', {
        email: credentials.email,
        password: credentials.password,
        phone: credentials.phone,
        data: credentials.options?.data,
      });

      // Sign up might not immediately return a session (email confirmation required)
      if (response.data.data.session) {
        await this.setSession(response.data.data.session);
        this.setAuthState(AuthState.SIGNED_IN);
      }

      return {
        data: response.data.data,
        error: null,
      };

    } catch (error) {
      return {
        data: { user: null, session: null },
        error: {
          message: error instanceof Error ? error.message : 'Sign up failed',
          status: (error as any)?.statusCode || 400,
        },
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      this.setAuthState(AuthState.SIGNING_OUT);

      // Call logout endpoint if we have a session
      if (this.session?.refresh_token) {
        try {
          await this.httpClient.post('/auth/v1/logout', {
            token: this.session.refresh_token,
          });
        } catch {
          // Ignore logout errors
        }
      }

      await this.clearSession();
      this.setAuthState(AuthState.SIGNED_OUT);

      this.notifyAuthChange({
        event: 'SIGNED_OUT',
        session: null,
      });

    } catch (error) {
      // Even if logout fails, clear local session
      await this.clearSession();
      this.setAuthState(AuthState.SIGNED_OUT);
      throw new AuthError('Sign out failed', error);
    }
  }

  async resetPassword(credentials: ResetPasswordCredentials): Promise<AuthResult> {
    try {
      await this.httpClient.post('/auth/v1/recover', {
        email: credentials.email,
        ...credentials.options,
      });

      return {
        data: { user: null, session: null },
        error: null,
      };

    } catch (error) {
      return {
        data: { user: null, session: null },
        error: {
          message: error instanceof Error ? error.message : 'Password reset failed',
          status: (error as any)?.statusCode || 400,
        },
      };
    }
  }

  async updateUser(credentials: UpdateUserCredentials): Promise<AuthResult> {
    if (!this.session) {
      return {
        data: { user: null, session: null },
        error: { message: 'Not authenticated', status: 401 },
      };
    }

    try {
      const response = await this.httpClient.put<AuthResponse>('/auth/v1/user', credentials, {
        Authorization: `Bearer ${this.session.access_token}`,
      });

      if (response.data.data.user) {
        this.user = response.data.data.user;
        
        // Update session if provided
        if (response.data.data.session) {
          await this.setSession(response.data.data.session);
        }

        this.notifyAuthChange({
          event: 'USER_UPDATED',
          session: this.session,
        });
      }

      return {
        data: response.data.data,
        error: null,
      };

    } catch (error) {
      return {
        data: { user: null, session: null },
        error: {
          message: error instanceof Error ? error.message : 'User update failed',
          status: (error as any)?.statusCode || 400,
        },
      };
    }
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  getUser(): User | null {
    return this.user;
  }

  getAuthState(): AuthState {
    return this.authState;
  }

  async refreshSession(): Promise<AuthSession | null> {
    if (!this.session?.refresh_token) {
      return null;
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const newSession = await this.refreshPromise;
      this.refreshPromise = null;
      return newSession;
    } catch (error) {
      this.refreshPromise = null;
      
      // If refresh fails, sign out the user
      await this.signOut();
      throw error;
    }
  }

  onAuthStateChange(callback: AuthStateChangeCallback): UnsubscribeFunction {
    this.listeners.add(callback);
    
    // Immediately call with current state
    if (this.session) {
      callback({
        event: 'SIGNED_IN',
        session: this.session,
      });
    }
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  async getHeaders(): Promise<Record<string, string>> {
    const session = await this.getValidSession();
    
    if (!session) {
      return {};
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  private async getValidSession(): Promise<AuthSession | null> {
    if (!this.session) {
      return null;
    }

    // Check if token needs refresh
    if (isTokenExpired(this.session.access_token, this.config.refresh?.expiryMargin)) {
      return this.refreshSession();
    }

    return this.session;
  }

  private async performRefresh(): Promise<AuthSession | null> {
    if (!this.session?.refresh_token) {
      return null;
    }

    this.setAuthState(AuthState.TOKEN_REFRESHING);

    try {
      const response = await this.httpClient.post<AuthResponse>('/auth/v1/token', {
        grant_type: 'refresh_token',
        refresh_token: this.session.refresh_token,
      });

      if (response.data.data.session) {
        await this.setSession(response.data.data.session);
        this.setAuthState(AuthState.SIGNED_IN);

        this.notifyAuthChange({
          event: 'TOKEN_REFRESHED',
          session: this.session,
        });

        return this.session;
      }

      throw new AuthError('No session in refresh response');

    } catch (error) {
      await this.clearSession();
      this.setAuthState(AuthState.SIGNED_OUT);
      throw new AuthError('Failed to refresh token', error);
    }
  }

  private async setSession(session: AuthSession): Promise<void> {
    this.session = session;
    this.user = session.user;

    // Calculate expires_at if not provided
    if (!session.expires_at && session.expires_in) {
      session.expires_at = Date.now() + (session.expires_in * 1000);
    }

    // Persist session if enabled
    if (this.config.persistSession) {
      await this.storage.setItem(
        STORAGE_KEYS.ACCESS_TOKEN, 
        session.access_token
      );
      
      if (session.refresh_token) {
        await this.storage.setItem(
          STORAGE_KEYS.REFRESH_TOKEN, 
          session.refresh_token
        );
      }
      
      await this.storage.setItem(
        STORAGE_KEYS.USER, 
        JSON.stringify(session.user)
      );
      
      await this.storage.setItem(
        STORAGE_KEYS.EXPIRES_AT, 
        String(session.expires_at)
      );
    }

    // Set up automatic refresh
    this.scheduleTokenRefresh();
  }

  private async clearSession(): Promise<void> {
    this.session = null;
    this.user = null;

    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null as unknown as ReturnType<typeof setTimeout>;
    }

    // Clear storage
    if (this.config.persistSession) {
      await Promise.all([
        this.storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
        this.storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
        this.storage.removeItem(STORAGE_KEYS.USER),
        this.storage.removeItem(STORAGE_KEYS.EXPIRES_AT),
      ]);
    }
  }

  private async initializeFromStorage(): Promise<void> {
    if (!this.config.persistSession) {
      return;
    }

    try {
      const [accessToken, refreshToken, userJson, expiresAtStr] = await Promise.all([
        this.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        this.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        this.storage.getItem(STORAGE_KEYS.USER),
        this.storage.getItem(STORAGE_KEYS.EXPIRES_AT),
      ]);

      if (accessToken && userJson) {
        const user = JSON.parse(userJson) as User;
        const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;

        // Check if token is still valid
        if (!expiresAt || Date.now() < expiresAt) {
          const session: AuthSession = {
            access_token: accessToken,
            refresh_token: refreshToken || undefined,
            expires_in: expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : 3600,
            expires_at: expiresAt || Date.now() + 3600000,
            token_type: 'bearer',
            user,
          };

          this.session = session;
          this.user = user;
          this.setAuthState(AuthState.SIGNED_IN);
          this.scheduleTokenRefresh();
        } else {
          // Token expired, clear storage
          await this.clearSession();
        }
      }
    } catch {
      // Ignore initialization errors
      await this.clearSession();
    }
  }

  private scheduleTokenRefresh(): void {
    if (!this.config.autoRefreshToken || !this.session) {
      return;
    }

    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const expiresAt = this.session.expires_at;
    const refreshMargin = (this.config.refresh?.expiryMargin || 60) * 1000;
    const refreshTime = expiresAt - refreshMargin - Date.now();

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshSession().catch(() => {
          // Refresh failed, user will be signed out
        });
      }, refreshTime);
    }
  }

  private setAuthState(state: AuthState): void {
    this.authState = state;
  }

  private notifyAuthChange(event: AuthChangeEvent): void {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch {
        // Ignore listener errors
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null as unknown as ReturnType<typeof setTimeout>;
    }
    
    this.listeners.clear();
  }
}