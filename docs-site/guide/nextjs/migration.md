# Next.js Migration Guide

Complete guide for migrating your Next.js application to PGRestify from other data fetching solutions, including Supabase, Prisma, and direct PostgREST implementations.

## Overview

This guide covers migration strategies for:
- Direct PostgREST/fetch implementations
- Supabase client libraries
- Prisma ORM
- Other PostgreSQL clients
- Pages Router to App Router migration

## Migration from Direct PostgREST

### Before: Direct Fetch Calls

```typescript
// Before: Direct fetch with PostgREST
async function getUsers() {
  const response = await fetch(`${POSTGREST_URL}/users?select=*`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch users')
  }
  
  return response.json()
}

// Complex query with joins
async function getPostsWithAuthors() {
  const url = `${POSTGREST_URL}/posts?select=*,author:users(name,email)&order=created_at.desc&limit=10`
  const response = await fetch(url, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  })
  
  return response.json()
}
```

### After: PGRestify Client

```typescript
// After: PGRestify client
import { createNextJSClient } from 'pgrestify/nextjs'

const client = createNextJSClient({
  url: process.env.POSTGREST_URL!,
  auth: {
    anonKey: process.env.ANON_KEY!
  }
})

async function getUsers() {
  const result = await client
    .from('users')
    .select('*')
    .execute()
  
  if (result.error) {
    throw result.error
  }
  
  return result.data
}

// Complex query with type safety
async function getPostsWithAuthors() {
  const result = await client
    .from('posts')
    .select('*, author:users(name, email)')
    .order('created_at', { ascending: false })
    .limit(10)
    .execute()
  
  return result.data
}
```

## Migration from Supabase

### Authentication Migration

```typescript
// Before: Supabase Auth
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get session
const { data: { session } } = await supabase.auth.getSession()
```

```typescript
// After: PGRestify Auth
import { createNextJSClient } from 'pgrestify/nextjs'

const client = createNextJSClient({
  url: process.env.POSTGREST_URL!,
  auth: {
    persistSession: true
  }
})

// Sign up
const result = await client.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Sign in
const result = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password'
})

// Get session
const session = await client.auth.getSession()
```

### Database Queries Migration

```typescript
// Before: Supabase Database
// Simple query
const { data, error } = await supabase
  .from('users')
  .select('*')

// Insert
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'New Post', content: 'Content' })
  .select()

// Update
const { data, error } = await supabase
  .from('posts')
  .update({ title: 'Updated' })
  .eq('id', 1)
  .select()

// Delete
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', 1)

// RPC
const { data, error } = await supabase
  .rpc('get_user_stats', { user_id: 1 })
```

```typescript
// After: PGRestify
// Simple query
const result = await client
  .from('users')
  .select('*')
  .execute()

// Insert
const result = await client
  .from('posts')
  .insert({ title: 'New Post', content: 'Content' })
  .select('*')
  .execute()

// Update
const result = await client
  .from('posts')
  .update({ title: 'Updated' })
  .eq('id', 1)
  .select('*')
  .execute()

// Delete
const result = await client
  .from('posts')
  .delete()
  .eq('id', 1)
  .execute()

// RPC
const result = await client
  .rpc('get_user_stats', { user_id: 1 })
  .execute()
```

### Real-time Migration

```typescript
// Before: Supabase Realtime
const channel = supabase
  .channel('posts')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'posts' },
    (payload) => {
      console.log('New post:', payload.new)
    }
  )
  .subscribe()

// Cleanup
channel.unsubscribe()
```

```typescript
// After: PGRestify Realtime
const subscription = client
  .from('posts')
  .on('INSERT', (payload) => {
    console.log('New post:', payload.new)
  })
  .subscribe()

// Cleanup
subscription.unsubscribe()
```

## Migration from Prisma

### Schema to Types Migration

```typescript
// Before: Prisma Schema
// schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}
```

```typescript
// After: PGRestify Types
// Generate types from PostgREST schema
npx pgrestify generate --url http://localhost:3000 --output ./src/types

// Or define manually
interface User {
  id: number
  email: string
  name?: string
  created_at: string
}

interface Post {
  id: number
  title: string
  content?: string
  published: boolean
  author_id: number
}
```

