# Next.js Server Components Deep Dive

React Server Components (RSC) in Next.js 13+ provide a new paradigm for building performant, server-first applications with PGRestify.

## Understanding Server Components

### The Server Component Model

Server Components run exclusively on the server and send their rendered output to the client as HTML. This enables:

- **Direct database access** without API routes
- **Zero client-side JavaScript** for static components
- **Automatic code splitting** at the component level
- **Streaming rendering** with Suspense boundaries

## Basic Server Components

### Simple Data Fetching

```typescript
// app/components/UserList.tsx
import { client } from '../../lib/client'

export async function UserList() {
  const result = await client
    .from('users')
    .select('*')
    .execute()
  
  return (
    <ul>
      {result.data?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

### With Error Handling

```typescript
// app/components/PostList.tsx
import { client } from '../../lib/client'
import { PostgRESTError } from 'pgrestify'

export async function PostList() {
  try {
    const result = await client
      .from('posts')
      .select('*')
      .eq('published', true)
      .execute()
    
    if (result.error) {
      throw result.error
    }
    
    return (
      <div>
        {result.data?.map(post => (
          <article key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
          </article>
        ))}
      </div>
    )
  } catch (error) {
    if (error instanceof PostgRESTError) {
      return <div>Database error: {error.message}</div>
    }
    return <div>Something went wrong</div>
  }
}
```

## Streaming with Suspense

### Progressive Loading

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { Analytics } from './Analytics'
import { RecentActivity } from './RecentActivity'
import { UserStats } from './UserStats'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Load critical content first */}
      <Suspense fallback={<StatsPlaceholder />}>
        <UserStats />
      </Suspense>
      
      {/* Stream in non-critical content */}
      <Suspense fallback={<ActivityPlaceholder />}>
        <RecentActivity />
      </Suspense>
      
      {/* Load heavy analytics last */}
      <Suspense fallback={<AnalyticsPlaceholder />}>
        <Analytics />
      </Suspense>
    </div>
  )
}
```

### Parallel Data Loading

```typescript
// app/profile/[id]/page.tsx
import { notFound } from 'next/navigation'
import { client } from '../../../lib/client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params
  
  // Parallel data fetching
  const [userResult, postsResult, followersResult] = await Promise.all([
    client.from('users').select('*').eq('id', id).single().execute(),
    client.from('posts').select('*').eq('user_id', id).execute(),
    client.from('followers').select('count').eq('user_id', id).execute()
  ])
  
  if (!userResult.data) {
    notFound()
  }
  
  return (
    <div>
      <h1>{userResult.data.name}</h1>
      <p>Posts: {postsResult.data?.length || 0}</p>
      <p>Followers: {followersResult.count || 0}</p>
    </div>
  )
}
```

## Component Composition Patterns

### Server and Client Boundary

```typescript
// app/posts/PostCard.tsx (Server Component)
import { client } from '../../lib/client'
import { LikeButton } from './LikeButton'

export async function PostCard({ postId }: { postId: number }) {
  const result = await client
    .from('posts')
    .select('*, author:users(*)')
    .eq('id', postId)
    .single()
    .execute()
  
  const post = result.data
  
  return (
    <article>
      <h2>{post.title}</h2>
      <p>By {post.author.name}</p>
      <div>{post.content}</div>
      {/* Client Component for interactivity */}
      <LikeButton postId={postId} initialLikes={post.likes} />
    </article>
  )
}

// app/posts/LikeButton.tsx (Client Component)
'use client'

import { useState } from 'react'
import { likePost } from './actions'

export function LikeButton({ postId, initialLikes }: { 
  postId: number
  initialLikes: number 
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [isLiking, setIsLiking] = useState(false)
  
  async function handleLike() {
    setIsLiking(true)
    const newLikes = await likePost(postId)
    setLikes(newLikes)
    setIsLiking(false)
  }
  
  return (
    <button onClick={handleLike} disabled={isLiking}>
      ❤️ {likes}
    </button>
  )
}
```

## Advanced Patterns

### Conditional Rendering

```typescript
// app/admin/AdminPanel.tsx
import { client } from '../../lib/client'
import { getServerSession } from '../lib/auth'
import { redirect } from 'next/navigation'

export async function AdminPanel() {
  const session = await getServerSession()
  
  if (!session || session.user.role !== 'admin') {
    redirect('/unauthorized')
  }
  
  const result = await client
    .from('admin_metrics')
    .select('*')
    .execute()
  
  return (
    <div>
      <h1>Admin Dashboard</h1>
      {/* Admin-only content */}
    </div>
  )
}
```

