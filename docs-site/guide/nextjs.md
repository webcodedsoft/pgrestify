# Next.js Integration

PGRestify provides comprehensive Next.js integration supporting both App Router and Pages Router architectures. The integration includes optimized data fetching, server-side rendering, authentication, caching, and performance optimizations specifically designed for Next.js applications.

## Overview

The Next.js adapter provides:

- **Universal Compatibility**: Works with both App Router (13+) and Pages Router
- **Server-Side Rendering**: Optimized SSR and SSG data fetching patterns
- **Authentication Integration**: Seamless JWT authentication with middleware support
- **Advanced Caching**: Next.js-native caching with revalidation and tags
- **Type Safety**: Full TypeScript support with Next.js-specific types
- **Performance Optimizations**: Edge Runtime compatibility, streaming, and more

## Installation and Setup

### Installation

Install the Next.js adapter with your preferred package manager:

```bash
npm install pgrestify
# Next.js is a peer dependency
npm install next@latest react react-dom
```

### Basic Configuration

Create a client configuration file:

```typescript
// lib/pgrestify.ts
import { createNextJSClient } from 'pgrestify/nextjs';

export const client = createNextJSClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  apikey: process.env.NEXT_PUBLIC_POSTGREST_ANON_KEY!,
  auth: {
    url: process.env.NEXT_PUBLIC_AUTH_URL,
    persistSession: true,
    autoRefreshToken: true
  },
  nextjs: {
    cache: true,      // Enable Next.js caching
    edge: false,      // Edge Runtime compatibility
    streaming: true,  // Enable streaming responses
    revalidate: ['posts', 'users'] // Global revalidation tags
  }
});
```

### Environment Variables

Configure your environment variables:

```bash
# .env.local
NEXT_PUBLIC_POSTGREST_URL=http://localhost:3000
NEXT_PUBLIC_POSTGREST_ANON_KEY=your-anon-key
NEXT_PUBLIC_AUTH_URL=http://localhost:3000/auth/v1

# Server-only variables
POSTGREST_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

## App Router Integration

### Server Components

Server Components can directly query the database:

```typescript
// app/posts/page.tsx
import { createServerClient } from 'pgrestify/nextjs';

interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    email: string;
  };
  created_at: string;
}

