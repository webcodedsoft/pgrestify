/**
 * PostgREST Authentication Module
 * 
 * Implements PostgREST's database-centered security model:
 * - All authorization happens in the database
 * - PostgREST authenticates requests (verify identity)
 * - Database authorizes actions (what they can do)
 * - Three role system: authenticator, anonymous, and user roles
 */

import type {
  AuthManager,
  AuthStorage,
  SignInCredentials,
  SignUpCredentials,
  AuthResult,
  AuthSession,
  User,
  AuthStateChangeCallback,
  UnsubscribeFunction,
  HttpClient,
} from '../types';
import type { AuthConfig } from '../types/auth';

/**
 * PostgREST Role System
 * Based on official PostgREST documentation
 */
export enum PostgRESTRole {
  /**
   * Authenticator role - used by PostgREST to connect to database
   * This role can switch to other roles based on JWT claims
   */
  AUTHENTICATOR = 'authenticator',
  
  /**
   * Anonymous role - for unauthenticated requests
   * Limited permissions, typically read-only on public data
   */
  ANONYMOUS = 'anonymous',
  
  /**
   * User role - for authenticated users
   * Standard user permissions based on row-level security policies
   */
  USER = 'user',
  
  /**
   * Admin role - for administrative users
   * Elevated permissions for management operations
   */
  ADMIN = 'admin',
}

/**
 * JWT payload structure for PostgREST
 */
export interface PostgRESTJWTPayload {
  /** User role (anonymous, user, admin) */
  role: string;
  
  /** User ID */
  user_id?: string | number;
  
  /** Email address */
  email?: string | undefined;
  
  /** Username */
  username?: string;
  
  /** Expiration time */
  exp: number;
  
  /** Issued at time */
  iat: number;
  
  /** Additional custom claims */
  [key: string]: unknown;
}

/**
 * Database-centered authentication manager for PostgREST
 * 
 * This implementation follows PostgREST's principle that "all authorization 
 * happens in the database" by focusing on JWT token management and role 
 * switching while letting the database handle all permission checks.
 */