### Query Migration

```typescript
// Before: Prisma Queries
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Find many
const users = await prisma.user.findMany({
  where: {
    email: { contains: '@example.com' }
  },
  include: {
    posts: true
  },
  orderBy: {
    createdAt: 'desc'
  },
  take: 10,
  skip: 20
})

// Find unique
const user = await prisma.user.findUnique({
  where: { id: 1 }
})

// Create
const user = await prisma.user.create({
  data: {
    email: 'new@example.com',
    name: 'New User'
  }
})

// Update
const user = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Updated Name' }
})

// Delete
await prisma.user.delete({
  where: { id: 1 }
})

// Transactions
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.post.create({ data: postData })
])
```

```typescript
// After: PGRestify Queries
import { createNextJSClient } from 'pgrestify/nextjs'

const client = createNextJSClient({ url: process.env.POSTGREST_URL! })

// Find many
const result = await client
  .from('users')
  .select('*, posts(*)')
  .ilike('email', '%@example.com%')
  .order('created_at', { ascending: false })
  .range(20, 29) // Skip 20, take 10
  .execute()

// Find unique
const result = await client
  .from('users')
  .select('*')
  .eq('id', 1)
  .single()
  .execute()

// Create
const result = await client
  .from('users')
  .insert({
    email: 'new@example.com',
    name: 'New User'
  })
  .select('*')
  .single()
  .execute()

// Update
const result = await client
  .from('users')
  .update({ name: 'Updated Name' })
  .eq('id', 1)
  .select('*')
  .single()
  .execute()

// Delete
const result = await client
  .from('users')
  .delete()
  .eq('id', 1)
  .execute()

// Transactions (using RPC)
const result = await client
  .rpc('create_user_and_post', {
    user_data: userData,
    post_data: postData
  })
  .execute()
```

### Repository Pattern Migration

```typescript
// Before: Prisma Repository Pattern
class UserRepository {
  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: { posts: true }
    })
  }
  
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    })
  }
  
  async create(data: CreateUserDto) {
    return prisma.user.create({ data })
  }
}
```

```typescript
// After: PGRestify Repository Pattern
import { Repository } from 'pgrestify'

class UserRepository extends Repository<User> {
  constructor(client: PostgRESTClient) {
    super(client, 'users')
  }
  
  async findById(id: number) {
    return this.findOne({
      filters: { id },
      select: '*, posts(*)'
    })
  }
  
  async findByEmail(email: string) {
    return this.findOne({
      filters: { email }
    })
  }
  
  async create(data: CreateUserDto) {
    return this.insert(data)
  }
}

// Or use the built-in repository
const userRepo = client.getRepository<User>('users')
const user = await userRepo.findOne({ id: 1 })
```

## Pages Router to App Router Migration

### Data Fetching Migration

