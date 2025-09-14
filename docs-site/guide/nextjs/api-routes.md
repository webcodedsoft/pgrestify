# API Routes

Next.js API routes provide a powerful way to build server-side API endpoints within your application. PGRestify enhances API routes with type-safe database operations, automatic error handling, and seamless integration with both Pages Router and App Router architectures.

## Overview

PGRestify API Routes features:

- **Type-Safe Operations**: Fully typed database queries and mutations
- **Automatic Error Handling**: Built-in error responses and logging
- **Authentication Integration**: Session management and JWT validation
- **Validation Middleware**: Input validation and sanitization
- **Rate Limiting**: Built-in request throttling
- **CORS Support**: Cross-origin request handling
- **Edge Runtime**: Compatible with Vercel Edge Runtime
- **OpenAPI Integration**: Auto-generated API documentation

## Pages Router API Routes

### Basic API Route Structure

```typescript
// pages/api/posts/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandler } from 'pgrestify/nextjs';

export default createRouteHandler({
  GET: async ({ client, req, res }) => {
    const { page = '1', limit = '10', search, category } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let query = client
      .from('posts')
      .select(`
        id,
        title,
        excerpt,
        slug,
        created_at,
        updated_at,
        published,
        view_count,
        author:users(id, name, avatar_url),
        category:categories(id, name, color),
        _count:comments(count)
      `)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);
    
    // Apply search filter
    if (search) {
      query = query.textSearch('title,content', search as string);
    }
    
    // Apply category filter
    if (category) {
      query = query.eq('category_id', category);
    }
    
    const { data: posts, error, count } = await query;
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to fetch posts',
        details: error.message 
      });
    }
    
    const totalPages = Math.ceil((count || 0) / parseInt(limit as string));
    
    res.status(200).json({
      data: posts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count,
        totalPages,
        hasNext: parseInt(page as string) < totalPages,
        hasPrev: parseInt(page as string) > 1
      }
    });
  },
  
  POST: async ({ client, req, res }) => {
    // Validation
    const { title, content, excerpt, category_id, published = false } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: {
          title: !title ? 'Title is required' : null,
          content: !content ? 'Content is required' : null
        }
      });
    }
    
    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Check if slug already exists
    const { data: existingPost } = await client
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .single();
    
    if (existingPost) {
      return res.status(409).json({
        error: 'Slug already exists',
        details: 'A post with this title already exists'
      });
    }
    
    // Create new post
    const { data: post, error } = await client
      .from('posts')
      .insert({
        title,
        content,
        excerpt: excerpt || content.substring(0, 200) + '...',
        slug,
        category_id: category_id ? parseInt(category_id) : null,
        published,
        author_id: req.user?.id, // From auth middleware
        reading_time: Math.ceil(content.split(' ').length / 200) // ~200 words per minute
      })
      .select(`
        *,
        author:users(id, name, avatar_url),
        category:categories(id, name, color)
      `)
      .single();
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to create post',
        details: error.message 
      });
    }
    
    res.status(201).json({
      data: post,
      message: 'Post created successfully'
    });
  }
});
```

### Dynamic API Routes

