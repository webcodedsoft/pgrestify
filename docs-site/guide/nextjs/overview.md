# Next.js Overview

PGRestify provides comprehensive Next.js integration with full support for both App Router and Pages Router architectures. This overview covers the complete Next.js ecosystem integration, performance optimizations, and best practices.

## Overview

PGRestify's Next.js adapter offers:

- **Universal Router Support**: Works with both App Router (13+) and Pages Router  
- **Server-Side Rendering**: Optimized SSR with automatic hydration
- **Static Site Generation**: Pre-render pages at build time with ISR support
- **API Routes**: Type-safe API endpoints with built-in validation
- **Authentication**: Seamless auth integration with session management
- **Caching**: Intelligent caching strategies for optimal performance
- **Edge Runtime**: Compatible with Vercel Edge Runtime and middleware

## Architecture Support

### App Router (Next.js 13+)

Modern React Server Components architecture with streaming and concurrent features:

```typescript
// app/layout.tsx
import { PGRestifyProvider } from '@webcoded/pgrestify/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PGRestifyProvider>
          {children}
        </PGRestifyProvider>
      </body>
    </html>
  );
}

// app/posts/page.tsx
import { createServerClient } from '@webcoded/pgrestify/nextjs';

export default async function PostsPage() {
  const client = createServerClient();
  const { data: posts } = await client
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1>Latest Posts</h1>
      {posts?.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

### Pages Router (Legacy)

Traditional Next.js architecture with proven stability:

```typescript
// pages/_app.tsx
import { PGRestifyProvider } from '@webcoded/pgrestify/nextjs';
import { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PGRestifyProvider>
      <Component {...pageProps} />
    </PGRestifyProvider>
  );
}

// pages/posts.tsx
import { createGetServerSideProps } from '@webcoded/pgrestify/nextjs';

export default function PostsPage({ posts }: { posts: Post[] }) {
  return (
    <div>
      <h1>Latest Posts</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}

export const getServerSideProps = createGetServerSideProps(async ({ client }) => {
  const { data: posts } = await client
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  return {
    props: { posts: posts || [] }
  };
});
```

## Client Configuration

### Environment Detection

PGRestify automatically detects your Next.js environment and optimizes accordingly:

```typescript
// lib/client.ts
import { createNextJSClient } from '@webcoded/pgrestify/nextjs';

export const client = createNextJSClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  // Automatically detects App Router vs Pages Router
  router: 'auto',
  // Next.js specific optimizations
  nextjs: {
    cache: true,
    edge: false, // Set to true for Edge Runtime
    streaming: true,
    revalidate: ['posts', 'users']
  }
});
```

### Server vs Client Optimization

Separate configurations for server and client environments:

```typescript
// lib/server-client.ts
import { createServerClient } from '@webcoded/pgrestify/nextjs';

export const serverClient = createServerClient({
  url: process.env.POSTGREST_URL!, // Internal URL, no CORS needed
  auth: {
    // Server-side auth with service keys
    serviceKey: process.env.POSTGREST_SERVICE_KEY!
  },
  cache: {
    enabled: true,
    ttl: 3600 // 1 hour cache for server
  }
});

// lib/client-client.ts  
import { createClientClient } from '@webcoded/pgrestify/nextjs';

export const browserClient = createClientClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!, // Public URL
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  cache: {
    enabled: true,
    ttl: 300 // 5 minutes cache for browser
  }
});
```

## Data Fetching Patterns

### Server Components (App Router)

Fetch data directly in React Server Components:

```typescript
// app/users/[id]/page.tsx
import { createServerClient } from '@webcoded/pgrestify/nextjs';
import { notFound } from 'next/navigation';

interface UserPageProps {
  params: { id: string };
}

