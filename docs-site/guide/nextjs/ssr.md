# Next.js Server-Side Rendering (SSR)

Server-Side Rendering generates pages on each request, ensuring fresh data and optimal SEO performance.

## Setup

```typescript
// lib/client.ts
import { createServerClient } from '@webcoded/pgrestify/nextjs'

export const serverClient = createServerClient({
  url: process.env.POSTGREST_URL!,
  auth: {
    persistSession: false, // SSR doesn't need session persistence
    autoRefreshToken: false
  }
})

export const clientClient = createClientClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  auth: {
    persistSession: true
  }
})
```

## Pages Router SSR

### Basic getServerSideProps

```typescript
// pages/users/index.tsx
import { GetServerSideProps } from 'next'
import { serverClient } from '../../lib/client'

interface User {
  id: number
  name: string
  email: string
  lastLogin: string
}

interface UsersPageProps {
  users: User[]
  timestamp: string
}

export default function UsersPage({ users, timestamp }: UsersPageProps) {
  return (
    <div>
      <h1>Users (Updated: {new Date(timestamp).toLocaleString()})</h1>
      {users.map(user => (
        <div key={user.id}>
          <h2>{user.name}</h2>
          <p>Email: {user.email}</p>
          <p>Last Login: {new Date(user.lastLogin).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const result = await serverClient
      .from<User>('users')
      .select('id', 'name', 'email', 'lastLogin')
      .order('lastLogin', { ascending: false })
      .execute()

    return {
      props: {
        users: result.data || [],
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return {
      props: {
        users: [],
        timestamp: new Date().toISOString()
      }
    }
  }
}
```

### Dynamic Routes with SSR

```typescript
// pages/users/[id].tsx
import { GetServerSideProps } from 'next'
import { serverClient } from '../../lib/client'

interface UserProfile {
  id: number
  name: string
  email: string
  bio: string
  posts: {
    id: number
    title: string
    publishedAt: string
  }[]
}

export default function UserProfilePage({ user }: { user: UserProfile | null }) {
  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <div>
        <h2>Bio</h2>
        <p>{user.bio}</p>
      </div>
      <div>
        <h2>Recent Posts</h2>
        {user.posts.map(post => (
          <article key={post.id}>
            <h3>{post.title}</h3>
            <p>Published: {new Date(post.publishedAt).toLocaleDateString()}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!

  try {
    // Fetch user with related posts
    const [userResult, postsResult] = await Promise.all([
      serverClient
        .from('users')
        .select('id', 'name', 'email', 'bio')
        .eq('id', id)
        .single()
        .execute(),
      
      serverClient
        .from('posts')
        .select('id', 'title', 'publishedAt')
        .eq('authorId', id)
        .order('publishedAt', { ascending: false })
        .limit(5)
        .execute()
    ])

    if (!userResult.data) {
      return { notFound: true }
    }

    const user: UserProfile = {
      ...userResult.data,
      posts: postsResult.data || []
    }

    return {
      props: { user }
    }
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return { notFound: true }
  }
}
```

### Authentication-Aware SSR

```typescript
// pages/dashboard.tsx
import { GetServerSideProps } from 'next'
import { serverClient } from '../lib/client'
import { verifyToken } from '../lib/auth'

interface DashboardProps {
  user: {
    id: number
    name: string
    role: string
  }
  stats: {
    totalPosts: number
    totalViews: number
    totalComments: number
  }
}

export default function DashboardPage({ user, stats }: DashboardProps) {
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <div>
        <h2>Your Statistics</h2>
        <div>Posts: {stats.totalPosts}</div>
        <div>Views: {stats.totalViews}</div>
        <div>Comments: {stats.totalComments}</div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies.authToken

  if (!token) {
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    }
  }

  try {
    // Verify token and get user
    const payload = await verifyToken(token)
    
    // Fetch user data and statistics
    const [userResult, statsResult] = await Promise.all([
      serverClient
        .from('users')
        .select('id', 'name', 'role')
        .eq('id', payload.userId)
        .single()
        .execute(),
      
      serverClient
        .rpc('get_user_stats', { user_id: payload.userId })
        .single()
        .execute()
    ])

    if (!userResult.data) {
      return {
        redirect: {
          destination: '/login',
          permanent: false
        }
      }
    }

    return {
      props: {
        user: userResult.data,
        stats: statsResult.data || { totalPosts: 0, totalViews: 0, totalComments: 0 }
      }
    }
  } catch (error) {
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    }
  }
}
```

## App Router SSR

### Server Components with Dynamic Data