export class PostgRESTAuthManager implements AuthManager {
  private currentSession: AuthSession | null = null;
  private currentUser: User | null = null;
  private readonly authStateCallbacks = new Set<AuthStateChangeCallback>();
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly storage: AuthStorage,
    private readonly config: AuthConfig = {}
  ) {
    this.initializeSession();
  }

  /**
   * Authenticate user and get JWT token
   * The JWT contains role information that PostgREST uses for database authorization
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
    try {
      const response = await this.httpClient.post<{
        access_token: string;
        refresh_token?: string;
        user: User;
        expires_in?: number;
      }>('/auth/token', {
        email: credentials.email,
        password: credentials.password,
      });

      if (!response.data.access_token) {
        throw new Error('No access token received');
      }

      const { access_token, refresh_token, user, expires_in } = response.data;
      
      // Decode JWT to get role information
      const payload = this.decodeJWT(access_token);
      
      const session: AuthSession = {
        access_token,
        refresh_token: refresh_token || undefined,
        expires_in: expires_in || 3600,
        expires_at: Date.now() + (expires_in || 3600) * 1000,
        user: {
          ...user,
          role: payload.role || PostgRESTRole.USER, // Default to user role
        },
        token_type: 'bearer',
      };

      await this.setSession(session);

      return {
        data: { user: session.user, session },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error instanceof Error ? error : new Error('Authentication failed'),
      };
    }
  }

  /**
   * Register new user
   * Note: Registration typically creates a user with 'user' role by default
   */
  async signUp(credentials: SignUpCredentials): Promise<AuthResult> {
    try {
      const response = await this.httpClient.post<{
        access_token?: string;
        refresh_token?: string;
        user: User;
        message?: string;
      }>('/auth/register', {
        email: credentials.email,
        password: credentials.password,
        ...credentials.data,
      });

      const { access_token, refresh_token, user } = response.data;

      // Some implementations require email confirmation
      if (!access_token) {
        return {
          data: { user, session: null },
          error: null,
        };
      }

      const payload = this.decodeJWT(access_token);
      
      const session: AuthSession = {
        access_token,
        refresh_token: refresh_token || undefined,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
        user: {
          ...user,
          role: payload.role || PostgRESTRole.USER,
        } as User,
        token_type: 'bearer',
      };

      await this.setSession(session);

      return {
        data: { user: session.user, session },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error instanceof Error ? error : new Error('Registration failed'),
      };
    }
  }

  /**
   * Sign out user and clear session
   * Switches back to anonymous role
   */
  async signOut(): Promise<void> {
    if (this.currentSession?.refresh_token) {
      try {
        await this.httpClient.post('/auth/logout', {
          refresh_token: this.currentSession.refresh_token,
        });
      } catch {
        // Ignore logout errors - continue with local cleanup
      }
    }

    await this.clearSession();
  }

  /**
   * Get current session
   */
  getSession(): AuthSession | null {
    return this.currentSession;
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.currentUser;
  }

  /**
   * Refresh the JWT token
   * This is important for maintaining authentication state
   */
  async refreshSession(): Promise<AuthSession | null> {
    if (!this.currentSession?.refresh_token) {
      return null;
    }

    try {
      const response = await this.httpClient.post<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      }>('/auth/refresh', {
        refresh_token: this.currentSession.refresh_token,
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const payload = this.decodeJWT(access_token);

      const newSession: AuthSession = {
        ...this.currentSession,
        access_token,
        refresh_token: refresh_token || this.currentSession.refresh_token,
        expires_in: expires_in || 3600,
        expires_at: Date.now() + (expires_in || 3600) * 1000,
        user: {
          ...this.currentSession.user,
          role: payload.role || this.currentSession.user.role,
        } as User,
      };

      await this.setSession(newSession);
      return newSession;
    } catch (error) {
      // Refresh failed, clear session
      await this.clearSession();
      return null;
    }
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: AuthStateChangeCallback): UnsubscribeFunction {
    this.authStateCallbacks.add(callback);
    
    // Call immediately with current state
    callback({ event: 'AUTH_STATE_CHANGE', session: this.currentSession as AuthSession });

    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }

  /**
   * Get headers for HTTP requests
   * This is where the JWT is included for PostgREST authorization
   */
  async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (this.currentSession?.access_token) {
      headers['Authorization'] = `Bearer ${this.currentSession.access_token}`;
      
      // Set role header for PostgREST (optional, usually inferred from JWT)
      if (this.currentSession.user.role) {
        headers['X-PostgREST-Role'] = this.currentSession.user.role;
      }
    }

    return headers;
  }

  /**
   * Get current user role for database authorization
   */
  getCurrentRole(): PostgRESTRole {
    if (!this.currentSession?.user.role) {
      return PostgRESTRole.ANONYMOUS;
    }

    // Map string roles to enum
    switch (this.currentSession.user.role.toLowerCase()) {
      case 'admin':
        return PostgRESTRole.ADMIN;
      case 'user':
      case 'authenticated':
        return PostgRESTRole.USER;
      case 'anonymous':
      default:
        return PostgRESTRole.ANONYMOUS;
    }
  }

  /**
   * Check if user has specific role or higher
   */
  hasRole(role: PostgRESTRole): boolean {
    const currentRole = this.getCurrentRole();
    const roleHierarchy = {
      [PostgRESTRole.ANONYMOUS]: 0,
      [PostgRESTRole.USER]: 1,
      [PostgRESTRole.ADMIN]: 2,
      [PostgRESTRole.AUTHENTICATOR]: 3,
    };

    return roleHierarchy[currentRole] >= roleHierarchy[role];
  }

  /**
   * Private method to initialize session from storage
   */
  private async initializeSession(): Promise<void> {
    if (!this.config.persistSession) {
      return;
    }

    try {
      const sessionData = await this.storage.getItem('pgrestify.session');
      if (sessionData) {
        const session: AuthSession = JSON.parse(sessionData);
        
        // Check if session is still valid
        if (session.expires_at > Date.now()) {
          this.currentSession = session;
          this.currentUser = session.user;
          this.setupTokenRefresh();
        } else if (session.refresh_token) {
          // Try to refresh expired session
          await this.refreshSession();
        }
      }
    } catch {
      // Ignore errors, start with no session
    }
  }

  /**
   * Private method to set current session
   */
  private async setSession(session: AuthSession): Promise<void> {
    this.currentSession = session;
    this.currentUser = session.user;

    // Persist session if enabled
    if (this.config.persistSession) {
      await this.storage.setItem('pgrestify.session', JSON.stringify(session));
    }

    // Setup automatic token refresh
    this.setupTokenRefresh();

    // Notify listeners
    this.notifyAuthStateChange(session);
  }

  /**
   * Private method to clear current session
   */
  private async clearSession(): Promise<void> {
    this.currentSession = null;
    this.currentUser = null;

    // Clear from storage
    if (this.config.persistSession) {
      await this.storage.removeItem('pgrestify.session');
    }

    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined as unknown as ReturnType<typeof setTimeout>;
    }

    // Notify listeners
    this.notifyAuthStateChange(null);
  }

  /**
   * Private method to setup automatic token refresh
   */
  private setupTokenRefresh(): void {
    if (!this.config.autoRefreshToken || !this.currentSession) {
      return;
    }

    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Calculate refresh time (5 minutes before expiry)
    const refreshTime = this.currentSession.expires_at - Date.now() - 5 * 60 * 1000;

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        await this.refreshSession();
      }, refreshTime);
    }
  }

  /**
   * Private method to notify auth state change listeners
   */
  private notifyAuthStateChange(session: AuthSession | null): void {
    this.authStateCallbacks.forEach(callback => {
      try {
        callback({ event: 'AUTH_STATE_CHANGE', session: session as AuthSession });
      } catch (error) {
        console.error('Error in auth state change callback:', error);
      }
    });
  }

  /**
   * Private method to decode JWT payload
   */
  private decodeJWT(token: string): PostgRESTJWTPayload {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url?.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64 || '')
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload) as PostgRESTJWTPayload;
    } catch {
      // Return minimal payload if decode fails
      return {
        role: PostgRESTRole.ANONYMOUS,
        exp: 0,
        iat: 0,
      };
    }
  }
}

