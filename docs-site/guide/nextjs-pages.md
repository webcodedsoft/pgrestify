# Next.js Pages Router

The Pages Router is the traditional Next.js routing system, perfect for existing applications and gradual migrations.

## Setup

```typescript
// lib/client.ts
import { createPagesClient } from 'pgrestify/nextjs'

export const client = createPagesClient({
  url: process.env.POSTGREST_URL!,
  auth: {
    persistSession: true
  }
})
```

## Server-Side Rendering (SSR)

### Basic getServerSideProps

```typescript
import { createGetServerSideProps } from 'pgrestify/nextjs'
import { client } from '../lib/client'

interface User {
  id: number
  name: string
  email: string
}

export const getServerSideProps = createGetServerSideProps<{ users: User[] }>(
  async (client, context) => {
    const result = await client
      .from<User>('users')
      .select('id', 'name', 'email')
      .execute()

    return {
      users: result.data || []
    }
  }
)

export default function UsersPage({ users }: { users: User[] }) {
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

### With Authentication

```typescript
export const getServerSideProps = createGetServerSideProps(
  async (client, context) => {
    const session = await client.auth.getSessionFromCookies(context.req.cookies)
    
    if (!session) {
      return {
        redirect: {
          destination: '/login',
          permanent: false
        }
      }
    }

    const result = await client
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .execute()

    return {
      user: result.data
    }
  },
  {
    auth: { required: true },
    cache: { ttl: 300 } // 5 minutes
  }
)
```

## Static Site Generation (SSG)

### Basic getStaticProps

```typescript
export const getStaticProps = createGetStaticProps<{ posts: Post[] }>(
  async (client) => {
    const result = await client
      .from<Post>('posts')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .execute()

    return {
      posts: result.data || []
    }
  },
  {
    revalidate: 3600 // Revalidate every hour
  }
)
```

### With Dynamic Paths

```typescript
export const getStaticPaths = createGetStaticPaths(
  async (client) => {
    const result = await client
      .from('posts')
      .select('slug')
      .execute()

    return result.data?.map(post => ({
      params: { slug: post.slug }
    })) || []
  }
)

export const getStaticProps = createGetStaticProps<{ post: Post }>(
  async (client, context) => {
    const { slug } = context.params!
    
    const result = await client
      .from<Post>('posts')
      .select('*')
      .eq('slug', slug)
      .single()
      .execute()

    if (!result.data) {
      return { notFound: true }
    }

    return {
      post: result.data
    }
  }
)
```

## API Routes

### Basic CRUD API

```typescript
// pages/api/users.ts
import { createApiHandler } from 'pgrestify/nextjs'
import { client } from '../../lib/client'

export default createApiHandler({
  GET: async (req, res, client) => {
    const result = await client
      .from('users')
      .select('*')
      .execute()
    
    return result.data
  },

  POST: async (req, res, client) => {
    const result = await client
      .from('users')
      .insert(req.body)
      .select('*')
      .single()
      .execute()
    
    return result.data
  }
})
```

### Advanced API with Validation

```typescript
// pages/api/users/[id].ts
import { createApiHandler, withAuth, withValidation } from 'pgrestify/nextjs'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
})

export default createApiHandler({
  GET: withAuth(async (req, res, client, { user }) => {
    const { id } = req.query
    
    const result = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
      .execute()
    
    return result.data
  }),

  PUT: withAuth(
    withValidation(UpdateUserSchema)(
      async (req, res, client, { user, validatedBody }) => {
        const { id } = req.query
        
        const result = await client
          .from('users')
          .update(validatedBody)
          .eq('id', id)
          .select('*')
          .single()
          .execute()
        
        return result.data
      }
    )
  )
})
```

## Client-Side Integration

### With React Hooks

```typescript
// components/UserList.tsx
import { useQuery } from 'pgrestify/react'
import { client } from '../lib/client'