```typescript
// pages/api/posts/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandler, withAuth } from 'pgrestify/nextjs';

export default withAuth(createRouteHandler({
  GET: async ({ client, req, res }) => {
    const { id } = req.query;
    
    const { data: post, error } = await client
      .from('posts')
      .select(`
        *,
        author:users(
          id,
          name,
          bio,
          avatar_url,
          social_links
        ),
        category:categories(id, name, color, description),
        comments:comments(
          id,
          content,
          created_at,
          author:users(id, name, avatar_url)
        ),
        tags:post_tags(
          tag:tags(id, name, color)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !post) {
      return res.status(404).json({ 
        error: 'Post not found',
        details: 'The requested post does not exist or has been deleted'
      });
    }
    
    // Increment view count
    await client
      .from('posts')
      .update({ view_count: post.view_count + 1 })
      .eq('id', id);
    
    res.status(200).json({
      data: {
        ...post,
        view_count: post.view_count + 1
      }
    });
  },
  
  PUT: async ({ client, req, res }) => {
    const { id } = req.query;
    const updates = req.body;
    
    // Check ownership
    const { data: existingPost } = await client
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single();
    
    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (existingPost.author_id !== req.user?.id && !req.user?.isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden',
        details: 'You can only update your own posts'
      });
    }
    
    // Update slug if title changed
    if (updates.title) {
      updates.slug = updates.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    
    const { data: post, error } = await client
      .from('posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        author:users(id, name, avatar_url),
        category:categories(id, name, color)
      `)
      .single();
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to update post',
        details: error.message 
      });
    }
    
    res.status(200).json({
      data: post,
      message: 'Post updated successfully'
    });
  },
  
  DELETE: async ({ client, req, res }) => {
    const { id } = req.query;
    
    // Check ownership
    const { data: existingPost } = await client
      .from('posts')
      .select('author_id, title')
      .eq('id', id)
      .single();
    
    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (existingPost.author_id !== req.user?.id && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { error } = await client
      .from('posts')
      .delete()
      .eq('id', id);
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to delete post',
        details: error.message 
      });
    }
    
    res.status(200).json({
      message: `Post "${existingPost.title}" deleted successfully`
    });
  }
}));
```

### Nested API Routes

```typescript
// pages/api/posts/[id]/comments.ts
import { createRouteHandler, withAuth } from 'pgrestify/nextjs';

export default createRouteHandler({
  GET: async ({ client, req, res }) => {
    const { id } = req.query;
    const { page = '1', limit = '20' } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const { data: comments, error, count } = await client
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        author:users(
          id,
          name,
          avatar_url
        ),
        replies:comments!parent_id(
          id,
          content,
          created_at,
          author:users(id, name, avatar_url)
        )
      `)
      .eq('post_id', id)
      .is('parent_id', null) // Only top-level comments
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(200).json({
      data: comments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count,
        totalPages: Math.ceil((count || 0) / parseInt(limit as string))
      }
    });
  },
  
  POST: withAuth(async ({ client, req, res }) => {
    const { id } = req.query;
    const { content, parent_id } = req.body;
    
    if (!content?.trim()) {
      return res.status(400).json({ 
        error: 'Comment content is required' 
      });
    }
    
    // Verify post exists
    const { data: post } = await client
      .from('posts')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // If replying to a comment, verify it exists
    if (parent_id) {
      const { data: parentComment } = await client
        .from('comments')
        .select('id')
        .eq('id', parent_id)
        .eq('post_id', id)
        .single();
      
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }
    
    const { data: comment, error } = await client
      .from('comments')
      .insert({
        content: content.trim(),
        post_id: id,
        parent_id: parent_id || null,
        author_id: req.user?.id
      })
      .select(`
        id,
        content,
        created_at,
        author:users(id, name, avatar_url)
      `)
      .single();
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(201).json({
      data: comment,
      message: 'Comment added successfully'
    });
  })
});
```

## App Router API Routes

### Route Handlers

```typescript
// app/api/posts/route.ts
import { createRouteHandler } from 'pgrestify/nextjs';
import { NextRequest } from 'next/server';

