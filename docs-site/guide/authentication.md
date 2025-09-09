# Authentication

PGRestify provides comprehensive JWT-based authentication with session management, token refresh, role-based access control, and security best practices. The authentication system integrates seamlessly with PostgREST's security model.

## JWT Authentication Setup

### Basic Configuration

Configure authentication when creating your client:

```typescript
import { createClient } from 'pgrestify';

const client = createClient({
  url: 'http://localhost:3000',
  apikey: 'your-anon-key', // Anonymous/public key
  auth: {
    // Authentication endpoint
    url: 'http://localhost:3000/auth/v1',
    
    // Auto-refresh tokens
    autoRefreshToken: true,
    
    // Persist session in storage
    persistSession: true,
    
    // Storage mechanism (defaults to localStorage in browser)
    storage: localStorage,
    
    // Detect session from URL (for magic links, etc.)
    detectSessionInUrl: true
  }
});
```

## Authentication Methods

### Email/Password Authentication

```typescript
interface User {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, any>;
}

// Sign up new user
async function signUp(email: string, password: string, metadata?: Record<string, any>) {
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata // Additional user metadata
      }
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (data.user) {
      console.log('User created:', data.user);
      
      if (data.session) {
        console.log('Session created:', data.session);
        // User is automatically signed in
      } else {
        console.log('Confirmation email sent');
        // User needs to confirm email
      }
    }
    
    return data;
  } catch (error) {
    console.error('Sign up failed:', error);
    throw error;
  }
}

// Sign in existing user
async function signIn(email: string, password: string) {
  try {
    const { data, error } = await client.auth.signIn({
      email,
      password
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    console.log('Signed in:', data.user);
    console.log('Session:', data.session);
    
    return data;
  } catch (error) {
    console.error('Sign in failed:', error);
    throw error;
  }
}

// Usage
await signUp('user@example.com', 'secure-password', {
  name: 'John Doe',
  preferences: { theme: 'dark' }
});

await signIn('user@example.com', 'secure-password');
```

## Session Management

### Session State

```typescript
// Get current session
const session = client.auth.session();
console.log('Current session:', session);

if (session) {
  console.log('User:', session.user);
  console.log('Access token:', session.access_token);
  console.log('Refresh token:', session.refresh_token);
  console.log('Expires at:', new Date(session.expires_at * 1000));
}

// Get current user
const user = client.auth.user();
console.log('Current user:', user);
```

### Session Events

```typescript
// Listen for auth state changes
client.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  console.log('Session:', session);
  
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in:', session?.user);
      // Redirect to dashboard, update UI, etc.
      handleSignIn(session?.user);
      break;
      
    case 'SIGNED_OUT':
      console.log('User signed out');
      // Redirect to login, clear local data, etc.
      handleSignOut();
      break;
      
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed:', session?.access_token);
      // Optional: Update stored token
      break;
      
    case 'USER_UPDATED':
      console.log('User updated:', session?.user);
      // Update user profile in UI
      updateUserProfile(session?.user);
      break;
  }
});
```

## Token Refresh Patterns

### Automatic Refresh

```typescript
// Configure automatic refresh
const client = createClient({
  url: 'http://localhost:3000',
  auth: {
    autoRefreshToken: true,
    
    // Refresh token before it expires
    jwt: {
      expiryMargin: 300 // 5 minutes before expiry
    }
  }
});

// The client will automatically refresh tokens
// You can listen for refresh events
client.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token auto-refreshed');
  }
});
```

## Role-Based Access Control

### User Roles

```typescript
interface UserWithRole extends User {
  role: string;
  permissions: string[];
}

// Get user role from JWT claims
function getUserRole(): string | null {
  const session = client.auth.session();
  if (!session) return null;
  
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    return payload.role || payload.user_role || null;
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return null;
  }
}

// Check user permissions
function hasPermission(permission: string): boolean {
  const session = client.auth.session();
  if (!session) return false;
  
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    const permissions = payload.permissions || [];
    return permissions.includes(permission);
  } catch (error) {
    return false;
  }
}

// Role-based component rendering
function ProtectedComponent() {
  const userRole = getUserRole();
  
  if (!userRole) {
    return <div>Please sign in</div>;
  }
  
  if (userRole === 'admin') {
    return <AdminPanel />;
  } else if (userRole === 'user') {
    return <UserDashboard />;
  } else {
    return <div>Unauthorized</div>;
  }
}
```

## React Integration

### Authentication Hooks

```typescript
import { useAuth } from 'pgrestify/react';

function LoginForm() {
  const { signIn, signUp, loading, error } = useAuth();
  
  const handleSignIn = async (email: string, password: string) => {
    try {
      await signIn({ email, password });
      // Redirect handled automatically by auth state change
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSignIn(
        formData.get('email') as string,
        formData.get('password') as string
      );
    }}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}

function AuthStatus() {
  const { user, session, signOut } = useAuth();
  
  if (!user) {
    return <LoginForm />;
  }
  
  return (
    <div>
      <p>Welcome, {user.email}</p>
      <p>Session expires: {new Date(session.expires_at * 1000).toLocaleString()}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Protected Routes

```typescript
function ProtectedRoute({ children, requiredRole }: { 
  children: React.ReactNode; 
  requiredRole?: string;
}) {
  const { user, loading } = useAuth();
  const userRole = getUserRole();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole && userRole !== requiredRole) {
    return <div>Unauthorized - Required role: {requiredRole}</div>;
  }
  
  return <>{children}</>;
}

// Usage
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPanel />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}
```

## Security Best Practices

### Token Security

```typescript
// 1. Token validation
function isValidToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false;
    }
    
    // Check issuer
    if (payload.iss !== 'your-expected-issuer') {
      return false;
    }
    
    // Check audience
    if (payload.aud !== 'your-expected-audience') {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}
```

### Input Validation

```typescript
// Validate authentication inputs
function validateCredentials(email: string, password: string): string[] {
  const errors: string[] = [];
  
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    errors.push('Valid email is required');
  }
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push('Password must contain uppercase, lowercase, and number');
  }
  
  return errors;
}

async function secureSignUp(email: string, password: string) {
  const errors = validateCredentials(email, password);
  
  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  
  return client.auth.signUp({ email, password });
}
```

## Error Handling

### Authentication Errors

```typescript
function handleAuthError(error: any): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password. Please try again.';
      
    case 'Email not confirmed':
      return 'Please check your email and confirm your account.';
      
    case 'Too many requests':
      return 'Too many attempts. Please wait a few minutes before trying again.';
      
    case 'Password should be at least 8 characters':
      return 'Password must be at least 8 characters long.';
      
    case 'JWT expired':
      return 'Your session has expired. Please sign in again.';
      
    default:
      return 'Authentication failed. Please try again.';
  }
}
```

## Summary

PGRestify's authentication system provides:

- **JWT-Based Authentication**: Secure, stateless authentication with automatic token refresh
- **Multiple Auth Methods**: Email/password, OAuth, magic links, and more
- **Session Management**: Automatic session persistence and state management
- **Role-Based Access**: Built-in support for roles and permissions
- **React Integration**: Purpose-built hooks for React applications
- **Security Features**: Token validation, session timeout, and secure storage
- **Error Handling**: Comprehensive error handling and user feedback

The authentication system integrates seamlessly with PostgREST's Row Level Security, providing a complete security solution for your applications.