```typescript
// Before: Pages Router with getServerSideProps
// pages/users.tsx
export async function getServerSideProps() {
  const result = await client
    .from('users')
    .select('*')
    .execute()
  
  return {
    props: {
      users: result.data || []
    }
  }
}

export default function UsersPage({ users }) {
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

```typescript
// After: App Router with Server Components
// app/users/page.tsx
export default async function UsersPage() {
  const result = await client
    .from('users')
    .select('*')
    .execute()
  
  const users = result.data || []
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

### API Routes Migration

```typescript
// Before: Pages Router API Route
// pages/api/users.ts
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const result = await client.from('users').select('*').execute()
    res.status(200).json(result.data)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
```

```typescript
// After: App Router Route Handler
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const result = await client.from('users').select('*').execute()
  return NextResponse.json(result.data)
}
```

## Migration Checklist

### Pre-Migration

- [ ] Audit current data fetching patterns
- [ ] Identify authentication requirements
- [ ] Document current API endpoints
- [ ] Plan migration phases
- [ ] Set up test environment

### Phase 1: Setup

- [ ] Install PGRestify
- [ ] Configure environment variables
- [ ] Set up client instances
- [ ] Generate TypeScript types
- [ ] Create test suite

### Phase 2: Authentication

- [ ] Migrate auth configuration
- [ ] Update sign up/sign in flows
- [ ] Migrate session management
- [ ] Update protected routes
- [ ] Test auth flows

### Phase 3: Data Fetching

- [ ] Replace database queries
- [ ] Update API routes/handlers
- [ ] Migrate real-time subscriptions
- [ ] Update cache strategies
- [ ] Implement error handling

### Phase 4: Testing

- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Performance testing
- [ ] User acceptance testing
- [ ] Fix identified issues

### Phase 5: Deployment

- [ ] Update CI/CD pipelines
- [ ] Configure production environment
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production

## Common Migration Patterns

### Gradual Migration

```typescript
// Use adapter pattern for gradual migration
class DataAdapter {
  private pgrestify: PostgRESTClient
  private supabase?: SupabaseClient
  
  constructor() {
    this.pgrestify = createNextJSClient({ /* config */ })
    // Keep old client during migration
    this.supabase = createClient(url, key)
  }
  
  async getUsers() {
    // Use feature flag to switch implementations
    if (process.env.USE_PGRESTIFY === 'true') {
      const result = await this.pgrestify.from('users').select('*').execute()
      return result.data
    } else {
      const { data } = await this.supabase.from('users').select('*')
      return data
    }
  }
}
```

### Parallel Running

```typescript
// Run both implementations in parallel for comparison
async function compareImplementations() {
  const [oldResult, newResult] = await Promise.all([
    oldClient.from('users').select('*'),
    newClient.from('users').select('*').execute()
  ])
  
  // Log differences for monitoring
  if (JSON.stringify(oldResult.data) !== JSON.stringify(newResult.data)) {
    console.warn('Implementation mismatch detected')
  }
  
  return newResult.data
}
```

## Troubleshooting

### Common Issues

**1. Type Mismatches**
```typescript
// Solution: Generate types from PostgREST schema
npx pgrestify generate --url $POSTGREST_URL --output ./src/types
```

**2. Authentication Errors**
```typescript
// Solution: Ensure JWT secret matches
const client = createNextJSClient({
  auth: {
    jwtSecret: process.env.JWT_SECRET // Must match PostgREST
  }
})
```

**3. Query Syntax Differences**
```typescript
// Map old syntax to new
function mapSupabaseQuery(query) {
  // Supabase: .single()
  // PGRestify: .single().execute()
  
  // Supabase: .select('*, users!inner(*)')
  // PGRestify: .select('*, users(*)').innerJoin('users')
}
```

**4. Real-time Connection Issues**
```typescript
// Ensure WebSocket URL is configured
const client = createNextJSClient({
  realtime: {
    url: process.env.REALTIME_URL || 'ws://localhost:3000'
  }
})
```

## Performance Optimization

### After Migration

1. **Enable Query Caching**
```typescript
const client = createNextJSClient({
  cache: {
    enabled: true,
    ttl: 3600
  }
})
```

2. **Optimize Bundle Size**
```typescript
// Import only what you need
import { createClient } from 'pgrestify/core'
// Instead of
import { createNextJSClient } from 'pgrestify/nextjs'
```

3. **Use Connection Pooling**
```typescript
const client = createNextJSClient({
  connection: {
    poolSize: 10,
    keepAlive: true
  }
})
```

## Resources

### Documentation
- [PGRestify API Reference](/api/client)
- [PostgREST Documentation](https://postgrest.org)
- [Next.js Documentation](https://nextjs.org/docs)

### Migration Tools
- [Schema Generator CLI](/guide/cli)
- [Type Generator](/guide/types)
- [Migration Scripts](https://github.com/pgrestify/migration-scripts)

### Support
- [GitHub Issues](https://github.com/pgrestify/pgrestify/issues)
- [Discord Community](https://discord.gg/pgrestify)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/pgrestify)

## Next Steps

- [Performance Optimization](./caching.md)
- [Authentication](./auth.md)
- [Production Deployment](../production/deployment.md)
- [Real-time Features](../advanced-features/realtime.md)