export default async function UserPage({ params }: UserPageProps) {
  const client = createServerClient();
  
  const { data: user, error } = await client
    .from('users')
    .select(`
      *,
      posts (
        id,
        title,
        created_at
      )
    `)
    .eq('id', params.id)
    .single();

  if (error || !user) {
    notFound();
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      
      <h2>Recent Posts</h2>
      {user.posts?.map(post => (
        <article key={post.id}>
          <h3>{post.title}</h3>
          <time>{new Date(post.created_at).toLocaleDateString()}</time>
        </article>
      ))}
    </div>
  );
}

// Generate metadata
export async function generateMetadata({ params }: UserPageProps) {
  const client = createServerClient();
  const { data: user } = await client
    .from('users')
    .select('name, bio')
    .eq('id', params.id)
    .single();

  return {
    title: `${user?.name} - User Profile`,
    description: user?.bio || `Profile page for ${user?.name}`
  };
}
```

### Client Components (App Router)

Interactive components with client-side data fetching:

```typescript
'use client';

import { useQuery, useMutation } from '@webcoded/pgrestify/nextjs';
import { useState } from 'react';

export default function PostForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: ({ client }) => client.from('categories').select('*')
  });

  const createPost = useMutation({
    mutationFn: ({ client, data }) => 
      client.from('posts').insert(data).select().single(),
    onSuccess: () => {
      setTitle('');
      setContent('');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createPost.mutateAsync({
      title,
      content,
      published: true
    });
  };

  if (isLoading) return <div>Loading categories...</div>;

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        required
      />
      
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Post content"
        required
      />
      
      <select>
        {categories?.map(category => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      
      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
}
```

## Performance Optimizations

### Automatic Caching

PGRestify provides intelligent caching optimized for Next.js:

```typescript
// Automatic cache strategy based on router type
const client = createNextJSClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  nextjs: {
    cache: true, // Enables automatic caching
    revalidate: [
      'posts',    // Tag for posts
      'users',    // Tag for users  
      'comments'  // Tag for comments
    ]
  }
});

// Manual cache control
import { revalidateTag } from '@webcoded/pgrestify/nextjs';

// In a Server Action or API route
export async function updatePost(id: string, data: Partial<Post>) {
  const client = createServerClient();
  
  const { data: post } = await client
    .from('posts')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  // Revalidate related caches
  revalidateTag('posts');
  revalidateTag(`post-${id}`);
  
  return post;
}
```

### Edge Runtime Support

Compatible with Vercel Edge Runtime for global performance:

```typescript
// middleware.ts
import { createAuthMiddleware } from '@webcoded/pgrestify/nextjs';

export const middleware = createAuthMiddleware({
  protectedPaths: ['/dashboard', '/profile'],
  publicPaths: ['/', '/login', '/signup'],
  signInUrl: '/login'
});

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*']
};

// Edge API route
// app/api/posts/route.ts
import { createRouteHandler } from '@webcoded/pgrestify/nextjs';

export const runtime = 'edge';

export const { GET, POST } = createRouteHandler({
  GET: async ({ client, request }) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = client.from('posts').select('*');
    
    if (category) {
      query = query.eq('category', category);
    }

    const { data: posts } = await query;
    
    return Response.json(posts);
  },
  
  POST: async ({ client, request }) => {
    const body = await request.json();
    
    const { data: post, error } = await client
      .from('posts')
      .insert(body)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(post, { status: 201 });
  }
});
```

## Authentication Integration

### Session Management

Seamless authentication with Next.js auth patterns:

```typescript
// lib/auth.ts
import { createAuthClient } from '@webcoded/pgrestify/nextjs';

export const auth = createAuthClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  session: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// app/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@webcoded/pgrestify/nextjs';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isLoading } = useSession();

  const handleLogin = async (email: string, password: string) => {
    try {
      await signIn({ email, password });
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleLogin(
        formData.get('email') as string,
        formData.get('password') as string
      );
    }}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

### Protected Routes

Implement route protection with middleware:

