# Next.js API Routes & Handlers

PGRestify provides comprehensive support for both Pages Router API routes and App Router route handlers with type-safe, efficient database access.

## Overview

Next.js offers two approaches to API development:
- **Pages Router**: Traditional `/pages/api` routes (Next.js 12+)
- **App Router**: Modern route handlers in `/app` directory (Next.js 13+)

## Pages Router API Routes

### Basic API Route

```typescript
// pages/api/users.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { client } from '../../lib/client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const result = await client
      .from('users')
      .select('*')
      .execute()
    
    return res.status(200).json(result.data)
  }
  
  if (req.method === 'POST') {
    const result = await client
      .from('users')
      .insert(req.body)
      .select('*')
      .single()
      .execute()
    
    if (result.error) {
      return res.status(400).json({ error: result.error.message })
    }
    
    return res.status(201).json(result.data)
  }
  
  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
```

### Using API Handler Helper

```typescript
// pages/api/users.ts
import { createApiHandler } from 'pgrestify/nextjs'
import { client } from '../../lib/client'

export default createApiHandler({
  GET: async (req, res, client) => {
    const { page = 1, limit = 10 } = req.query
    
    const result = await client
      .from('users')
      .select('*')
      .range((page - 1) * limit, page * limit - 1)
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
    
    if (result.error) {
      throw result.error
    }
    
    return result.data
  }
})
```

### Dynamic API Routes

```typescript
// pages/api/users/[id].ts
import { createApiHandler } from 'pgrestify/nextjs'

export default createApiHandler({
  GET: async (req, res, client) => {
    const { id } = req.query
    
    const result = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
      .execute()
    
    if (!result.data) {
      res.status(404)
      throw new Error('User not found')
    }
    
    return result.data
  },
  
  PUT: async (req, res, client) => {
    const { id } = req.query
    
    const result = await client
      .from('users')
      .update(req.body)
      .eq('id', id)
      .select('*')
      .single()
      .execute()
    
    return result.data
  },
  
  DELETE: async (req, res, client) => {
    const { id } = req.query
    
    await client
      .from('users')
      .delete()
      .eq('id', id)
      .execute()
    
    res.status(204)
    return null
  }
})
```

## App Router Route Handlers

### Basic Route Handler

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { client } from '../../../lib/client'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '10'
  
  const result = await client
    .from('users')
    .select('*')
    .range((+page - 1) * +limit, +page * +limit - 1)
    .execute()
  
  return NextResponse.json(result.data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  const result = await client
    .from('users')
    .insert(body)
    .select('*')
    .single()
    .execute()
  
  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    )
  }
  
  return NextResponse.json(result.data, { status: 201 })
}
```

### Using Route Handler Helper

```typescript
// app/api/users/route.ts
import { createRouteHandler } from 'pgrestify/nextjs'

export const { GET, POST, PUT, DELETE } = createRouteHandler({
  GET: async (request, { params }) => {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    
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
      return Response.json(
        { error: result.error.message },
        { status: 400 }
      )
    }
    
    return Response.json(result.data, { status: 201 })
  }
})
```

### Dynamic Route Handlers

```typescript
// app/api/users/[id]/route.ts
import { createRouteHandler } from 'pgrestify/nextjs'

export const { GET, PUT, DELETE } = createRouteHandler({
  GET: async (request, { params }) => {
    const { id } = await params // Next.js 15+ async params
    
    const result = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
      .execute()
    
    if (!result.data) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return Response.json(result.data)
  },
  
  PUT: async (request, { params }) => {
    const { id } = await params
    const body = await request.json()
    
    const result = await client
      .from('users')
      .update(body)
      .eq('id', id)
      .select('*')
      .single()
      .execute()
    
    return Response.json(result.data)
  },
  
  DELETE: async (request, { params }) => {
    const { id } = await params
    
    await client
      .from('users')
      .delete()
      .eq('id', id)
      .execute()
    
    return new Response(null, { status: 204 })
  }
})
```

## Authentication & Authorization

### Protected API Routes (Pages Router)

```typescript
// pages/api/protected/data.ts
import { withAuth } from 'pgrestify/nextjs'
import { createApiHandler } from 'pgrestify/nextjs'