/**
 * Utility functions for PostgREST role management
 */
export class PostgRESTRoleUtils {
  /**
   * Create a JWT payload for PostgREST
   */
  static createJWTPayload(
    userId: string | number,
    role: PostgRESTRole = PostgRESTRole.USER,
    email?: string,
    customClaims: Record<string, unknown> = {}
  ): PostgRESTJWTPayload {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      user_id: userId,
      role,
      email: email,
      iat: now,
      exp: now + 3600, // 1 hour
      ...customClaims,
    };
  }

  /**
   * Validate if a role is valid for PostgREST
   */
  static isValidRole(role: string): role is PostgRESTRole {
    return Object.values(PostgRESTRole).includes(role as PostgRESTRole);
  }

  /**
   * Get role hierarchy level
   */
  static getRoleLevel(role: PostgRESTRole): number {
    const levels = {
      [PostgRESTRole.ANONYMOUS]: 0,
      [PostgRESTRole.USER]: 1,
      [PostgRESTRole.ADMIN]: 2,
      [PostgRESTRole.AUTHENTICATOR]: 3,
    };
    
    return levels[role] ?? 0;
  }

  /**
   * Check if one role is higher than another
   */
  static isRoleHigher(role1: PostgRESTRole, role2: PostgRESTRole): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }
}