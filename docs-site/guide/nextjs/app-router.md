# App Router

Next.js App Router is the modern routing system built on React Server Components, providing powerful features like streaming, concurrent rendering, and advanced caching. PGRestify provides first-class support for App Router with optimized server and client components integration.

## Overview

App Router features supported by PGRestify:

- **React Server Components**: Direct database access in server components
- **Streaming & Suspense**: Progressive page loading with fallback UI
- **Parallel Routes**: Load multiple route segments simultaneously  
- **Intercepting Routes**: Intercept and modify route behavior
- **Route Groups**: Organize routes without affecting URL structure
- **Server Actions**: Type-safe server-side mutations
- **Middleware**: Request/response manipulation with edge runtime
- **Advanced Caching**: ISR, full-route cache, and data cache

## Project Setup

### Install Dependencies

```bash
npm install pgrestify next@latest react@latest react-dom@latest
# or
pnpm add pgrestify next@latest react@latest react-dom@latest
```

### Directory Structure

```
app/
├── layout.tsx              # Root layout
├── page.tsx               # Home page
├── loading.tsx            # Loading UI
├── error.tsx              # Error UI
├── not-found.tsx          # 404 page
├── global-error.tsx       # Global error boundary
│
├── (auth)/                # Route group
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
│
├── dashboard/
│   ├── layout.tsx         # Nested layout
│   ├── page.tsx           # Dashboard home
│   ├── @analytics/        # Parallel route
│   │   └── page.tsx
│   └── users/
│       ├── page.tsx       # Users list
│       └── [id]/
│           └── page.tsx   # User details
│
└── api/                   # API routes
    ├── auth/
    └── posts/
        └── route.ts

lib/
├── client.ts              # PGRestify client
├── server.ts              # Server utilities
└── types.ts               # TypeScript types
```

### Root Layout Setup

```typescript
// app/layout.tsx
import { PGRestifyProvider } from 'pgrestify/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'My App',
  description: 'Built with Next.js and PGRestify',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PGRestifyProvider
          config={{
            url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
            revalidate: {
              tags: ['posts', 'users', 'comments']
            }
          }}
        >
          {children}
        </PGRestifyProvider>
      </body>
    </html>
  );
}
```

## Server Components

### Basic Data Fetching