export default withAuth(
  createApiHandler({
    GET: async (req, res, client, { user }) => {
      // user is guaranteed to be authenticated
      const result = await client
        .from('user_data')
        .select('*')
        .eq('user_id', user.id)
        .execute()
      
      return result.data
    }
  })
)
```

### Protected Route Handlers (App Router)

```typescript
// app/api/protected/route.ts
import { createProtectedRouteHandler } from 'pgrestify/nextjs'

export const { GET, POST } = createProtectedRouteHandler({
  GET: async (request, { user, client }) => {
    // user is guaranteed to be authenticated
    const result = await client
      .from('user_data')
      .select('*')
      .eq('user_id', user.id)
      .execute()
    
    return Response.json(result.data)
  }
})
```

### Role-Based Access Control

```typescript
// pages/api/admin/users.ts
import { requireRole } from 'pgrestify/nextjs'

export default requireRole('admin')(
  createApiHandler({
    GET: async (req, res, client) => {
      const result = await client
        .from('users')
        .select('*')
        .execute()
      
      return result.data
    },
    
    DELETE: async (req, res, client) => {
      const { id } = req.query
      
      await client
        .from('users')
        .delete()
        .eq('id', id)
        .execute()
      
      return { success: true }
    }
  })
)
```

## Request Validation

### Using Zod for Validation

```typescript
// pages/api/users.ts
import { z } from 'zod'
import { withValidation } from 'pgrestify/nextjs'

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(18).optional()
})

export default createApiHandler({
  POST: withValidation(CreateUserSchema)(
    async (req, res, client, { validatedBody }) => {
      const result = await client
        .from('users')
        .insert(validatedBody)
        .select('*')
        .single()
        .execute()
      
      return result.data
    }
  )
})
```

### Custom Validation

```typescript
// app/api/posts/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  
  // Custom validation
  if (!body.title || body.title.length < 5) {
    return Response.json(
      { error: 'Title must be at least 5 characters' },
      { status: 400 }
    )
  }
  
  const result = await client
    .from('posts')
    .insert(body)
    .select('*')
    .single()
    .execute()
  
  return Response.json(result.data, { status: 201 })
}
```

## File Uploads

### Handling File Uploads (Pages Router)

```typescript
// pages/api/upload.ts
import formidable from 'formidable'
import { createApiHandler } from 'pgrestify/nextjs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default createApiHandler({
  POST: async (req, res, client) => {
    const form = formidable()
    const [fields, files] = await form.parse(req)
    
    // Process file
    const file = Array.isArray(files.file) ? files.file[0] : files.file
    
    // Store file metadata in database
    const result = await client
      .from('uploads')
      .insert({
        filename: file.originalFilename,
        size: file.size,
        mimetype: file.mimetype,
        path: file.filepath
      })
      .select('*')
      .single()
      .execute()
    
    return result.data
  }
})
```

### Handling File Uploads (App Router)

```typescript
// app/api/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return Response.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }
  
  // Convert to buffer
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Store file metadata
  const result = await client
    .from('uploads')
    .insert({
      filename: file.name,
      size: file.size,
      mimetype: file.type,
      data: buffer.toString('base64')
    })
    .select('*')
    .single()
    .execute()
  
  return Response.json(result.data)
}
```

## Streaming Responses

### Server-Sent Events (SSE)

```typescript
// app/api/stream/route.ts
export async function GET(request: Request) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to real-time changes
      const subscription = client
        .from('events')
        .on('INSERT', (payload) => {
          const data = `data: ${JSON.stringify(payload.new)}\n\n`
          controller.enqueue(encoder.encode(data))
        })
        .subscribe()
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        subscription.unsubscribe()
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### Streaming JSON

