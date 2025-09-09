# Next.js Authentication

Comprehensive authentication integration for Next.js applications using PGRestify with support for JWT tokens, sessions, and role-based access control.

## Overview

PGRestify provides built-in authentication support for Next.js applications with:
- JWT token management
- Cookie-based sessions
- Server and client authentication
- Role-based access control (RBAC)
- Social authentication integration
- Multi-factor authentication (MFA)

## Setup

### Basic Configuration

```typescript
// lib/auth-client.ts
import { createNextJSClient } from 'pgrestify/nextjs'

export const authClient = createNextJSClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'pgrestify-auth',
    cookieName: 'pgrestify-session',
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  }
})
```

### Environment Variables

```bash
# .env.local
POSTGREST_URL=http://localhost:3000
POSTGREST_ANON_KEY=your_anon_key
POSTGREST_SERVICE_KEY=your_service_key  # Server-side only
JWT_SECRET=your_jwt_secret
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_nextauth_secret
```

## Authentication Flow

### Sign Up

```typescript
// app/auth/signup/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '../../../lib/auth-client'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    try {
      const result = await authClient.auth.signUp({
        email,
        password,
        data: {
          // Additional user metadata
          name: 'New User',
          avatar_url: null
        }
      })
      
      if (result.error) {
        throw result.error
      }
      
      // Check if email confirmation is required
      if (result.data?.user && !result.data.session) {
        router.push('/auth/verify-email')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err.message)
    }
  }
  
  return (
    <form onSubmit={handleSignUp}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Sign Up</button>
    </form>
  )
}
```

### Sign In

```typescript
// app/auth/signin/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '../../../lib/auth-client'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    try {
      const result = await authClient.auth.signIn({
        email,
        password
      })
      
      if (result.error) {
        throw result.error
      }
      
      // Redirect to intended page or dashboard
      const redirectTo = new URLSearchParams(window.location.search).get('from')
      router.push(redirectTo || '/dashboard')
    } catch (err) {
      console.error('Sign in error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSignIn}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
```

## Server-Side Authentication

### Protecting Server Components

```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from '../lib/auth'

export default async function DashboardPage() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/auth/signin?from=/dashboard')
  }
  
  return (
    <div>
      <h1>Welcome, {session.user.email}</h1>
      {/* Protected content */}
    </div>
  )
}
```

### Auth Helper Functions

```typescript
// lib/auth.ts
import { cookies } from 'next/headers'
import { authClient } from './auth-client'

export async function getServerSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('pgrestify-session')
  
  if (!sessionCookie) {
    return null
  }
  
  try {
    const session = await authClient.auth.getSession(sessionCookie.value)
    return session.data.session
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

export async function requireAuth() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/auth/signin')
  }
  
  return session
}

export async function requireRole(role: string) {
  const session = await requireAuth()
  
  if (session.user.role !== role) {
    redirect('/unauthorized')
  }
  
  return session
}
```

## Middleware Protection

### Global Auth Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from './lib/jwt'

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('pgrestify-session')
  
  // Check protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!sessionCookie) {
      return NextResponse.redirect(
        new URL('/auth/signin?from=' + request.nextUrl.pathname, request.url)
      )
    }
    
    try {
      const payload = await verifyJWT(sessionCookie.value)
      
      // Add user info to headers for server components
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', payload.sub)
      requestHeaders.set('x-user-role', payload.role)
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    } catch (error) {
      // Invalid token, redirect to sign in
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/protected/:path*',
    '/admin/:path*'
  ]
}
```

## Role-Based Access Control

### Defining Roles

```typescript
// lib/rbac.ts
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator'
} as const

export const PERMISSIONS = {
  'users:read': [ROLES.ADMIN, ROLES.MODERATOR],
  'users:write': [ROLES.ADMIN],
  'posts:read': [ROLES.ADMIN, ROLES.MODERATOR, ROLES.USER],
  'posts:write': [ROLES.ADMIN, ROLES.MODERATOR],
  'posts:delete': [ROLES.ADMIN]
} as const

export function hasPermission(
  userRole: string,
  permission: keyof typeof PERMISSIONS
): boolean {
  return PERMISSIONS[permission].includes(userRole as any)
}
```

### Protected Components

```typescript
// components/ProtectedComponent.tsx
import { getServerSession } from '../lib/auth'
import { hasPermission } from '../lib/rbac'

interface ProtectedComponentProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export async function ProtectedComponent({
  permission,
  children,
  fallback = <div>Unauthorized</div>
}: ProtectedComponentProps) {
  const session = await getServerSession()
  
  if (!session || !hasPermission(session.user.role, permission)) {
    return fallback
  }
  
  return <>{children}</>
}

// Usage
export default function AdminPanel() {
  return (
    <ProtectedComponent permission="users:write">
      <div>Admin only content</div>
    </ProtectedComponent>
  )
}
```

## Social Authentication

### OAuth Provider Setup

```typescript
// lib/oauth.ts
import { authClient } from './auth-client'

export async function signInWithGoogle() {
  const result = await authClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  
  if (result.error) {
    throw result.error
  }
  
  return result.data
}

