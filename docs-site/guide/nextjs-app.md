# Next.js App Router

The App Router is the modern Next.js routing system with React Server Components, streaming, and advanced caching capabilities.

## Setup

```typescript
// lib/client.ts
import { createAppClient } from 'pgrestify/nextjs'

export const client = createAppClient({
  url: process.env.POSTGREST_URL!,
  auth: {
    persistSession: true
  }
})
```

## Server Components

### Basic Data Fetching

```typescript
// app/users/page.tsx
import { client } from '../../lib/client'

interface User {
  id: number
  name: string
  email: string
}

export default async function UsersPage() {
  const result = await client
    .from<User>('users')
    .select('id', 'name', 'email')
    .execute()

  const users = result.data || []

  return (
    <div>
      <h1>Users</h1>
      {users.map(user => (
        <div key={user.id}>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  )
}
```

### With Caching (Next.js 15+)

```typescript
// app/posts/page.tsx
import { client } from '../../lib/client'

export default async function PostsPage() {
  // Force cache (equivalent to getStaticProps)
  const result = await client
    .from('posts')
    .select('*')
    .execute({
      cache: 'force-cache',
      next: { revalidate: 3600 } // Revalidate hourly
    })

  return (
    <div>
      {result.data?.map(post => (
        <article key={post.id}>
          <h1>{post.title}</h1>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  )
}
```

### With Streaming and Suspense

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { UserStats } from './UserStats'
import { RecentActivity } from './RecentActivity'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      <Suspense fallback={<div>Loading stats...</div>}>
        <UserStats />
      </Suspense>
      
      <Suspense fallback={<div>Loading activity...</div>}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}

// app/dashboard/UserStats.tsx
import { client } from '../../lib/client'

export async function UserStats() {
  const result = await client
    .from('users')
    .count()
    .execute()
  
  return <div>Total Users: {result.count}</div>
}
```

## Route Handlers

### Basic API Routes

```typescript
// app/api/users/route.ts
import { createRouteHandler } from 'pgrestify/nextjs'
import { client } from '../../../lib/client'

export const { GET, POST, PUT, DELETE } = createRouteHandler({
  GET: async (request, { params }) => {
    const result = await client
      .from('users')
      .select('*')
      .execute()
    
    return Response.json(result.data)
  },

  POST: async (request) => {
    const body = await request.json()
    
    const result = await client
      .from('users')
      .insert(body)
      .select('*')
      .single()
      .execute()
    
    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 })
    }
    
    return Response.json(result.data)
  }
})
```

### Dynamic Route Handlers

```typescript
// app/api/users/[id]/route.ts
import { createRouteHandler } from 'pgrestify/nextjs'

export const { GET, PUT, DELETE } = createRouteHandler({
  GET: async (request, { params }) => {
    const id = await params.id // Next.js 15+ async params
    
    const result = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
      .execute()
    
    if (!result.data) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }
    
    return Response.json(result.data)
  }
})
```

## Server Actions

### Form Actions

```typescript
// app/users/actions.ts
import { createServerAction } from 'pgrestify/nextjs'
import { revalidateTag } from 'next/cache'

export const createUser = createServerAction(
  async (formData: FormData, client) => {
    const userData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string
    }
    
    const result = await client
      .from('users')
      .insert(userData)
      .select('*')
      .single()
      .execute()
    
    if (result.error) {
      throw new Error(result.error.message)
    }
    
    // Revalidate users cache
    revalidateTag('users')
    
    return result.data
  }
)

// app/users/CreateUserForm.tsx
import { createUser } from './actions'

export function CreateUserForm() {
  return (
    <form action={createUser}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit">Create User</button>
    </form>
  )
}
```

### Advanced Server Actions

```typescript
// app/posts/actions.ts
import { createFormAction } from 'pgrestify/nextjs'
import { z } from 'zod'

const PostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  published: z.boolean().optional()
})

export const createPost = createFormAction('posts', {
  validation: async (formData) => {
    const data = Object.fromEntries(formData)
    return PostSchema.safeParse(data)
  },
  
  onSuccess: async (post) => {
    revalidateTag('posts')
    revalidatePath('/posts')
  },
  
  onError: async (error) => {
    console.error('Failed to create post:', error)
  }
})
```

## Client Components

### Interactive Components

```typescript
// app/users/UserTable.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'pgrestify/react'
import { client } from '../../lib/client'

export function UserTable() {
  const [searchTerm, setSearchTerm] = useState('')
  
  const { data: users, loading, refetch } = useQuery(
    client,
    'users',
    (q) => searchTerm 
      ? q.select('*').ilike('name', `%${searchTerm}%`)
      : q.select('*')
  )
  
  const deleteUser = useMutation(
    client,
    'users',
    async (id: number) => {
      return client.from('users').delete().eq('id', id).execute()
    },
    {
      onSuccess: () => refetch()
    }
  )
  
  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search users..."
      />
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table>
          {users?.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <button onClick={() => deleteUser.mutate(user.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </table>
      )}
    </div>
  )
}
```

## Caching Strategies

### Data Cache Integration

```typescript
// app/lib/data.ts
import { client } from './client'

// Static data (equivalent to getStaticProps)
export async function getCategories() {
  return client
    .from('categories')
    .select('*')
    .execute({
      cache: 'force-cache',
      next: { tags: ['categories'] }
    })
}

// Dynamic data (equivalent to getServerSideProps)
export async function getUserData(userId: string) {
  return client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
    .execute({
      cache: 'no-store' // Always fresh
    })
}

// Time-based revalidation
export async function getPopularPosts() {
  return client
    .from('posts')
    .select('*')
    .order('views', { ascending: false })
    .limit(10)
    .execute({
      next: { revalidate: 3600 } // Revalidate hourly
    })
}
```

### Cache Invalidation

```typescript
// app/actions/revalidate.ts
import { revalidateTag, revalidatePath } from 'next/cache'

export async function invalidateUserCache(userId: string) {
  revalidateTag(`user-${userId}`)
  revalidatePath('/dashboard')
}

export async function invalidateAllUsers() {
  revalidateTag('users')
  revalidatePath('/users')
}
```

## Advanced Patterns

### Parallel Data Fetching

```typescript
// app/dashboard/page.tsx
import { client } from '../../lib/client'

export default async function DashboardPage() {
  // Fetch data in parallel
  const [usersResult, postsResult, statsResult] = await Promise.all([
    client.from('users').select('*').execute(),
    client.from('posts').select('*').execute(),
    client.rpc('get_dashboard_stats').execute()
  ])
  
  return (
    <div>
      <UserStats stats={statsResult.data} />
      <UserList users={usersResult.data} />
      <PostList posts={postsResult.data} />
    </div>
  )
}
```

### Error Boundaries

```typescript
// app/error.tsx
'use client'

import { useEffect } from 'react'
import { PostgRESTError } from 'pgrestify'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App Router Error:', error)
  }, [error])

  if (error instanceof PostgRESTError) {
    return (
      <div>
        <h2>Database Error</h2>
        <p>Status: {error.statusCode}</p>
        <p>Message: {error.message}</p>
        <button onClick={reset}>Try again</button>
      </div>
    )
  }

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Next Steps

- [Server Components Deep Dive](/guide/nextjs-server-components)
- [API Routes & Handlers](/guide/nextjs-api)
- [Authentication Integration](/guide/nextjs-auth)
- [Caching Strategies](/guide/nextjs-caching)