```typescript
// app/users/page.tsx
import { serverClient } from '../../lib/client'
import { headers } from 'next/headers'

interface User {
  id: number
  name: string
  email: string
  status: 'active' | 'inactive'
}

export default async function UsersPage() {
  // Headers ensure this runs on each request
  const headersList = headers()
  
  const result = await serverClient
    .from<User>('users')
    .select('id', 'name', 'email', 'status')
    .execute({
      cache: 'no-store' // Disable caching for fresh data
    })

  const users = result.data || []
  const activeUsers = users.filter(user => user.status === 'active')

  return (
    <div>
      <h1>Users ({users.length} total, {activeUsers.length} active)</h1>
      <p>Updated: {new Date().toLocaleString()}</p>
      
      <div>
        {users.map(user => (
          <div key={user.id} className={user.status === 'active' ? 'active' : 'inactive'}>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span>Status: {user.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Search with SSR

```typescript
// app/search/page.tsx
import { serverClient } from '../../lib/client'
import { SearchForm } from './SearchForm'

interface SearchPageProps {
  searchParams: { q?: string; type?: string }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: query, type = 'posts' } = searchParams
  
  let results = []
  
  if (query) {
    if (type === 'posts') {
      const result = await serverClient
        .from('posts')
        .select('id', 'title', 'content', 'authorName')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(20)
        .execute({ cache: 'no-store' })
      
      results = result.data || []
    } else if (type === 'users') {
      const result = await serverClient
        .from('users')
        .select('id', 'name', 'email')
        .ilike('name', `%${query}%`)
        .limit(20)
        .execute({ cache: 'no-store' })
      
      results = result.data || []
    }
  }

  return (
    <div>
      <h1>Search</h1>
      <SearchForm initialQuery={query} initialType={type} />
      
      {query && (
        <div>
          <h2>Results for "{query}" in {type}</h2>
          <p>Found {results.length} results</p>
          
          {type === 'posts' && (
            <div>
              {results.map((post: any) => (
                <article key={post.id}>
                  <h3>{post.title}</h3>
                  <p>{post.content.substring(0, 200)}...</p>
                  <small>By {post.authorName}</small>
                </article>
              ))}
            </div>
          )}
          
          {type === 'users' && (
            <div>
              {results.map((user: any) => (
                <div key={user.id}>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// app/search/SearchForm.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

interface SearchFormProps {
  initialQuery?: string
  initialType?: string
}

export function SearchForm({ initialQuery = '', initialType = 'posts' }: SearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [type, setType] = useState(initialType)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    startTransition(() => {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (type) params.set('type', type)
      
      router.push(`/search?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        disabled={isPending}
      />
      
      <select 
        value={type} 
        onChange={(e) => setType(e.target.value)}
        disabled={isPending}
      >
        <option value="posts">Posts</option>
        <option value="users">Users</option>
      </select>
      
      <button type="submit" disabled={isPending}>
        {isPending ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
}
```

## Real-time SSR with Subscriptions

### Live Data Updates

```typescript
// app/live-feed/page.tsx
import { serverClient } from '../../lib/client'
import { LiveFeedClient } from './LiveFeedClient'

export default async function LiveFeedPage() {
  // Get initial data server-side
  const result = await serverClient
    .from('posts')
    .select('id', 'title', 'content', 'authorName', 'createdAt')
    .order('createdAt', { ascending: false })
    .limit(10)
    .execute({ cache: 'no-store' })

  const initialPosts = result.data || []

  return (
    <div>
      <h1>Live Feed</h1>
      <LiveFeedClient initialPosts={initialPosts} />
    </div>
  )
}

// app/live-feed/LiveFeedClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { clientClient } from '../../lib/client'

interface Post {
  id: number
  title: string
  content: string
  authorName: string
  createdAt: string
}

export function LiveFeedClient({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts)

  useEffect(() => {
    // Subscribe to new posts
    const subscription = clientClient
      .from('posts')
      .on('INSERT', (payload) => {
        setPosts(current => [payload.new, ...current])
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div>
      <p>Posts update in real-time</p>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
          <small>
            By {post.authorName} at {new Date(post.createdAt).toLocaleString()}
          </small>
        </article>
      ))}
    </div>
  )
}
```

## Performance Optimization

### Request Deduplication

```typescript
// lib/server-cache.ts
import { unstable_cache } from 'next/cache'
import { serverClient } from './client'

export const getCachedUser = unstable_cache(
  async (userId: number) => {
    const result = await serverClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
      .execute()
    
    return result.data
  },
  ['user'],
  {
    revalidate: 300, // 5 minutes
    tags: ['users']
  }
)

export const getCachedPosts = unstable_cache(
  async (authorId?: number) => {
    let query = serverClient
      .from('posts')
      .select('*')
      .order('createdAt', { ascending: false })

    if (authorId) {
      query = query.eq('authorId', authorId)
    }

    const result = await query.limit(20).execute()
    return result.data || []
  },
  ['posts'],
  {
    revalidate: 60, // 1 minute
    tags: ['posts']
  }
)
```

### Streaming SSR

```typescript
// app/dashboard/isLoading.tsx
export default function Loading() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div>Loading your data...</div>
      <div className="skeleton">
        <div className="skeleton-line"></div>
        <div className="skeleton-line"></div>
        <div className="skeleton-line"></div>
      </div>
    </div>
  )
}

// app/dashboard/page.tsx
import { Suspense } from 'react'
import { UserStats } from './UserStats'
import { RecentActivity } from './RecentActivity'
import { QuickActions } from './QuickActions'

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
      
      <QuickActions /> {/* No suspense - renders immediately */}
    </div>
  )
}
```

## Error Handling

### Server Error Boundaries

```typescript
// app/error.tsx
'use client'

import { useEffect } from 'react'
import { PostgRESTError } from '@webcoded/pgrestify'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('SSR Error:', error)
  }, [error])

  if (error instanceof PostgRESTError) {
    return (
      <div className="error-boundary">
        <h2>Database Error</h2>
        <p>Status: {error.statusCode}</p>
        <p>Message: {error.message}</p>
        <button onClick={reset}>Try again</button>
      </div>
    )
  }

  return (
    <div className="error-boundary">
      <h2>Something went wrong!</h2>
      <details>
        <summary>Error details</summary>
        <pre>{error.message}</pre>
      </details>
      <button onClick={reset}>Try again</button>
    </div>
  )
}

// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="not-found">
      <h2>Not Found</h2>
      <p>Could not find the requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

## SEO and Metadata

### Dynamic Metadata Generation

```typescript
// app/posts/[id]/page.tsx
import { Metadata } from 'next'
import { serverClient } from '../../../lib/client'
import { notFound } from 'next/navigation'

interface Post {
  id: number
  title: string
  content: string
  excerpt: string
  authorName: string
  createdAt: string
  tags: string[]
}

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const result = await serverClient
    .from('posts')
    .select('title', 'excerpt', 'authorName', 'tags')
    .eq('id', params.id)
    .single()
    .execute()

  const post = result.data

  if (!post) {
    return {
      title: 'Post Not Found'
    }
  }

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.authorName }],
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      authors: [post.authorName]
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt
    }
  }
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const result = await serverClient
    .from<Post>('posts')
    .select('*')
    .eq('id', params.id)
    .single()
    .execute({ cache: 'no-store' })

  if (!result.data) {
    notFound()
  }

  const post = result.data

  return (
    <article>
      <h1>{post.title}</h1>
      <div>
        <p>By {post.authorName}</p>
        <p>Published: {new Date(post.createdAt).toLocaleDateString()}</p>
        <div>Tags: {post.tags.join(', ')}</div>
      </div>
      <div>
        {post.content.split('\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  )
}
```

## Best Practices

### 1. Data Fetching Strategy
```typescript
// Use SSR for:
// - User-specific content
// - Real-time data
// - Search results
// - Authentication-dependent pages

// Use SSG with ISR for:
// - Public content
// - Content that changes occasionally
// - SEO-critical pages
```

### 2. Performance Considerations
```typescript
// Optimize database queries
const optimizedQuery = serverClient
  .from('posts')
  .select('id', 'title', 'excerpt') // Only needed fields
  .limit(10) // Pagination
  .order('createdAt', { ascending: false })
  .execute({
    cache: 'no-store', // Fresh data for SSR
    next: { 
      tags: ['posts'] // For targeted revalidation
    }
  })
```

### 3. Security Best Practices
```typescript
// Validate server-side inputs
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!
  
  // Validate input
  if (!id || isNaN(Number(id))) {
    return { notFound: true }
  }
  
  // Use parameterized queries (automatically handled by PGRestify)
  const result = await serverClient
    .from('posts')
    .select('*')
    .eq('id', Number(id))
    .single()
    .execute()
  
  return {
    props: {
      post: result.data
    }
  }
}
```

## Next Steps

- [Next.js Caching Strategies](./caching.md)
- [Authentication with Next.js](./auth.md)