export function UserList() {
  const { data: users, loading, error } = useQuery(
    client,
    'users',
    (q) => q.select('id', 'name', 'email').eq('active', true)
  )

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

### With TanStack Query

```typescript
// hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query'
import { client } from '../lib/client'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const result = await client
        .from('users')
        .select('*')
        .execute()
      
      if (result.error) throw result.error
      return result.data
    }
  })
}
```

## Middleware

### Authentication Middleware

```typescript
// middleware.ts
import { createAuthMiddleware } from 'pgrestify/nextjs'
import { client } from './lib/client'

export const middleware = createAuthMiddleware(client, {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
  redirectTo: '/login',
  roles: {
    '/api/admin/:path*': ['admin'],
    '/dashboard/admin/:path*': ['admin']
  }
})

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
```

## Error Handling

### Global Error Boundary

```typescript
// pages/_error.tsx
import { NextPageContext } from 'next'
import { PostgRESTError } from 'pgrestify'

interface ErrorProps {
  statusCode: number
  hasGetInitialPropsRun: boolean
  err?: PostgRESTError
}

function ErrorPage({ statusCode, err }: ErrorProps) {
  if (err instanceof PostgRESTError) {
    return (
      <div>
        <h1>Database Error</h1>
        <p>Status: {err.statusCode}</p>
        <p>Message: {err.message}</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Error {statusCode}</h1>
      <p>An error occurred on the server</p>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode, hasGetInitialPropsRun: true, err }
}

export default ErrorPage
```

## Environment Configuration

### Development

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    POSTGREST_URL: process.env.POSTGREST_URL,
    POSTGREST_ANON_KEY: process.env.POSTGREST_ANON_KEY
  },
  
  // Development optimizations
  experimental: {
    optimizePackageImports: ['pgrestify']
  }
}

module.exports = nextConfig
```

### Production

```typescript
// next.config.js
const nextConfig = {
  // Production optimizations
  output: 'standalone', // For Docker deployments
  compress: true,
  
  // CDN configuration for static assets
  assetPrefix: process.env.CDN_URL,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' }
        ]
      }
    ]
  }
}
```

## Performance Tips

### Caching Strategies

```typescript
// Aggressive caching for static data
export const getStaticProps = createGetStaticProps(
  async (client) => {
    const categories = await client.from('categories').select('*').execute()
    return { categories: categories.data }
  },
  {
    revalidate: 86400 // Revalidate daily
  }
)

// User-specific caching
export const getServerSideProps = createGetServerSideProps(
  async (client, context) => {
    const userData = await client.from('users').select('*').execute()
    return { users: userData.data }
  },
  {
    cache: {
      ttl: 300, // 5 minutes
      varyBy: ['user'] // Cache per user
    }
  }
)
```

### Bundle Optimization

```typescript
// Dynamic imports for client-side components
import dynamic from 'next/dynamic'

const UserDashboard = dynamic(() => import('../components/UserDashboard'), {
  ssr: false, // Client-side only
  loading: () => <div>Loading dashboard...</div>
})
```

## Migration Guide

### From Direct PostgREST

```typescript
// Before: Direct fetch
const users = await fetch(`${POSTGREST_URL}/users`)
  .then(res => res.json())

// After: PGRestify
const result = await client.from('users').select('*').execute()
const users = result.data
```

### From Other Libraries

```typescript
// From Supabase
// Before: supabase.from('users').select('*')
// After: client.from('users').select('*').execute()

// From Prisma
// Before: prisma.user.findMany()
// After: client.getRepository('users').find()
```

## Best Practices

### 1. **Client Instance Management**

```typescript
// ✅ Good: Single client instance
const client = createNextJSClient({ url: process.env.POSTGREST_URL })

// ❌ Bad: Multiple client instances
const client1 = createClient({ url: url1 })
const client2 = createClient({ url: url2 })
```

### 2. **Error Handling**

```typescript
// ✅ Good: Proper error handling
try {
  const result = await client.from('users').select('*').execute()
  if (result.error) {
    throw result.error
  }
  return result.data
} catch (error) {
  console.error('Database error:', error)
  throw error
}
```

### 3. **Type Safety**

```typescript
// ✅ Good: Use typed interfaces
interface User {
  id: number
  name: string
  email: string
}

const result = await client.from<User>('users').select('*').execute()
```

## Troubleshooting

### Common Issues

**1. Environment Variables**
```bash
# Required for server-side
POSTGREST_URL=http://localhost:3000
POSTGREST_ANON_KEY=your_anon_key

# Required for client-side
NEXT_PUBLIC_POSTGREST_URL=http://localhost:3000
NEXT_PUBLIC_POSTGREST_ANON_KEY=your_anon_key
```

**2. CORS Configuration**
```sql
-- Enable CORS in PostgREST configuration
ALTER DATABASE your_db SET "app.cors_origin" = 'http://localhost:3001';
```

**3. Authentication Issues**
```typescript
// Ensure JWT secret matches between PostgREST and Next.js
const client = createNextJSClient({
  url: process.env.POSTGREST_URL,
  auth: {
    jwtSecret: process.env.JWT_SECRET // Must match PostgREST
  }
})
```

## Examples

- [Basic CRUD Operations](/examples/nextjs-crud)
- [Authentication Flow](/examples/nextjs-auth)
- [Real-time Chat](/examples/nextjs-realtime)
- [E-commerce Store](/examples/nextjs-ecommerce)

## API Reference

- [Pages Router API](/api/nextjs-pages)
- [Authentication](/api/nextjs-auth)
- [Middleware](/api/nextjs-middleware)