```typescript
// app/posts/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import Link from 'next/link';

// This page will be cached and regenerated in the background
export const revalidate = 3600; // 1 hour

export default async function PostsPage() {
  const client = createServerClient();
  
  const { data: posts, error } = await client
    .from('posts')
    .select(`
      id,
      title,
      excerpt,
      created_at,
      author:users(id, name, avatar_url),
      category:categories(id, name, color)
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Latest Posts</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts?.map(post => (
          <article key={post.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <span 
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: post.category.color }}
              >
                {post.category.name}
              </span>
            </div>
            
            <h2 className="text-xl font-semibold mb-2">
              <Link 
                href={`/posts/${post.id}`}
                className="hover:text-blue-600 transition-colors"
              >
                {post.title}
              </Link>
            </h2>
            
            <p className="text-gray-600 mb-4">{post.excerpt}</p>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <img 
                src={post.author.avatar_url} 
                alt={post.author.name}
                className="w-6 h-6 rounded-full"
              />
              <span>{post.author.name}</span>
              <span>•</span>
              <time>{new Date(post.created_at).toLocaleDateString()}</time>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// Generate metadata
export async function generateMetadata() {
  const client = createServerClient();
  const { count } = await client.from('posts').select('*', { count: 'exact', head: true });
  
  return {
    title: `Posts (${count}) - My Blog`,
    description: `Browse our collection of ${count} articles and insights.`
  };
}
```

### Dynamic Routes with Params

```typescript
// app/posts/[slug]/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

interface PostPageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function PostPage({ params }: PostPageProps) {
  const client = createServerClient();
  
  const { data: post, error } = await client
    .from('posts')
    .select(`
      *,
      author:users(id, name, bio, avatar_url),
      category:categories(id, name, color),
      comments:comments(
        id,
        content,
        created_at,
        author:users(id, name, avatar_url)
      )
    `)
    .eq('slug', params.slug)
    .eq('published', true)
    .single();

  if (error || !post) {
    notFound();
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      {/* Article header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: post.category.color }}
          >
            {post.category.name}
          </span>
        </div>
        
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        
        <div className="flex items-center gap-4 text-gray-600">
          <div className="flex items-center gap-2">
            <img 
              src={post.author.avatar_url} 
              alt={post.author.name}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <div className="font-medium">{post.author.name}</div>
              <div className="text-sm">{post.author.bio}</div>
            </div>
          </div>
          
          <div className="text-sm">
            <time>{new Date(post.created_at).toLocaleDateString()}</time>
            <span className="mx-2">•</span>
            <span>{post.reading_time} min read</span>
          </div>
        </div>
      </header>

      {/* Featured image */}
      {post.featured_image && (
        <img 
          src={post.featured_image} 
          alt={post.title}
          className="w-full h-64 object-cover rounded-lg mb-8"
        />
      )}

      {/* Article content */}
      <div 
        className="prose prose-lg max-w-none mb-12"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Comments section */}
      <section className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">
          Comments ({post.comments?.length || 0})
        </h2>
        
        <div className="space-y-6">
          {post.comments?.map(comment => (
            <div key={comment.id} className="flex gap-4">
              <img 
                src={comment.author.avatar_url} 
                alt={comment.author.name}
                className="w-10 h-10 rounded-full flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{comment.author.name}</span>
                  <time className="text-sm text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </time>
                </div>
                <p className="text-gray-700">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const client = createServerClient();
  
  const { data: post } = await client
    .from('posts')
    .select('title, excerpt, featured_image, author:users(name)')
    .eq('slug', params.slug)
    .single();

  if (!post) {
    return {
      title: 'Post Not Found'
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.featured_image ? [post.featured_image] : undefined,
    }
  };
}

// Generate static params for ISG
export async function generateStaticParams() {
  const client = createServerClient();
  
  const { data: posts } = await client
    .from('posts')
    .select('slug')
    .eq('published', true)
    .limit(100); // Generate top 100 posts at build time

  return posts?.map(post => ({
    slug: post.slug
  })) || [];
}
```

## Client Components

### Interactive Components

```typescript
// app/posts/[id]/comments.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'pgrestify/nextjs';
import { useSession } from 'pgrestify/nextjs';

interface CommentsProps {
  postId: string;
}

export default function Comments({ postId }: CommentsProps) {
  const [newComment, setNewComment] = useState('');
  const { user, isAuthenticated } = useSession();
  const queryClient = useQueryClient();

  // Query comments
  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: ({ client }) => 
      client
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          author:users(id, name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
  });

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: async ({ client, content }: { client: any; content: string }) => {
      const { data, error } = await client
        .from('comments')
        .insert({
          content,
          post_id: postId,
          author_id: user?.id
        })
        .select(`
          id,
          content,
          created_at,
          author:users(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    
    onSuccess: (newComment) => {
      // Add to cache optimistically
      queryClient.setQueryData(['comments', postId], (old: any[]) => 
        [newComment, ...(old || [])]
      );
      setNewComment('');
    },
    
    onError: (error) => {
      console.error('Failed to add comment:', error);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;
    
    addComment.mutate({ content: newComment });
  };

  if (isLoading) {
    return <div>Loading comments...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add comment form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full p-3 border rounded-lg resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || addComment.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {addComment.isPending ? 'Adding...' : 'Add Comment'}
          </button>
        </form>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-600">Please sign in to comment</p>
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-4">
        {comments?.map(comment => (
          <div key={comment.id} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
            <img 
              src={comment.author.avatar_url} 
              alt={comment.author.name}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{comment.author.name}</span>
                <time className="text-sm text-gray-500">
                  {new Date(comment.created_at).toLocaleDateString()}
                </time>
              </div>
              <p className="text-gray-700">{comment.content}</p>
            </div>
          </div>
        ))}
        
        {comments?.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}
```

## Streaming & Suspense

### Progressive Loading

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react';
import { UserStats } from './user-stats';
import { RecentPosts } from './recent-posts';
import { Analytics } from './analytics';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Fast loading component */}
        <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded"></div>}>
          <UserStats />
        </Suspense>
        
        {/* Slower loading component */}
        <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded"></div>}>
          <RecentPosts />
        </Suspense>
        
        {/* Very slow loading component */}
        <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded"></div>}>
          <Analytics />
        </Suspense>
      </div>
    </div>
  );
}

// app/dashboard/user-stats.tsx
import { createServerClient } from 'pgrestify/nextjs';

export async function UserStats() {
  const client = createServerClient();
  
  const [
    { count: postsCount },
    { count: commentsCount },
    { count: likesCount }
  ] = await Promise.all([
    client.from('posts').select('*', { count: 'exact', head: true }),
    client.from('comments').select('*', { count: 'exact', head: true }),
    client.from('likes').select('*', { count: 'exact', head: true })
  ]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Your Stats</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Posts:</span>
          <span className="font-medium">{postsCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Comments:</span>
          <span className="font-medium">{commentsCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Likes:</span>
          <span className="font-medium">{likesCount}</span>
        </div>
      </div>
    </div>
  );
}
```

## Server Actions

### Form Handling with Server Actions

```typescript
// app/posts/create/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';

async function createPost(formData: FormData) {
  'use server';
  
  const client = createServerClient();
  
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const categoryId = formData.get('category_id') as string;
  
  if (!title || !content) {
    throw new Error('Title and content are required');
  }

  const { data: post, error } = await client
    .from('posts')
    .insert({
      title,
      content,
      category_id: parseInt(categoryId),
      published: true
    })
    .select('id, slug')
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  // Revalidate cached data
  revalidateTag('posts');
  
  // Redirect to the new post
  redirect(`/posts/${post.slug}`);
}

export default async function CreatePostPage() {
  const client = createServerClient();
  
  const { data: categories } = await client
    .from('categories')
    .select('id, name')
    .order('name');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Create New Post</h1>
      
      <form action={createPost} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="category_id" className="block text-sm font-medium mb-2">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a category</option>
            {categories?.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-2">
            Content
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Post
        </button>
      </form>
    </div>
  );
}
```

## Advanced Patterns

### Parallel Routes

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  notifications
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-3">{children}</div>
      <div className="space-y-6">
        {analytics}
        {notifications}
      </div>
    </div>
  );
}

// app/dashboard/@analytics/page.tsx
import { createServerClient } from 'pgrestify/nextjs';

export default async function Analytics() {
  const client = createServerClient();
  
  const { data: stats } = await client
    .rpc('get_dashboard_stats')
    .single();

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold mb-2">Analytics</h3>
      <div className="space-y-2 text-sm">
        <div>Page Views: {stats?.page_views}</div>
        <div>Unique Visitors: {stats?.unique_visitors}</div>
      </div>
    </div>
  );
}

// app/dashboard/@notifications/page.tsx
import { createServerClient } from 'pgrestify/nextjs';

export default async function Notifications() {
  const client = createServerClient();
  
  const { data: notifications } = await client
    .from('notifications')
    .select('*')
    .eq('read', false)
    .limit(5);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold mb-2">Notifications</h3>
      <div className="space-y-2">
        {notifications?.map(notification => (
          <div key={notification.id} className="text-sm p-2 bg-blue-50 rounded">
            {notification.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Route Handlers

```typescript
// app/api/posts/route.ts
import { createServerClient } from 'pgrestify/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  const client = createServerClient();
  const { searchParams } = new URL(request.url);
  
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  let query = client
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
    
  if (category) {
    query = query.eq('category', category);
  }
  
  const { data: posts, error } = await query
    .range((page - 1) * limit, page * limit - 1);
    
  if (error) {
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
  
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const client = createServerClient();
  
  try {
    const body = await request.json();
    
    const { data: post, error } = await client
      .from('posts')
      .insert(body)
      .select()
      .single();
      
    if (error) {
      return NextResponse.json(
        { error: error.message }, 
        { status: 400 }
      );
    }
    
    revalidateTag('posts');
    
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' }, 
      { status: 400 }
    );
  }
}
```

## Performance Optimization

### Caching Strategies

```typescript
// Automatic cache with tags
export const revalidate = 3600; // Cache for 1 hour
export const dynamic = 'force-static'; // Force static generation

// Manual cache control
import { unstable_cache } from 'next/cache';

const getCachedPosts = unstable_cache(
  async () => {
    const client = createServerClient();
    return client.from('posts').select('*');
  },
  ['posts-cache'],
  { revalidate: 3600, tags: ['posts'] }
);
```

### Edge Runtime

```typescript
// app/api/search/route.ts
import { createServerClient } from 'pgrestify/nextjs';

export const runtime = 'edge';

export async function GET(request: Request) {
  const client = createServerClient({
    fetch: fetch // Use edge-compatible fetch
  });
  
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return Response.json({ error: 'Query parameter required' }, { status: 400 });
  }
  
  const { data: results } = await client
    .from('posts')
    .select('id, title, excerpt')
    .textSearch('title', query)
    .limit(10);
    
  return Response.json(results);
}
```

## Best Practices

### Error Handling

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}

// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-gray-600 mb-4">Could not find the requested resource.</p>
      <Link 
        href="/"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Return Home
      </Link>
    </div>
  );
}
```

### TypeScript Integration

```typescript
// lib/types.ts
export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  author: User;
  category: Category;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}
```

## Deployment

### Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_POSTGREST_URL=http://localhost:3000
POSTGREST_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
```

### Production Build

```bash
npm run build
npm run start
```

## Next Steps

- [Pages Router](./nextjs-pages-router) - Legacy Pages Router integration
- [API Routes](./nextjs-api-routes) - Building robust API endpoints
- [Server-Side Rendering](./nextjs-ssr) - Advanced SSR patterns
- [Static Generation](./nextjs-ssg) - Pre-rendering and ISR
- [Authentication](./nextjs-auth) - Complete auth implementation