```typescript
// middleware.ts
import { createAuthMiddleware } from '@webcoded/pgrestify/nextjs';

export const middleware = createAuthMiddleware({
  protectedPaths: ['/dashboard/:path*', '/profile/:path*'],
  publicPaths: ['/', '/about', '/contact'],
  signInUrl: '/login',
  validateAuth: async (request) => {
    // Custom auth validation logic
    const token = request.cookies.get('auth-token');
    if (!token) return false;
    
    // Validate token with your auth service
    return validateToken(token.value);
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

## Deployment Considerations

### Environment Variables

Configure environment variables for different deployment targets:

```bash
# .env.local (development)
NEXT_PUBLIC_POSTGREST_URL=http://localhost:3000
POSTGREST_URL=http://localhost:3000
POSTGREST_SERVICE_KEY=your_service_key
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# .env.production
NEXT_PUBLIC_POSTGREST_URL=https://api.yourdomain.com
POSTGREST_URL=https://internal-api.yourdomain.com
POSTGREST_SERVICE_KEY=your_production_service_key
DATABASE_URL=your_production_database_url
```

### Vercel Deployment

Optimal configuration for Vercel deployment:

```json
// vercel.json
{
  "build": {
    "env": {
      "ENABLE_EXPERIMENTAL_COREPACK": "1"
    }
  },
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Docker Configuration

Docker setup for containerized deployment:

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

## Best Practices

### Project Structure

Recommended folder structure for Next.js with PGRestify:

```
app/                        # App Router (Next.js 13+)
├── api/                   # API routes
│   ├── auth/             # Authentication endpoints
│   ├── posts/            # Posts API
│   └── users/            # Users API
├── dashboard/            # Protected dashboard
├── (auth)/               # Auth route group
│   ├── login/
│   └── signup/
└── layout.tsx            # Root layout

lib/                       # Shared utilities
├── client.ts             # PGRestify client setup
├── auth.ts               # Authentication logic
├── utils.ts              # Helper functions
└── types.ts              # TypeScript types

components/               # Reusable components
├── ui/                   # Basic UI components
├── forms/                # Form components
└── layouts/              # Layout components

hooks/                    # Custom hooks
├── useAuth.ts           # Authentication hook
├── usePosts.ts          # Posts-specific hooks
└── useUsers.ts          # User-specific hooks
```

### Error Handling

Comprehensive error handling across your Next.js app:

```typescript
// lib/error-handler.ts
export class PGRestifyError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PGRestifyError';
  }
}

export function handleAPIError(error: any) {
  if (error.code) {
    switch (error.code) {
      case 'PGRST116':
        throw new PGRestifyError('Resource not found', '404', error);
      case 'PGRST204':
        throw new PGRestifyError('Unauthorized', '401', error);
      default:
        throw new PGRestifyError('Server error', '500', error);
    }
  }
  
  throw new PGRestifyError('Unknown error', '500', error);
}

// app/error.tsx (App Router error boundary)
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### Performance Tips

1. **Use Server Components**: Fetch data on the server when possible
2. **Implement Proper Caching**: Use Next.js cache and PGRestify cache strategies  
3. **Optimize Bundle Size**: Import only what you need
4. **Use Streaming**: Enable streaming for better UX
5. **Monitor Performance**: Use Next.js analytics and monitoring

## Migration Guide

### From Pages to App Router

Migrating existing PGRestify Pages Router apps to App Router:

```typescript
// Before (Pages Router)
// pages/posts.tsx
export const getServerSideProps = createGetServerSideProps(async ({ client }) => {
  const { data: posts } = await client.from('posts').select('*');
  return { props: { posts } };
});

// After (App Router)
// app/posts/page.tsx
export default async function PostsPage() {
  const client = createServerClient();
  const { data: posts } = await client.from('posts').select('*');
  
  return <PostList posts={posts} />;
}
```

## Next Steps

- [App Router Guide](./app-router.md) - Deep dive into App Router integration
- [Pages Router Guide](./pages-router.md) - Pages Router best practices  
- [API Routes](./api-routes.md) - Building type-safe API endpoints
- [Static Generation](./ssg.md) - Pre-rendering with ISR
- [Server-Side Rendering](./ssr.md) - Advanced SSR patterns
- [Authentication Flow](./auth.md) - Complete auth implementation