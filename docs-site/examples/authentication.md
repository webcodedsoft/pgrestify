# Authentication Example

Comprehensive guide to authentication mechanisms in PGRestify.

## Basic Email/Password Authentication

```typescript
import { createClient } from 'pgrestify';

// Create client
const client = createClient('http://localhost:3000');

// Sign-in function
async function signIn(email: string, password: string) {
  try {
    const { data, error } = await client.auth.signIn({
      email,
      password
    });

    if (error) {
      console.error('Sign-in failed:', error.message);
      return null;
    }

    console.log('Signed in user:', data.user);
    return data.user;
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return null;
  }
}

// Sign-up function
async function signUp(email: string, password: string, name?: string) {
  try {
    const { user, session, error } = await client.auth.signUp({
      email,
      password,
      name,
      metadata: {
        registrationSource: 'web-app'
      }
    });

    if (error) {
      console.error('Sign-up failed:', error.message);
      return null;
    }

    console.log('Registered user:', user);
    return { user, session };
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return null;
  }
}
```

## Social Authentication

```typescript
// OAuth sign-in methods
async function signInWithGitHub() {
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: ['user:email', 'read:user']
      }
    });

    if (error) {
      console.error('GitHub sign-in failed:', error.message);
      return null;
    }

    console.log('GitHub user:', data.user);
    return data.user;
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return null;
  }
}

// Google sign-in
async function signInWithGoogle() {
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: ['email', 'profile']
      }
    });

    if (error) {
      console.error('Google sign-in failed:', error.message);
      return null;
    }

    console.log('Google user:', data.user);
    return data.user;
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return null;
  }
}
```

## Session Management

```typescript
// Check authentication state
function checkAuthState() {
  const session = client.auth.getSession();
  
  if (session) {
    console.log('User is authenticated');
    console.log('Token expires at:', new Date(session.expires_at * 1000));
    return true;
  }
  
  console.log('No active session');
  return false;
}

// Refresh token
async function refreshSession() {
  try {
    const newSession = await client.auth.refreshSession();
    console.log('Session refreshed:', newSession);
    return newSession;
  } catch (error) {
    console.error('Session refresh failed:', error.message);
    return null;
  }
}

// Sign out
async function signOut(options?: { all?: boolean }) {
  try {
    await client.auth.signOut(options);
    console.log('Successfully signed out');
  } catch (error) {
    console.error('Sign-out failed:', error.message);
  }
}
```

## Multi-Factor Authentication (MFA)

```typescript
// Enroll in MFA
async function enrollMFA() {
  try {
    const { data, error } = await client.auth.enrollFactor({
      factorType: 'totp',
      friendlyName: 'Authenticator App'
    });

    if (error) {
      console.error('MFA enrollment failed:', error.message);
      return null;
    }

    console.log('MFA enrollment details:', data);
    return data;
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return null;
  }
}

// Verify MFA
async function verifyMFA(factorId: string, challengeId: string, code: string) {
  try {
    const { verified, error } = await client.auth.verifyFactor({
      factorId,
      challengeId,
      code
    });

    if (error) {
      console.error('MFA verification failed:', error.message);
      return false;
    }

    console.log('MFA verification status:', verified);
    return verified;
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return false;
  }
}
```

## Password Management

```typescript
// Reset password
async function resetPassword(email: string) {
  try {
    const { data, error } = await client.auth.resetPasswordForEmail(email);

    if (error) {
      console.error('Password reset failed:', error.message);
      return false;
    }

    console.log('Password reset initiated');
    return true;
  } catch (unexpectedError) {
    console.error('Unexpected error:', unexpectedError);
    return false;
  }
}

// Update password
async function updatePassword(newPassword: string) {
  try {
    await client.auth.updatePassword(newPassword);
    console.log('Password updated successfully');
    return true;
  } catch (error) {
    console.error('Password update failed:', error.message);
    return false;
  }
}
```

## Authentication Events

```typescript
// Listen to authentication state changes
function setupAuthListener() {
  const unsubscribe = client.auth.onAuthStateChange((event, session) => {
    switch (event) {
      case 'SIGNED_IN':
        console.log('User signed in', session);
        // Perform actions like updating UI, fetching user data
        break;
      case 'SIGNED_OUT':
        console.log('User signed out');
        // Clear user-specific data, redirect to login
        break;
      case 'TOKEN_REFRESHED':
        console.log('Token refreshed', session);
        // Update stored session information
        break;
    }
  });

  // Optional: Unsubscribe when component unmounts
  return unsubscribe;
}
```

## Advanced Authentication Configuration

```typescript
// Create client with advanced auth configuration
const advancedClient = createClient('http://localhost:3000', {
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

## Comprehensive Authentication Flow

```typescript
async function completeAuthFlow() {
  try {
    // Sign up
    const signUpResult = await signUp(
      'user@example.com', 
      'secure-password', 
      'John Doe'
    );

    if (!signUpResult) return;

    // Enroll in MFA
    const mfaEnrollment = await enrollMFA();
    
    if (mfaEnrollment) {
      // Verify MFA
      const verified = await verifyMFA(
        mfaEnrollment.factorId, 
        mfaEnrollment.challengeId, 
        'mfa-code-from-user'
      );

      if (verified) {
        // Perform authenticated actions
        const userData = await fetchUserData();
        updateUserInterface(userData);
      }
    }
  } catch (error) {
    console.error('Authentication flow failed:', error);
  }
}
```

## Best Practices

- Always use HTTPS
- Implement strong password policies
- Enable multi-factor authentication
- Use secure token storage
- Implement token rotation
- Validate and sanitize all inputs
- Use least-privilege access
- Monitor and log authentication events

## Error Handling Strategies

- Provide clear error messages
- Handle network errors gracefully
- Implement retry mechanisms
- Log authentication attempts
- Protect against brute-force attacks
- Use secure error responses

## Security Considerations

- Never store raw passwords
- Use secure, HttpOnly cookies
- Implement rate limiting
- Validate and sanitize all inputs
- Use HTTPS everywhere
- Implement proper logout mechanisms
- Regularly audit authentication logs