export const { GET, POST } = createRouteHandler({
  GET: async ({ client, request }) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    
    const offset = (page - 1) * limit;
    
    let query = client
      .from('posts')
      .select(`
        id,
        title,
        excerpt,
        slug,
        created_at,
        published,
        author:users(id, name, avatar_url),
        category:categories(id, name, color)
      `)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (search) {
      query = query.textSearch('title,content', search);
    }
    
    if (category) {
      query = query.eq('category_id', category);
    }
    
    const { data: posts, error, count } = await query;
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    return Response.json({
      data: posts,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  },
  
  POST: async ({ client, request }) => {
    try {
      const body = await request.json();
      const { title, content, excerpt, category_id, published = false } = body;
      
      if (!title || !content) {
        return Response.json(
          { 
            error: 'Validation failed',
            details: 'Title and content are required'
          },
          { status: 400 }
        );
      }
      
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const { data: post, error } = await client
        .from('posts')
        .insert({
          title,
          content,
          excerpt: excerpt || content.substring(0, 200) + '...',
          slug,
          category_id,
          published
        })
        .select()
        .single();
      
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      
      return Response.json(post, { status: 201 });
    } catch (error) {
      return Response.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
  }
});
```

### Dynamic Route Handlers

```typescript
// app/api/posts/[id]/route.ts
import { createRouteHandler, withAuth } from 'pgrestify/nextjs';
import { NextRequest } from 'next/server';

interface RouteContext {
  params: { id: string };
}

export const { GET, PUT, DELETE } = createRouteHandler({
  GET: async ({ client, request, context }: { 
    client: any; 
    request: NextRequest; 
    context: RouteContext;
  }) => {
    const { id } = context.params;
    
    const { data: post, error } = await client
      .from('posts')
      .select(`
        *,
        author:users(id, name, bio, avatar_url),
        category:categories(id, name, color, description),
        comments:comments(
          id,
          content,
          created_at,
          author:users(id, name, avatar_url)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !post) {
      return Response.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    
    // Increment view count
    await client
      .from('posts')
      .update({ view_count: post.view_count + 1 })
      .eq('id', id);
    
    return Response.json({
      ...post,
      view_count: post.view_count + 1
    });
  },
  
  PUT: withAuth(async ({ client, request, context, user }) => {
    const { id } = context.params;
    
    try {
      const updates = await request.json();
      
      // Check ownership
      const { data: existingPost } = await client
        .from('posts')
        .select('author_id')
        .eq('id', id)
        .single();
      
      if (!existingPost) {
        return Response.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
      
      if (existingPost.author_id !== user?.id) {
        return Response.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
      
      const { data: post, error } = await client
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      
      return Response.json(post);
    } catch (error) {
      return Response.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
  }),
  
  DELETE: withAuth(async ({ client, context, user }) => {
    const { id } = context.params;
    
    // Check ownership
    const { data: existingPost } = await client
      .from('posts')
      .select('author_id, title')
      .eq('id', id)
      .single();
    
    if (!existingPost) {
      return Response.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    
    if (existingPost.author_id !== user?.id) {
      return Response.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    const { error } = await client
      .from('posts')
      .delete()
      .eq('id', id);
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    return Response.json({ 
      message: `Post "${existingPost.title}" deleted successfully` 
    });
  })
});
```

## Advanced Features

### Middleware Integration

```typescript
// middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddleware } from 'pgrestify/nextjs';

export const authMiddleware = createAuthMiddleware({
  protectedPaths: ['/api/posts', '/api/users'],
  publicPaths: ['/api/auth/*'],
  validateAuth: async (token: string) => {
    // Custom JWT validation logic
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!);
      return payload;
    } catch {
      return null;
    }
  }
});

// Middleware composition
export function middleware(request: NextRequest) {
  // Apply auth middleware for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    return authMiddleware(request);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';

const rateLimit = new Map();

export function withRateLimit(
  limit: number = 100, 
  window: number = 15 * 60 * 1000 // 15 minutes
) {
  return function rateLimitMiddleware(handler: Function) {
    return async (req: NextRequest, context: any) => {
      const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
      const key = `${ip}-${req.nextUrl.pathname}`;
      const now = Date.now();
      
      const userRequests = rateLimit.get(key) || [];
      const validRequests = userRequests.filter((time: number) => now - time < window);
      
      if (validRequests.length >= limit) {
        return Response.json(
          { 
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((validRequests[0] + window - now) / 1000)
          },
          { status: 429 }
        );
      }
      
      validRequests.push(now);
      rateLimit.set(key, validRequests);
      
      return handler(req, context);
    };
  };
}

// Usage
// app/api/posts/route.ts
export const POST = withRateLimit(10, 60 * 1000)(
  createRouteHandler({
    POST: async ({ client, request }) => {
      // Handle post creation
    }
  }).POST
);
```

### Input Validation

```typescript
// lib/validation.ts
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(500, 'Excerpt too long').optional(),
  category_id: z.number().int().positive().optional(),
  published: z.boolean().default(false),
  tags: z.array(z.string()).max(10, 'Too many tags').optional()
});

export const updatePostSchema = createPostSchema.partial();

export function withValidation<T>(schema: z.ZodSchema<T>) {
  return function validationMiddleware(handler: Function) {
    return async (req: NextRequest, context: any) => {
      try {
        const body = await req.json();
        const validatedData = schema.parse(body);
        
        // Add validated data to request context
        return handler(req, { ...context, validatedData });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return Response.json(
            { 
              error: 'Validation failed',
              details: error.errors
            },
            { status: 400 }
          );
        }
        
        return Response.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }
    };
  };
}

// Usage
// app/api/posts/route.ts
export const POST = withValidation(createPostSchema)(
  createRouteHandler({
    POST: async ({ client, request, validatedData }) => {
      const { data: post, error } = await client
        .from('posts')
        .insert(validatedData)
        .select()
        .single();
      
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      
      return Response.json(post, { status: 201 });
    }
  }).POST
);
```

### File Upload Handling

```typescript
// app/api/upload/route.ts
import { createRouteHandler, withAuth } from 'pgrestify/nextjs';
import { NextRequest } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const { POST } = createRouteHandler({
  POST: withAuth(async ({ request, user }) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return Response.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return Response.json(
          { error: 'Invalid file type' },
          { status: 400 }
        );
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return Response.json(
          { error: 'File too large' },
          { status: 400 }
        );
      }
      
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const uploadDir = join(process.cwd(), 'public/uploads');
      const filepath = join(uploadDir, filename);
      
      await writeFile(filepath, buffer);
      
      const fileUrl = `/uploads/${filename}`;
      
      return Response.json({
        url: fileUrl,
        filename,
        size: file.size,
        type: file.type
      });
    } catch (error) {
      console.error('Upload error:', error);
      return Response.json(
        { error: 'Upload failed' },
        { status: 500 }
      );
    }
  })
});
```

## Error Handling

### Global Error Handler

```typescript
// lib/api-error.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function withErrorHandler(handler: Function) {
  return async (req: any, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error('API Error:', error);
      
      if (error instanceof ApiError) {
        return Response.json(
          { 
            error: error.message,
            details: error.details 
          },
          { status: error.statusCode }
        );
      }
      
      if (error.code === 'PGRST116') {
        return Response.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }
      
      if (error.code === 'PGRST204') {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      return Response.json(
        { 
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
    }
  };
}
```

### Structured Error Response

```typescript
// types/api.ts
export interface ApiErrorResponse {
  error: string;
  details?: any;
  code?: string;
  timestamp?: string;
  path?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters?: Record<string, any>;
  };
}

// lib/api-response.ts
export function successResponse<T>(
  data: T, 
  message?: string, 
  meta?: any
): ApiSuccessResponse<T> {
  return {
    data,
    message,
    meta
  };
}

export function errorResponse(
  error: string,
  details?: any,
  code?: string
): ApiErrorResponse {
  return {
    error,
    details,
    code,
    timestamp: new Date().toISOString()
  };
}
```

## Testing API Routes

### Unit Testing

```typescript
// __tests__/api/posts.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/posts/index';
import { prismaMock } from '../__mocks__/prisma';

jest.mock('../../lib/client');

describe('/api/posts', () => {
  it('should return posts list', async () => {
    const mockPosts = [
      {
        id: '1',
        title: 'Test Post',
        content: 'Test content',
        published: true
      }
    ];
    
    prismaMock.posts.findMany.mockResolvedValue(mockPosts);
    
    const { req, res } = createMocks({
      method: 'GET',
      query: { page: '1', limit: '10' }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    
    const data = JSON.parse(res._getData());
    expect(data.data).toEqual(mockPosts);
  });
  
  it('should create new post', async () => {
    const newPost = {
      title: 'New Post',
      content: 'New content',
      published: false
    };
    
    const createdPost = { id: '1', ...newPost };
    prismaMock.posts.create.mockResolvedValue(createdPost);
    
    const { req, res } = createMocks({
      method: 'POST',
      body: newPost
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(201);
    
    const data = JSON.parse(res._getData());
    expect(data.data).toEqual(createdPost);
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/posts-api.test.ts
import request from 'supertest';
import { createServer } from 'http';
import { apiResolver } from 'next/dist/server/api-utils/node';
import handler from '../../pages/api/posts/index';

const httpHandler = (req: any, res: any) => {
  return apiResolver(req, res, undefined, handler, {
    previewModeId: '',
    previewModeEncryptionKey: '',
    previewModeSigningKey: ''
  }, false);
};

describe('/api/posts integration', () => {
  it('should handle complete post lifecycle', async () => {
    const server = createServer(httpHandler);
    
    // Create post
    const newPost = {
      title: 'Integration Test Post',
      content: 'Test content for integration',
      published: true
    };
    
    const createResponse = await request(server)
      .post('/api/posts')
      .send(newPost)
      .expect(201);
    
    const postId = createResponse.body.data.id;
    
    // Get post
    await request(server)
      .get(`/api/posts/${postId}`)
      .expect(200);
    
    // Update post
    await request(server)
      .put(`/api/posts/${postId}`)
      .send({ title: 'Updated Title' })
      .expect(200);
    
    // Delete post
    await request(server)
      .delete(`/api/posts/${postId}`)
      .expect(200);
  });
});
```

## Performance Optimization

### Response Caching

```typescript
// lib/cache.ts
import { NextRequest, NextResponse } from 'next/server';

const cache = new Map();

export function withCache(ttl: number = 300000) { // 5 minutes default
  return function cacheMiddleware(handler: Function) {
    return async (req: NextRequest, context: any) => {
      const key = `${req.method}:${req.url}`;
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < ttl) {
        return new Response(cached.data, {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          }
        });
      }
      
      const response = await handler(req, context);
      
      if (response.ok && req.method === 'GET') {
        const data = await response.text();
        cache.set(key, {
          data,
          timestamp: Date.now()
        });
        
        return new Response(data, {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS'
          }
        });
      }
      
      return response;
    };
  };
}
```

### Database Connection Optimization

```typescript
// lib/db-pool.ts
import { createServerClient } from 'pgrestify/nextjs';

let cachedClient: any = null;

export function getDbClient() {
  if (!cachedClient) {
    cachedClient = createServerClient({
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      }
    });
  }
  
  return cachedClient;
}
```

## Best Practices

### API Design Principles

1. **RESTful URLs**: Use consistent URL patterns
2. **HTTP Status Codes**: Return appropriate status codes
3. **Error Handling**: Provide meaningful error messages
4. **Validation**: Validate all inputs
5. **Authentication**: Secure protected endpoints
6. **Rate Limiting**: Prevent abuse
7. **Documentation**: Document your API endpoints

### Security Best Practices

```typescript
// Security headers middleware
export function withSecurityHeaders(handler: Function) {
  return async (req: NextRequest, context: any) => {
    const response = await handler(req, context);
    
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    
    return response;
  };
}
```

## Next Steps

- [Server-Side Rendering](./ssr.md) - SSR patterns and optimization
- [Static Generation](./ssg.md) - ISR and pre-rendering strategies
- [Authentication](./auth.md) - Complete auth implementation
- [Deployment](../production/deployment.md) - Production deployment guides