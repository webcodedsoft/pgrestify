# Next.js Caching Strategies

Optimize your Next.js application performance with PGRestify's comprehensive caching strategies across different rendering modes and data fetching patterns.

## Overview

Next.js provides multiple caching layers that PGRestify integrates with:
- **Request Memoization**: Deduplicates requests during a single render
- **Data Cache**: Persistent cache across requests (App Router)
- **Full Route Cache**: Caches entire route output
- **Router Cache**: Client-side navigation cache
- **PGRestify Query Cache**: Application-level query caching

## Caching Fundamentals

### Next.js Cache Hierarchy

```
Client Request
    ↓
Router Cache (Client)
    ↓
Full Route Cache (Server)
    ↓
Data Cache (Server)
    ↓
Request Memoization (Server)
    ↓
Database Query
```

## App Router Caching

### Data Cache Integration

```typescript
// lib/cached-client.ts
import { createNextJSClient } from 'pgrestify/nextjs'
import { unstable_cache } from 'next/cache'

export const client = createNextJSClient({
  url: process.env.POSTGREST_URL!,
  cache: {
    enabled: true,
    defaultTTL: 3600 // 1 hour default
  }
})

// Create cached query function
export const getCachedUsers = unstable_cache(
  async () => {
    const result = await client
      .from('users')
      .select('*')
      .execute()
    return result.data
  },
  ['users'], // Cache key
  {
    revalidate: 3600, // Revalidate after 1 hour
    tags: ['users'] // Cache tags for invalidation
  }
)
```

### Force Cache vs No Store

```typescript
// app/products/page.tsx

// Static rendering with cache
async function getStaticProducts() {
  const result = await client
    .from('products')
    .select('*')
    .execute({
      cache: 'force-cache', // Cache indefinitely
      next: {
        revalidate: 86400, // Revalidate daily
        tags: ['products']
      }
    })
  
  return result.data
}

// Dynamic rendering without cache
async function getDynamicInventory() {
  const result = await client
    .from('inventory')
    .select('*')
    .execute({
      cache: 'no-store' // Always fetch fresh data
    })
  
  return result.data
}
```

### Time-based Revalidation

```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600 // Page-level revalidation

export default async function BlogPost({ params }) {
  const { slug } = await params
  
  // This query will be cached for 1 hour
  const result = await client
    .from('posts')
    .select('*, author:users(*), comments(*)')
    .eq('slug', slug)
    .single()
    .execute()
  
  return <Article post={result.data} />
}
```