```typescript
// app/api/large-dataset/route.ts
export async function GET() {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('['))
      
      let offset = 0
      const limit = 100
      let first = true
      
      while (true) {
        const result = await client
          .from('large_table')
          .select('*')
          .range(offset, offset + limit - 1)
          .execute()
        
        if (!result.data || result.data.length === 0) break
        
        for (const item of result.data) {
          if (!first) controller.enqueue(encoder.encode(','))
          controller.enqueue(encoder.encode(JSON.stringify(item)))
          first = false
        }
        
        offset += limit
      }
      
      controller.enqueue(encoder.encode(']'))
      controller.close()
    }
  })
  
  return new Response(stream, {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## Error Handling

### Global Error Handler

```typescript
// lib/api-error-handler.ts
import { PostgRESTError } from 'pgrestify'
import { NextApiResponse } from 'next'

export function handleApiError(
  error: unknown,
  res: NextApiResponse
) {
  console.error('API Error:', error)
  
  if (error instanceof PostgRESTError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    })
  }
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: error.errors
    })
  }
  
  return res.status(500).json({
    error: 'Internal server error'
  })
}
```

### Using Error Handler

```typescript
// pages/api/users.ts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Your API logic
  } catch (error) {
    handleApiError(error, res)
  }
}
```

## Rate Limiting

### Basic Rate Limiting

```typescript
// middleware/rate-limit.ts
const rateLimitMap = new Map()

export function rateLimit(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 10 // limit each IP to 10 requests per windowMs
  } = options
  
  return (handler: NextApiHandler) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
      const now = Date.now()
      
      if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 0, resetTime: now + windowMs })
      }
      
      const limit = rateLimitMap.get(ip)
      
      if (now > limit.resetTime) {
        limit.count = 0
        limit.resetTime = now + windowMs
      }
      
      if (limit.count >= max) {
        return res.status(429).json({ error: 'Too many requests' })
      }
      
      limit.count++
      return handler(req, res)
    }
  }
}

// Usage
export default rateLimit()(
  createApiHandler({
    // Your handlers
  })
)
```

## Caching Strategies

### Response Caching

```typescript
// app/api/cached/route.ts
export async function GET(request: Request) {
  const result = await client
    .from('products')
    .select('*')
    .execute()
  
  return Response.json(result.data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
```

### Edge Caching

```typescript
// app/api/edge-cached/route.ts
export const runtime = 'edge'

export async function GET(request: Request) {
  const cache = await caches.open('api-cache')
  const cached = await cache.match(request)
  
  if (cached) {
    return cached
  }
  
  const result = await client
    .from('data')
    .select('*')
    .execute()
  
  const response = Response.json(result.data)
  await cache.put(request, response.clone())
  
  return response
}
```

## Testing API Routes

### Unit Testing

```typescript
// __tests__/api/users.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/users'

describe('/api/users', () => {
  test('GET returns users', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })
    
    await handler(req, res)
    
    expect(res._getStatusCode()).toBe(200)
    const json = JSON.parse(res._getData())
    expect(Array.isArray(json)).toBe(true)
  })
  
  test('POST creates user', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    })
    
    await handler(req, res)
    
    expect(res._getStatusCode()).toBe(201)
    const json = JSON.parse(res._getData())
    expect(json.name).toBe('John Doe')
  })
})
```

## Best Practices

### 1. **Use Type-Safe Handlers**
Always use TypeScript and PGRestify's type-safe handler helpers.

### 2. **Implement Proper Error Handling**
Catch and handle all errors appropriately with meaningful messages.

### 3. **Validate Input**
Always validate request bodies and query parameters.

### 4. **Use Authentication When Needed**
Protect sensitive endpoints with authentication middleware.

### 5. **Implement Rate Limiting**
Prevent abuse by implementing rate limiting on public endpoints.

### 6. **Cache Appropriately**
Use caching strategies to improve performance and reduce database load.

## Next Steps

- [Authentication](/guide/nextjs-auth)
- [Server Actions](/guide/nextjs-server-actions)
- [Middleware](/guide/nextjs-middleware)
- [Testing](/guide/testing)