export default async function PostsPage() {
  const client = createServerClient();
  
  const { data: posts, error } = await client
    .from<Post>('posts')
    .select(`
      id,
      title,
      content,
      created_at,
      author:users(name, email)
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .execute();

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (
    <div className="posts-container">
      <h1>Latest Posts</h1>
      {posts?.map(post => (
        <article key={post.id} className="post-card">
          <h2>{post.title}</h2>
          <p className="post-meta">
            By {post.author.name} on {new Date(post.created_at).toLocaleDateString()}
          </p>
          <div className="post-content">
            {post.content}
          </div>
        </article>
      ))}
    </div>
  );
}
```

### Client Components

```typescript
// app/components/PostForm.tsx
'use client';

import { useState } from 'react';
import { createClientComponent } from 'pgrestify/nextjs';
import { useRouter } from 'next/navigation';

const client = createClientComponent();

export default function PostForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: post, error } = await client
        .from('posts')
        .insert({
          title,
          content,
          author_id: 'current-user-id', // Get from auth context
          published: false
        })
        .single()
        .execute();

      if (error) {
        throw new Error(error.message);
      }

      router.push(`/posts/${post.id}`);
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="post-form">
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      
      <div>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          required
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
}
```

## Pages Router Integration

### getServerSideProps

```typescript
// pages/posts.tsx
import { GetServerSideProps } from 'next';
import { createGetServerSideProps } from 'pgrestify/nextjs';

interface PostsPageProps {
  posts: Post[];
}

export default function PostsPage({ posts }: PostsPageProps) {
  return (
    <div>
      <h1>Posts</h1>
      {posts.map(post => (
        <div key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<PostsPageProps> = 
  createGetServerSideProps(async ({ client, query }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const { data: posts, error } = await client
      .from<Post>('posts')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
      .execute();

    if (error) {
      return {
        notFound: true
      };
    }

    return {
      props: {
        posts: posts || []
      }
    };
  });
```

### getStaticProps with ISR

```typescript
// pages/posts/[id].tsx
import { GetStaticProps, GetStaticPaths } from 'next';
import { createGetStaticProps } from 'pgrestify/nextjs';

interface PostPageProps {
  post: Post;
}

export default function PostPage({ post }: PostPageProps) {
  return (
    <div>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const client = createServerClient();
  
  const { data: posts } = await client
    .from<Post>('posts')
    .select('id')
    .eq('published', true)
    .execute();

  const paths = posts?.map((post) => ({
    params: { id: post.id }
  })) || [];

  return {
    paths,
    fallback: 'blocking'
  };
};

export const getStaticProps: GetStaticProps<PostPageProps> = 
  createGetStaticProps(async ({ client, params }) => {
    const { data: post, error } = await client
      .from<Post>('posts')
      .select('*')
      .eq('id', params?.id as string)
      .single()
      .execute();

    if (error || !post) {
      return {
        notFound: true
      };
    }

    return {
      props: {
        post
      },
      revalidate: 60 // Revalidate every minute
    };
  });
```

## Authentication Integration

### Middleware

```typescript
// middleware.ts
import { createAuthMiddleware } from 'pgrestify/nextjs';

export const middleware = createAuthMiddleware({
  protectedPaths: ['/dashboard', '/admin'],
  publicPaths: ['/login', '/signup'],
  signInUrl: '/login',
  validateAuth: async (request) => {
    // Custom auth validation logic
    const token = request.cookies.get('auth-token');
    return !!token && isValidToken(token.value);
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

### Protected Pages

```typescript
// app/dashboard/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import { getServerSession } from 'pgrestify/nextjs';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login');
  }
  
  const client = createServerClient();
  
  // Queries automatically include user context from session
  const { data: userPosts } = await client
    .from('posts')
    .select('*')
    .eq('author_id', session.user.id)
    .execute();

  return (
    <div>
      <h1>Welcome, {session.user.email}</h1>
      <h2>Your Posts ({userPosts?.length || 0})</h2>
      {userPosts?.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.published ? 'Published' : 'Draft'}</p>
        </div>
      ))}
    </div>
  );
}
```

## Caching and Performance

### Next.js Cache Integration

```typescript
// app/posts/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import { unstable_cache } from 'next/cache';

const getCachedPosts = unstable_cache(
  async () => {
    const client = createServerClient();
    return await client
      .from('posts')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .execute();
  },
  ['posts'], // Cache key
  {
    tags: ['posts'], // Revalidation tags
    revalidate: 3600 // 1 hour
  }
);

export default async function PostsPage() {
  const { data: posts } = await getCachedPosts();
  
  return (
    <div>
      {posts?.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Environment-Based Configuration

```typescript
// lib/config.ts
const config = {
  development: {
    url: 'http://localhost:3000',
    cache: false, // Disable caching in development
    logging: true
  },
  production: {
    url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
    cache: true,
    logging: false,
    edge: true // Enable edge runtime in production
  }
};

export const getConfig = () => {
  return config[process.env.NODE_ENV as keyof typeof config] || config.development;
};
```

### 2. Error Boundaries

```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### 3. TypeScript Configuration

```typescript
// types/database.ts
export interface Database {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          author_id: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          author_id: string;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          author_id?: string;
          published?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

// Use with client
const client = createNextJSClient<Database>({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!
});
```

## Summary

PGRestify's Next.js integration provides:

- **Universal Router Support**: Works with both App Router and Pages Router
- **Optimized Data Fetching**: Server-side rendering with automatic caching
- **Authentication Integration**: Built-in auth middleware and session management
- **Performance Features**: Edge Runtime, streaming, and advanced caching
- **Type Safety**: Full TypeScript support with Next.js-specific types
- **Developer Experience**: Intuitive APIs that feel native to Next.js

The integration enables building fast, scalable Next.js applications with PostgreSQL databases through PostgREST, with minimal configuration and maximum performance.