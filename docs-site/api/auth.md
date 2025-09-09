# Authentication API Reference

Comprehensive API documentation for PGRestify's Authentication mechanisms.

## Basic Authentication Interface

```typescript
interface AuthService {
  // Sign-in methods
  signIn(credentials: SignInCredentials): Promise<AuthResult>;
  signInWithOAuth(provider: OAuthProvider): Promise<AuthResult>;
  
  // Sign-up methods
  signUp(credentials: SignUpCredentials): Promise<AuthResult>;
  
  // Session management
  getSession(): Session | null;
  refreshSession(): Promise<Session>;
  
  // Sign-out methods
  signOut(options?: SignOutOptions): Promise<void>;
  
  // Password management
  resetPasswordForEmail(email: string): Promise<ResetPasswordResult>;
  updatePassword(newPassword: string): Promise<void>;
  
  // Multi-factor authentication
  enrollFactor(factorType: FactorType): Promise<EnrollFactorResult>;
  verifyFactor(verificationData: FactorVerification): Promise<VerifyFactorResult>;
  
  // Event listeners
  onAuthStateChange(callback: AuthStateChangeCallback): Unsubscribe;
}
```

## Interfaces and Types

```typescript
interface SignInCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials extends SignInCredentials {
  name?: string;
  metadata?: Record<string, unknown>;
}

interface AuthResult {
  user: User;
  session: Session;
  error?: AuthError;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
}
```

## Sign-In Methods

```typescript
// Basic email/password sign-in
const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});

// OAuth sign-in
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'github',
  options: {
    scopes: ['user:email', 'read:user']
  }
});
```

## Sign-Up Methods

```typescript
// Basic sign-up
const { user, session, error } = await client.auth.signUp({
  email: 'newuser@example.com',
  password: 'secure-password',
  name: 'John Doe',
  metadata: {
    referral_source: 'marketing_campaign'
  }
});
```

## Session Management

```typescript
// Get current session
const currentSession = client.auth.getSession();

// Refresh session
const newSession = await client.auth.refreshSession();

// Check if user is authenticated
const isAuthenticated = !!client.auth.getSession();
```

## Sign-Out Methods

```typescript
// Sign out current device
await client.auth.signOut();

// Sign out all devices
await client.auth.signOut({ all: true });
```

## Password Management

```typescript
// Reset password
const { data, error } = await client.auth.resetPasswordForEmail(
  'user@example.com'
);

// Update password
await client.auth.updatePassword('new-secure-password');
```

## Multi-Factor Authentication (MFA)

```typescript
// Enroll in MFA
const { data, error } = await client.auth.enrollFactor({
  factorType: 'totp',
  friendlyName: 'Authenticator App'
});

// Verify MFA factor
const { verified } = await client.auth.verifyFactor({
  factorId: 'factor-id',
  challengeId: 'challenge-id',
  code: '123456'
});
```

## Authentication Events

```typescript
// Listen to authentication state changes
const unsubscribe = client.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in', session);
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      break;
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed', session);
      break;
  }
});

// Unsubscribe when no longer needed
unsubscribe();
```

## Advanced Authentication Configuration

```typescript
const client = createClient({
  auth: {
    // Token validation
    tokenValidation: {
      requireExpiration: true,
      maxTokenAge: 3600, // 1 hour
      
      // Custom validation function
      validate: (token) => {
        // Implement custom token validation logic
        return validateJWTClaims(token);
      }
    },
    
    // Automatic token refresh
    refreshToken: {
      enabled: true,
      beforeExpiry: 300 // Refresh 5 minutes before expiration
    },
    
    // Custom storage mechanism
    storage: {
      get: (key) => localStorage.getItem(key),
      set: (key, value) => localStorage.setItem(key, value),
      remove: (key) => localStorage.removeItem(key)
    }
  }
});
```

## Error Handling

```typescript
try {
  const { data, error } = await client.auth.signIn({
    email: 'user@example.com',
    password: 'password123'
  });

  if (error) {
    switch (error.name) {
      case 'AuthError':
        console.log('Invalid credentials');
        break;
      case 'NetworkError':
        console.log('Connection failed');
        break;
    }
  }
} catch (unexpectedError) {
  console.error('Unexpected authentication error', unexpectedError);
}
```

## Social Authentication

```typescript
// Sign in with GitHub
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'github',
  options: {
    scopes: ['user:email', 'read:user']
  }
});

// Sign in with Google
const googleAuth = await client.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: ['email', 'profile']
  }
});
```

## JWT Token Management

```typescript
// Decode JWT token
const decodedToken = client.auth.decodeToken(token);

// Validate JWT token
const isValid = client.auth.validateToken(token);

// Get token claims
const claims = client.auth.getTokenClaims(token);
```

## Impersonation and Admin Actions

```typescript
// Impersonate user (admin only)
const impersonatedSession = await client.auth.impersonateUser(
  'user-id-to-impersonate'
);

// Revoke user sessions (admin only)
await client.auth.revokeUserSessions('user-id');
```

## Security Best Practices

- Use HTTPS for all authentication requests
- Implement strong password policies
- Enable multi-factor authentication
- Use secure token storage
- Implement token rotation
- Validate and sanitize all inputs
- Use least-privilege access
- Monitor and log authentication events

## Performance Considerations

- Minimize authentication round trips
- Cache authentication state
- Use token caching with proper expiration
- Implement efficient token refresh mechanism
- Minimize sensitive data in tokens
- Use secure, stateless authentication

## Troubleshooting

- Check network connectivity
- Verify authentication endpoint
- Validate credentials
- Check token format and expiration
- Review error messages
- Monitor authentication logs
- Test different authentication scenarios