### Nested Server Components

```typescript
// app/blog/BlogPost.tsx
import { client } from '../../lib/client'
import { CommentList } from './CommentList'

export async function BlogPost({ slug }: { slug: string }) {
  const result = await client
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .single()
    .execute()
  
  const post = result.data
  
  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
      {/* Nested server component */}
      <CommentList postId={post.id} />
    </article>
  )
}

// app/blog/CommentList.tsx
export async function CommentList({ postId }: { postId: number }) {
  const result = await client
    .from('comments')
    .select('*, author:users(name, avatar)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .execute()
  
  return (
    <div>
      <h2>Comments</h2>
      {result.data?.map(comment => (
        <div key={comment.id}>
          <img src={comment.author.avatar} alt={comment.author.name} />
          <strong>{comment.author.name}</strong>
          <p>{comment.content}</p>
        </div>
      ))}
    </div>
  )
}
```

## Performance Optimization

### Request Deduplication

```typescript
// lib/client.ts
import { createNextJSClient } from 'pgrestify/nextjs'
import { cache } from 'react'

// Create a cached client for request deduplication
export const getCachedClient = cache(() => {
  return createNextJSClient({
    url: process.env.POSTGREST_URL!,
    options: {
      dedupeRequests: true
    }
  })
})

// Use in components
export async function Component() {
  const client = getCachedClient()
  // Multiple calls to the same query will be deduped
  const result = await client.from('users').select('*').execute()
}
```

### Partial Prerendering

```typescript
// app/product/[id]/page.tsx
export const dynamic = 'force-static'
export const revalidate = 3600 // 1 hour

export async function generateStaticParams() {
  const client = getCachedClient()
  const result = await client
    .from('products')
    .select('id')
    .execute()
  
  return result.data?.map(product => ({
    id: product.id.toString()
  })) || []
}

export default async function ProductPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const client = getCachedClient()
  
  const result = await client
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
    .execute()
  
  return <ProductDetails product={result.data} />
}
```

## Error Boundaries

### Component-Level Error Handling

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
    console.error('Server Component Error:', error)
  }, [error])
  
  if (error instanceof PostgRESTError) {
    return (
      <div>
        <h2>Database Error</h2>
        <p>We couldn't load the data. Please try again.</p>
        <button onClick={reset}>Retry</button>
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

### Not Found Handling

```typescript
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find the requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

## Testing Server Components

### Unit Testing

```typescript
// __tests__/UserList.test.tsx
import { render } from '@testing-library/react'
import { UserList } from '../app/components/UserList'

// Mock the client
jest.mock('../lib/client', () => ({
  client: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]
    })
  }
}))

describe('UserList', () => {
  it('renders users', async () => {
    const component = await UserList()
    const { container } = render(component)
    
    expect(container.textContent).toContain('John')
    expect(container.textContent).toContain('Jane')
  })
})
```

## Best Practices

### 1. **Data Fetching Location**
- Fetch data as close to where it's used as possible
- Use Server Components for data fetching by default
- Only use Client Components when interactivity is needed

### 2. **Component Boundaries**
- Keep Server Components pure (no event handlers, hooks)
- Pass serializable props between Server and Client Components
- Use composition to minimize Client Component bundles

### 3. **Performance**
- Leverage streaming for progressive rendering
- Use Suspense boundaries strategically
- Implement proper caching strategies
- Deduplicate requests within a single render

### 4. **Error Handling**
- Implement error boundaries at appropriate levels
- Provide meaningful error messages
- Include retry mechanisms where appropriate
- Log errors for monitoring

## Common Pitfalls

### ❌ **Don't: Mix Server and Client Logic**
```typescript
// Bad: Trying to use hooks in Server Component
export async function ServerComponent() {
  const [state, setState] = useState() // Error!
  // ...
}
```

### ✅ **Do: Separate Concerns**
```typescript
// Good: Server Component for data
export async function ServerComponent() {
  const data = await fetchData()
  return <ClientComponent data={data} />
}

// Good: Client Component for interactivity
'use client'
export function ClientComponent({ data }) {
  const [state, setState] = useState(data)
  // ...
}
```

## Next Steps

- [API Routes](/guide/nextjs-api)
- [Caching Strategies](/guide/nextjs-caching)
- [Authentication](/guide/nextjs-auth)
- [Production Deployment](/guide/production)