export async function signInWithGitHub() {
  const result = await authClient.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email'
    }
  })
  
  return result.data
}
```

### OAuth Callback Handler

```typescript
// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authClient } from '../../../lib/auth-client'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  if (code) {
    const sessionResult = await authClient.auth.exchangeCodeForSession(code)
    
    if (sessionResult.data.session) {
      // Set session cookie
      const response = NextResponse.redirect(new URL('/dashboard', request.url))
      response.cookies.set('pgrestify-session', sessionResult.data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      return response
    }
  }
  
  // Auth failed
  return NextResponse.redirect(new URL('/auth/signin?error=oauth', request.url))
}
```

## Session Management

### Client-Side Session Hook

```typescript
// hooks/useSession.ts
'use client'

import { useEffect, useState } from 'react'
import { authClient } from '../lib/auth-client'

export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // Get initial session
    authClient.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    
    // Subscribe to auth changes
    const { data: subscription } = authClient.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
      }
    )
    
    return () => {
      subscription?.unsubscribe()
    }
  }, [])
  
  return { session, loading }
}
```

### Server Actions with Auth

```typescript
// app/actions/user.ts
'use server'

import { requireAuth } from '../lib/auth'
import { authClient } from '../lib/auth-client'

export async function updateProfile(formData: FormData) {
  const session = await requireAuth()
  
  const result = await authClient
    .from('profiles')
    .update({
      name: formData.get('name'),
      bio: formData.get('bio')
    })
    .eq('user_id', session.user.id)
    .execute()
  
  if (result.error) {
    throw new Error('Failed to update profile')
  }
  
  revalidatePath('/profile')
  return result.data
}
```

## Password Management

### Password Reset Flow

```typescript
// app/auth/forgot-password/page.tsx
'use client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  
  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    
    const result = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    
    if (!result.error) {
      setSent(true)
    }
  }
  
  if (sent) {
    return <div>Check your email for the reset link</div>
  }
  
  return (
    <form onSubmit={handleReset}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit">Send Reset Link</button>
    </form>
  )
}
```

### Update Password

```typescript
// app/auth/reset-password/page.tsx
'use client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      alert('Passwords do not match')
      return
    }
    
    const result = await authClient.auth.updateUser({
      password
    })
    
    if (result.error) {
      console.error('Password update failed:', result.error)
    } else {
      router.push('/dashboard')
    }
  }
  
  return (
    <form onSubmit={handleUpdate}>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        required
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        required
      />
      <button type="submit">Update Password</button>
    </form>
  )
}
```

## Multi-Factor Authentication

### Enable MFA

```typescript
// app/settings/security/page.tsx
'use client'

export default function SecuritySettings() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  
  async function enableMFA() {
    const result = await authClient.auth.mfa.enroll({
      factorType: 'totp'
    })
    
    if (result.data) {
      setQrCode(result.data.qr_code)
      setSecret(result.data.secret)
    }
  }
  
  async function verifyMFA(code: string) {
    const result = await authClient.auth.mfa.challenge({
      factorId: secret!,
      code
    })
    
    if (result.data) {
      alert('MFA enabled successfully!')
    }
  }
  
  return (
    <div>
      <button onClick={enableMFA}>Enable 2FA</button>
      {qrCode && (
        <div>
          <img src={qrCode} alt="MFA QR Code" />
          <input
            type="text"
            placeholder="Enter verification code"
            onBlur={(e) => verifyMFA(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
```

## Security Best Practices

### 1. **Secure Cookie Configuration**
```typescript
{
  httpOnly: true,
  secure: true, // HTTPS only in production
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 7 // 7 days
}
```

### 2. **CSRF Protection**
```typescript
// lib/csrf.ts
import { randomBytes } from 'crypto'

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken
}
```

### 3. **Rate Limiting Auth Endpoints**
```typescript
// middleware/auth-rate-limit.ts
const attempts = new Map()

export function rateLimitAuth(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  return (email: string): boolean => {
    const key = email.toLowerCase()
    const now = Date.now()
    
    const userAttempts = attempts.get(key) || { count: 0, resetAt: now + windowMs }
    
    if (now > userAttempts.resetAt) {
      userAttempts.count = 0
      userAttempts.resetAt = now + windowMs
    }
    
    if (userAttempts.count >= maxAttempts) {
      return false // Rate limited
    }
    
    userAttempts.count++
    attempts.set(key, userAttempts)
    return true
  }
}
```

## Testing Authentication

### Unit Testing

```typescript
// __tests__/auth.test.ts
import { authClient } from '../lib/auth-client'

describe('Authentication', () => {
  test('Sign up creates new user', async () => {
    const result = await authClient.auth.signUp({
      email: 'test@example.com',
      password: 'TestPassword123!'
    })
    
    expect(result.data.user).toBeDefined()
    expect(result.data.user.email).toBe('test@example.com')
  })
  
  test('Sign in returns session', async () => {
    const result = await authClient.auth.signIn({
      email: 'test@example.com',
      password: 'TestPassword123!'
    })
    
    expect(result.data.session).toBeDefined()
    expect(result.data.session.access_token).toBeDefined()
  })
})
```

## Next Steps

- [Server Actions](/guide/nextjs-server-actions)
- [Middleware](/guide/nextjs-middleware)
- [Session Management](/guide/nextjs-sessions)
- [Security Best Practices](/guide/security)