### On-Demand Revalidation

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { type, value } = await request.json()
  
  try {
    if (type === 'tag') {
      // Revalidate all cached data with this tag
      revalidateTag(value)
    } else if (type === 'path') {
      // Revalidate specific path
      revalidatePath(value)
    }
    
    return NextResponse.json({ revalidated: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

## Pages Router Caching

### Static Generation (SSG)

```typescript
// pages/products.tsx
import { createGetStaticProps } from 'pgrestify/nextjs'

export const getStaticProps = createGetStaticProps(
  async (client) => {
    const result = await client
      .from('products')
      .select('*')
      .eq('active', true)
      .execute()
    
    return {
      products: result.data || []
    }
  },
  {
    revalidate: 3600 // ISR: Revalidate every hour
  }
)
```

### Server-Side Rendering (SSR) with Cache

```typescript
// pages/dashboard.tsx
import { createGetServerSideProps } from 'pgrestify/nextjs'

export const getServerSideProps = createGetServerSideProps(
  async (client, context) => {
    const result = await client
      .from('dashboard_stats')
      .select('*')
      .single()
      .execute()
    
    // Set cache headers
    context.res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120'
    )
    
    return {
      stats: result.data
    }
  }
)
```

## Query-Level Caching

### PGRestify Query Cache

```typescript
// lib/query-cache.ts
import { MemoryQueryCache } from 'pgrestify'

// Create a shared cache instance
export const queryCache = new MemoryQueryCache({
  maxSize: 100, // Maximum cached queries
  ttl: 60 * 1000, // 1 minute default TTL
  staleWhileRevalidate: true
})

// Use with client
const client = createNextJSClient({
  url: process.env.POSTGREST_URL!,
  cache: queryCache
})
```

### Cache Key Generation

```typescript
// lib/cache-keys.ts
import { CacheKeyBuilder } from 'pgrestify'

export function getUserCacheKey(userId: string, filters?: any) {
  return new CacheKeyBuilder('users')
    .withId(userId)
    .withFilters(filters)
    .build()
}

// Usage
const cacheKey = getUserCacheKey('123', { active: true })
const result = await client
  .from('users')
  .select('*')
  .eq('id', '123')
  .eq('active', true)
  .execute({ cacheKey })
```

### Conditional Caching

```typescript
// app/api/data/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const useCache = searchParams.get('cache') !== 'false'
  
  const result = await client
    .from('data')
    .select('*')
    .execute({
      cache: useCache ? {
        ttl: 300, // 5 minutes
        key: `data-${searchParams.toString()}`
      } : false
    })
  
  return Response.json(result.data)
}
```

## Client-Side Caching

### React Query Integration

```typescript
// hooks/useProducts.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/client'

export function useProducts(category?: string) {
  return useQuery({
    queryKey: ['products', category],
    queryFn: async () => {
      const query = client.from('products').select('*')
      if (category) {
        query.eq('category', category)
      }
      const result = await query.execute()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  })
}

// Invalidate cache
export function useInvalidateProducts() {
  const queryClient = useQueryClient()
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }
}
```

### SWR Integration

```typescript
// hooks/useSWRProducts.ts
import useSWR from 'swr'
import { client } from '../lib/client'

const fetcher = async (table: string, filters?: any) => {
  const query = client.from(table).select('*')
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query.eq(key, value)
    })
  }
  
  const result = await query.execute()
  return result.data
}

export function useProducts(category?: string) {
  const { data, error, mutate } = useSWR(
    ['products', { category }],
    ([table, filters]) => fetcher(table, filters),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 60000 // Refresh every minute
    }
  )
  
  return {
    products: data,
    isLoading: !error && !data,
    isError: error,
    mutate
  }
}
```

## Edge Caching

### Edge Runtime Cache

```typescript
// app/api/edge-cached/route.ts
export const runtime = 'edge'

const cache = new Map()

export async function GET(request: Request) {
  const url = new URL(request.url)
  const cacheKey = url.pathname + url.search
  
  // Check edge cache
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return Response.json(cached.data)
  }
  
  // Fetch fresh data
  const result = await client
    .from('data')
    .select('*')
    .execute()
  
  // Update cache
  cache.set(cacheKey, {
    data: result.data,
    expires: Date.now() + 60000 // 1 minute
  })
  
  return Response.json(result.data)
}
```

### CDN Cache Headers

```typescript
// app/api/cdn-cached/route.ts
export async function GET(request: Request) {
  const result = await client
    .from('static_content')
    .select('*')
    .execute()
  
  return Response.json(result.data, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'max-age=86400',
      'Surrogate-Control': 'max-age=31536000',
      'Surrogate-Key': 'static-content'
    }
  })
}
```

## Advanced Caching Patterns

### Stale-While-Revalidate

```typescript
// lib/swr-cache.ts
class SWRCache {
  private cache = new Map()
  private revalidating = new Map()
  
  async get(key: string, fetcher: () => Promise<any>, options = {}) {
    const { ttl = 60000, staleTime = 300000 } = options
    const cached = this.cache.get(key)
    const now = Date.now()
    
    // Return cached if fresh
    if (cached && cached.expires > now) {
      return cached.data
    }
    
    // Return stale and revalidate in background
    if (cached && cached.staleExpires > now) {
      if (!this.revalidating.has(key)) {
        this.revalidating.set(key, true)
        fetcher().then(data => {
          this.cache.set(key, {
            data,
            expires: now + ttl,
            staleExpires: now + staleTime
          })
          this.revalidating.delete(key)
        })
      }
      return cached.data
    }
    
    // Fetch fresh data
    const data = await fetcher()
    this.cache.set(key, {
      data,
      expires: now + ttl,
      staleExpires: now + staleTime
    })
    
    return data
  }
  
  invalidate(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }
}

export const swrCache = new SWRCache()
```

### Hierarchical Cache Invalidation

```typescript
// lib/cache-invalidation.ts
import { revalidateTag } from 'next/cache'

class CacheInvalidator {
  private dependencies = new Map<string, string[]>()
  
  constructor() {
    // Define cache dependencies
    this.dependencies.set('users', ['posts', 'comments'])
    this.dependencies.set('posts', ['comments'])
  }
  
  async invalidate(tag: string) {
    // Invalidate the tag itself
    revalidateTag(tag)
    
    // Invalidate dependent tags
    const deps = this.dependencies.get(tag) || []
    for (const dep of deps) {
      revalidateTag(dep)
    }
  }
  
  async invalidateUser(userId: string) {
    revalidateTag(`user-${userId}`)
    revalidateTag(`user-posts-${userId}`)
    revalidateTag(`user-comments-${userId}`)
  }
}

export const cacheInvalidator = new CacheInvalidator()
```

### Partial Cache Updates

```typescript
// lib/partial-cache.ts
export async function updateCachedItem<T>(
  cacheKey: string,
  itemId: string | number,
  updates: Partial<T>
) {
  const cached = queryCache.get(cacheKey)
  
  if (cached && Array.isArray(cached)) {
    const updatedItems = cached.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    )
    queryCache.set(cacheKey, updatedItems)
  }
}

// Usage after mutation
const result = await client
  .from('posts')
  .update({ title: 'New Title' })
  .eq('id', postId)
  .execute()

if (result.data) {
  updateCachedItem('posts', postId, result.data)
}
```

## Cache Warming

### Preload Critical Data

```typescript
// app/layout.tsx
import { headers } from 'next/headers'

async function preloadData() {
  // Preload critical data in parallel
  await Promise.all([
    client.from('navigation').select('*').execute(),
    client.from('user_preferences').select('*').execute(),
    client.from('feature_flags').select('*').execute()
  ])
}

export default async function RootLayout({ children }) {
  // Warm cache on first request
  await preloadData()
  
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

### Background Revalidation

```typescript
// lib/background-revalidation.ts
import { unstable_noStore as noStore } from 'next/cache'

export function startBackgroundRevalidation() {
  if (typeof window === 'undefined') {
    // Server-side only
    setInterval(async () => {
      noStore() // Opt out of caching
      
      // Revalidate critical data
      await Promise.all([
        revalidateTag('products'),
        revalidateTag('categories'),
        revalidatePath('/'),
      ])
    }, 5 * 60 * 1000) // Every 5 minutes
  }
}
```

## Performance Monitoring

### Cache Hit Rate Tracking

```typescript
// lib/cache-metrics.ts
class CacheMetrics {
  private hits = 0
  private misses = 0
  
  recordHit() {
    this.hits++
  }
  
  recordMiss() {
    this.misses++
  }
  
  getHitRate() {
    const total = this.hits + this.misses
    return total > 0 ? (this.hits / total) * 100 : 0
  }
  
  reset() {
    this.hits = 0
    this.misses = 0
  }
  
  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      total: this.hits + this.misses
    }
  }
}

export const cacheMetrics = new CacheMetrics()
```

### Performance Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Add cache performance headers
  response.headers.set('X-Cache-Status', 'HIT') // or MISS
  response.headers.set('X-Cache-TTL', '3600')
  response.headers.set('X-Cache-Key', request.url)
  
  return response
}
```

## Cache Configuration

### Environment-based Caching

```typescript
// lib/cache-config.ts
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const cacheConfig = {
  // Disable caching in development for easier debugging
  enabled: isProduction,
  
  // Shorter TTLs in development
  defaultTTL: isDevelopment ? 10 : 3600,
  
  // More aggressive caching in production
  staleWhileRevalidate: isProduction,
  
  // Cache size limits
  maxSize: isProduction ? 1000 : 100,
  
  // Cache key prefix by environment
  keyPrefix: process.env.VERCEL_ENV || 'local'
}
```

## Best Practices

### 1. **Choose the Right Cache Strategy**
- Static content: `force-cache` with long TTL
- User-specific: `no-store` or short TTL
- Frequently updated: Stale-while-revalidate

### 2. **Implement Cache Invalidation**
- Use tags for granular invalidation
- Invalidate related data together
- Implement webhook handlers for external updates

### 3. **Monitor Cache Performance**
- Track hit rates
- Monitor cache size
- Set up alerts for cache misses

### 4. **Optimize Cache Keys**
- Include relevant parameters
- Normalize query parameters
- Use consistent key patterns

### 5. **Handle Cache Failures Gracefully**
- Implement fallbacks
- Log cache errors
- Degrade gracefully to database queries

## Troubleshooting

### Common Issues

**1. Cache Not Updating**
```typescript
// Force revalidation
revalidatePath('/path')
revalidateTag('tag')
```

**2. Memory Leaks**
```typescript
// Implement cache size limits
const cache = new MemoryQueryCache({
  maxSize: 100,
  onEvict: (key, value) => {
    console.log(`Evicted cache entry: ${key}`)
  }
})
```

**3. Stale Data**
```typescript
// Use shorter TTLs or implement real-time updates
const result = await client.from('data').select('*').execute({
  cache: { ttl: 60 } // 1 minute TTL
})
```

## Next Steps

- [Performance Optimization](/guide/nextjs-caching)
- [Real-time Updates](/guide/realtime)
- [Production Deployment](/guide/production)