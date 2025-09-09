/**
 * Authentication-related types for PGRestify
 */

export interface User {
  id: string;
  aud: string;
  role: string;
  email?: string;
  phone?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  confirmation_sent_at?: string;
  recovery_sent_at?: string;
  email_change_sent_at?: string;
  new_email?: string;
  invited_at?: string;
  action_link?: string;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string | undefined;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: User;
}

export interface SignInCredentials {
  email?: string;
  password?: string;
  phone?: string;
  token?: string;
  provider?: string;
  options?: {
    redirectTo?: string;
    scopes?: string;
    queryParams?: Record<string, string>;
    data?: Record<string, unknown>;
  };
}

export interface SignUpCredentials {
  email: string;
  password: string;
  phone?: string;
  data?: Record<string, unknown>;
  options?: {
    data?: Record<string, unknown>;
    redirectTo?: string;
    emailRedirectTo?: string;
    captchaToken?: string;
  };
}

export interface ResetPasswordCredentials {
  email: string;
  options?: {
    redirectTo?: string;
    captchaToken?: string;
  };
}

export interface UpdateUserCredentials {
  email?: string;
  password?: string;
  phone?: string;
  data?: Record<string, unknown>;
}

export interface AuthResponse {
  data: {
    user: User | null;
    session: AuthSession | null;
  };
  error: null;
}

export interface AuthError {
  data: {
    user: null;
    session: null;
  };
  error: {
    message: string;
    status?: number;
  };
}

export type AuthResult = AuthResponse | AuthError;

export interface AuthChangeEvent {
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'AUTH_STATE_CHANGE';
  session: AuthSession | null;
}

export type AuthStateChangeCallback = (event: AuthChangeEvent) => void;
export type UnsubscribeFunction = () => void;

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface OAuthProvider {
  name: string;
  url: string;
  params?: Record<string, string>;
}

export interface VerifyEmailOtpCredentials {
  email: string;
  token: string;
  type: 'signup' | 'recovery' | 'email_change' | 'email';
}

export interface VerifyPhoneOtpCredentials {
  phone: string;
  token: string;
  type: 'sms' | 'phone_change';
}

export interface ResendCredentials {
  email?: string;
  phone?: string;
  type: 'signup' | 'recovery';
  options?: {
    emailRedirectTo?: string;
    captchaToken?: string;
  };
}

/**
 * JWT token payload structure
 */
export interface JWTPayload {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  email?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  role?: string;
  aal?: string;
  amr?: Array<{ method: string; timestamp: number }>;
  session_id?: string;
}

/**
 * Auth configuration options
 */
export interface AuthConfig {
  /** Automatically refresh the token when it expires */
  autoRefreshToken?: boolean;
  
  /** Persist the session across browser sessions */
  persistSession?: boolean;
  
  /** Detect session from URL fragments */
  detectSessionInUrl?: boolean;
  
  /** Custom storage implementation */
  storage?: AuthStorage;
  
  /** JWT decode options */
  jwt?: {
    /** Custom JWT decode function */
    decode?: (token: string) => JWTPayload | null;
    
    /** JWT verification options */
    verify?: boolean;
  };
  
  /** OAuth configuration */
  oauth?: {
    /** Redirect URL for OAuth flows */
    redirectTo?: string;
    
    /** Custom OAuth providers */
    providers?: Record<string, OAuthProvider>;
  };
  
  /** Token refresh settings */
  refresh?: {
    /** Number of seconds before expiration to refresh token */
    expiryMargin: number;
    
    /** Maximum number of retry attempts */
    retryAttempts: number;
    
    /** Delay between retry attempts in milliseconds */
    retryDelay: number;
  };
}

/**
 * Default auth configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  refresh: {
    expiryMargin: 60, // 1 minute
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },
};

/**
 * Auth state for tracking authentication status
 */
export enum AuthState {
  SIGNED_OUT = 'SIGNED_OUT',
  SIGNED_IN = 'SIGNED_IN',
  SIGNING_IN = 'SIGNING_IN',
  SIGNING_OUT = 'SIGNING_OUT',
  TOKEN_REFRESHING = 'TOKEN_REFRESHING',
}

/**
 * Session storage keys
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'supabase.auth.token',
  REFRESH_TOKEN: 'supabase.auth.refresh_token',
  USER: 'supabase.auth.user',
  EXPIRES_AT: 'supabase.auth.expires_at',
} as const;

/**
 * Parse JWT token without verification (for client-side inspection)
 */
export function parseJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired
 */
export function isTokenExpired(token: string, expiryMargin: number = 60): boolean {
  const payload = parseJWT(token);
  if (!payload?.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + expiryMargin;
}

/**
 * Get token expiration time in milliseconds
 */
export function getTokenExpiry(token: string): number | null {
  const payload = parseJWT(token);
  return payload?.exp ? payload.exp * 1000 : null;
}