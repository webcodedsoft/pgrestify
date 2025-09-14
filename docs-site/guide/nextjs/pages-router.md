# Pages Router

Next.js Pages Router is the traditional routing system that has powered Next.js applications since its inception. While App Router is the modern approach, Pages Router remains stable, well-supported, and perfect for many applications. PGRestify provides full support for Pages Router with optimized data fetching and SSR capabilities.

## Overview

Pages Router features supported by PGRestify:

- **File-based Routing**: Automatic routes based on file structure
- **Server-Side Rendering**: `getServerSideProps` with PGRestify integration  
- **Static Site Generation**: `getStaticProps` and `getStaticPaths`
- **API Routes**: Full-featured API endpoints in `/pages/api`
- **Incremental Static Regeneration**: Update static pages after build
- **Client-Side Navigation**: Optimized routing with `next/router`
- **Dynamic Routes**: `[id].js`, `[...slug].js`, and `[[...slug]].js`
- **Middleware**: Request/response processing

## Project Setup

### Install Dependencies

```bash
npm install pgrestify next@latest react@latest react-dom@latest
# or
pnpm add pgrestify next@latest react@latest react-dom@latest
```

### Directory Structure

```
pages/
├── _app.tsx               # App wrapper
├── _document.tsx          # HTML document structure
├── index.tsx              # Home page (/)
├── about.tsx              # About page (/about)
│
├── posts/
│   ├── index.tsx          # Posts list (/posts)
│   ├── [slug].tsx         # Post detail (/posts/my-post)
│   └── create.tsx         # Create post (/posts/create)
│
├── users/
│   ├── index.tsx          # Users list (/users)
│   ├── [id].tsx           # User profile (/users/123)
│   └── [...params].tsx    # Catch-all route (/users/a/b/c)
│
└── api/
    ├── auth/
    │   ├── login.ts
    │   └── logout.ts
    ├── posts/
    │   ├── index.ts
    │   └── [id].ts
    └── users.ts

lib/
├── client.ts              # PGRestify client
├── ssr.ts                 # SSR utilities
└── types.ts               # TypeScript types

styles/
├── globals.css            # Global styles
└── Home.module.css        # Component styles
```

### App Component Setup

```typescript
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { PGRestifyProvider } from 'pgrestify/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        cacheTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <PGRestifyProvider
        config={{
          url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        }}
      >
        <Component {...pageProps} />
        <ReactQueryDevtools initialIsOpen={false} />
      </PGRestifyProvider>
    </QueryClientProvider>
  );
}

// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Built with Next.js and PGRestify" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

## Server-Side Rendering (SSR)

### getServerSideProps Integration

```typescript
// pages/posts/index.tsx
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { createGetServerSideProps } from 'pgrestify/nextjs';
import Link from 'next/link';
import { useState } from 'react';

interface Post {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    avatar_url: string;
  };
  category: {
    id: string;
    name: string;
    color: string;
  };
}

interface PostsPageProps {
  posts: Post[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export default function PostsPage({ 
  posts, 
  totalCount, 
  currentPage, 
  totalPages 
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Posts ({totalCount})</h1>
        <Link 
          href="/posts/create"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Post
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search posts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border rounded-lg"
        />
      </div>

      {/* Posts grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts
          .filter(post => 
            post.title.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(post => (
            <article key={post.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <span 
                  className="px-2 py-1 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: post.category.color }}
                >
                  {post.category.name}
                </span>
              </div>
              
              <h2 className="text-xl font-semibold mb-2">
                <Link 
                  href={`/posts/${post.slug}`}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <Link
              key={page}
              href={`/posts?page=${page}`}
              className={`px-3 py-2 rounded ${
                page === currentPage 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Server-side props with PGRestify
export const getServerSideProps: GetServerSideProps<PostsPageProps> = createGetServerSideProps(
  async ({ client, query }) => {
    const page = parseInt(query.page as string || '1');
    const limit = 12;
    const offset = (page - 1) * limit;

    // Get posts with pagination
    const { data: posts, error } = await client
      .from('posts')
      .select(`
        id,
        title,
        excerpt,
        slug,
        created_at,
        author:users(id, name, avatar_url),
        category:categories(id, name, color)
      `)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    // Get total count
    const { count: totalCount } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('published', true);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      props: {
        posts: posts || [],
        totalCount: totalCount || 0,
        currentPage: page,
        totalPages
      }
    };
  }
);
```

### Dynamic Routes with getServerSideProps

```typescript
// pages/posts/[slug].tsx
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { createGetServerSideProps } from 'pgrestify/nextjs';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'pgrestify/react';

interface PostPageProps {
  post: {
    id: string;
    title: string;
    content: string;
    excerpt: string;
    slug: string;
    featured_image?: string;
    created_at: string;
    reading_time: number;
    author: {
      id: string;
      name: string;
      bio: string;
      avatar_url: string;
    };
    category: {
      id: string;
      name: string;
      color: string;
    };
  };
  initialComments: Comment[];
}

export default function PostPage({ 
  post, 
  initialComments 
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  // Client-side comments query (hydrates with initial data)
  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: ({ client }) => 
      client
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          author:users(id, name, avatar_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: false }),
    initialData: initialComments
  });

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: async ({ client, content }: { client: any; content: string }) => {
      const { data, error } = await client
        .from('comments')
        .insert({
          content,
          post_id: post.id,
          // author_id would come from auth context
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
      queryClient.setQueryData(['comments', post.id], (old: any[]) => 
        [newComment, ...(old || [])]
      );
      setNewComment('');
    }
  });

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>{post.title}</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        {post.featured_image && (
          <meta property="og:image" content={post.featured_image} />
        )}
        <meta property="og:type" content="article" />
      </Head>

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
            Comments ({comments?.length || 0})
          </h2>
          
          {/* Add comment form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (newComment.trim()) {
                addComment.mutate({ content: newComment });
              }
            }}
            className="mb-8"
          >
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
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {addComment.isPending ? 'Adding...' : 'Add Comment'}
            </button>
          </form>
          
          {/* Comments list */}
          <div className="space-y-6">
            {comments?.map(comment => (
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
    </>
  );
}

export const getServerSideProps: GetServerSideProps = createGetServerSideProps(
  async ({ client, params }) => {
    const slug = params?.slug as string;

    // Get post data
    const { data: post, error } = await client
      .from('posts')
      .select(`
        id,
        title,
        content,
        excerpt,
        slug,
        featured_image,
        created_at,
        reading_time,
        author:users(id, name, bio, avatar_url),
        category:categories(id, name, color)
      `)
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error || !post) {
      return {
        notFound: true
      };
    }

    // Get initial comments
    const { data: comments } = await client
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        author:users(id, name, avatar_url)
      `)
      .eq('post_id', post.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      props: {
        post,
        initialComments: comments || []
      }
    };
  }
);
```

## Static Site Generation (SSG)

### getStaticProps with ISR

```typescript
// pages/categories/[slug].tsx
import { GetStaticProps, GetStaticPaths, InferGetStaticPropsType } from 'next';
import { createGetStaticProps } from 'pgrestify/nextjs';

interface CategoryPageProps {
  category: {
    id: string;
    name: string;
    description: string;
    color: string;
    post_count: number;
  };
  posts: Post[];
}

export default function CategoryPage({ 
  category, 
  posts 
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">{category.name}</h1>
        <p className="text-gray-600 text-lg">{category.description}</p>
        <div className="text-sm text-gray-500">
          {category.post_count} posts in this category
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map(post => (
          <article key={post.id} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-2">
              <Link href={`/posts/${post.slug}`}>
                {post.title}
              </Link>
            </h2>
            <p className="text-gray-600 mb-4">{post.excerpt}</p>
            <time className="text-sm text-gray-500">
              {new Date(post.created_at).toLocaleDateString()}
            </time>
          </article>
        ))}
      </div>
    </div>
  );
}

// Generate static props with ISR
export const getStaticProps: GetStaticProps<CategoryPageProps> = createGetStaticProps(
  async ({ client, params }) => {
    const slug = params?.slug as string;

    // Get category
    const { data: category, error: categoryError } = await client
      .from('categories')
      .select(`
        id,
        name,
        description,
        color,
        slug,
        posts(count)
      `)
      .eq('slug', slug)
      .single();

    if (categoryError || !category) {
      return {
        notFound: true
      };
    }

    // Get posts in this category
    const { data: posts, error: postsError } = await client
      .from('posts')
      .select(`
        id,
        title,
        excerpt,
        slug,
        created_at,
        author:users(name)
      `)
      .eq('category_id', category.id)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    return {
      props: {
        category: {
          ...category,
          post_count: category.posts[0].count
        },
        posts: posts || []
      },
      revalidate: 3600 // Revalidate every hour
    };
  }
);

// Generate static paths
export const getStaticPaths: GetStaticPaths = async () => {
  const client = createServerClient();
  
  const { data: categories } = await client
    .from('categories')
    .select('slug')
    .limit(10); // Only generate top 10 categories at build time

  const paths = categories?.map(category => ({
    params: { slug: category.slug }
  })) || [];

  return {
    paths,
    fallback: 'blocking' // Generate other pages on-demand
  };
};
```

## Client-Side Routing

### useRouter Hook

```typescript
// pages/search.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useQuery } from 'pgrestify/react';

export default function SearchPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get search term from URL
  useEffect(() => {
    if (router.query.q) {
      setSearchTerm(router.query.q as string);
    }
  }, [router.query.q]);

  // Search query
  const { data: results, isLoading } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: ({ client }) => 
      client
        .from('posts')
        .select(`
          id,
          title,
          excerpt,
          slug,
          created_at,
          author:users(name)
        `)
        .textSearch('title,content', searchTerm)
        .eq('published', true)
        .limit(20),
    enabled: !!searchTerm
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Search Posts</h1>
      
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for posts..."
            className="flex-1 p-3 border rounded-lg"
          />
          <button 
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </form>

      {isLoading && <div>Searching...</div>}
      
      {results && (
        <div>
          <p className="mb-6 text-gray-600">
            Found {results.length} results for "{searchTerm}"
          </p>
          
          <div className="space-y-4">
            {results.map(post => (
              <article key={post.id} className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">
                  <Link href={`/posts/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 mb-2">{post.excerpt}</p>
                <div className="text-sm text-gray-500">
                  By {post.author.name} • {new Date(post.created_at).toLocaleDateString()}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## API Routes

### Basic API Routes

```typescript
// pages/api/posts/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandler } from 'pgrestify/nextjs';

export default createRouteHandler({
  GET: async ({ client, req, res }) => {
    const { page = '1', limit = '10', category } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let query = client
      .from('posts')
      .select(`
        id,
        title,
        excerpt,
        slug,
        created_at,
        author:users(name),
        category:categories(name)
      `)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data: posts, error } = await query;
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(200).json(posts);
  },
  
  POST: async ({ client, req, res }) => {
    const { title, content, category_id, published = false } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        error: 'Title and content are required' 
      });
    }
    
    const { data: post, error } = await client
      .from('posts')
      .insert({
        title,
        content,
        category_id,
        published,
        // author_id would come from session/auth
      })
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(201).json(post);
  }
});

// pages/api/posts/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandler } from 'pgrestify/nextjs';

export default createRouteHandler({
  GET: async ({ client, req, res }) => {
    const { id } = req.query;
    
    const { data: post, error } = await client
      .from('posts')
      .select(`
        *,
        author:users(id, name, bio, avatar_url),
        category:categories(id, name, color)
      `)
      .eq('id', id)
      .single();
    
    if (error || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.status(200).json(post);
  },
  
  PUT: async ({ client, req, res }) => {
    const { id } = req.query;
    const updates = req.body;
    
    const { data: post, error } = await client
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(200).json(post);
  },
  
  DELETE: async ({ client, req, res }) => {
    const { id } = req.query;
    
    const { error } = await client
      .from('posts')
      .delete()
      .eq('id', id);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.status(204).end();
  }
});
```

## Performance Optimizations

### Optimized Data Fetching

```typescript
// lib/ssr-helpers.ts
import { createServerClient } from 'pgrestify/nextjs';

export async function getPostsWithCache(page: number = 1, limit: number = 10) {
  const client = createServerClient();
  
  // Use client-side caching for frequently accessed data
  const cacheKey = `posts-page-${page}-limit-${limit}`;
  
  const { data: posts, error } = await client
    .from('posts')
    .select(`
      id,
      title,
      excerpt,
      slug,
      created_at,
      author:users(name, avatar_url),
      category:categories(name, color)
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  
  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }
  
  return posts;
}

// pages/posts/index.tsx (optimized)
export const getServerSideProps: GetServerSideProps = createGetServerSideProps(
  async ({ query }) => {
    const page = parseInt(query.page as string || '1');
    
    try {
      const posts = await getPostsWithCache(page);
      
      return {
        props: {
          posts,
          currentPage: page
        }
      };
    } catch (error) {
      return {
        props: {
          posts: [],
          currentPage: page,
          error: error.message
        }
      };
    }
  }
);
```

### Image Optimization

```typescript
// components/OptimizedImage.tsx
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function OptimizedImage({ 
  src, 
  alt, 
  width = 400, 
  height = 300, 
  className 
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      priority
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}
```

## Best Practices

### Error Handling

```typescript
// lib/error-handler.ts
export function withErrorHandling(handler: any) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      return await handler(req, res);
    } catch (error: any) {
      console.error('API Error:', error);
      
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      if (error.code === 'PGRST204') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}

// pages/api/posts/[id].ts (with error handling)
export default withErrorHandling(createRouteHandler({
  GET: async ({ client, req, res }) => {
    // Route implementation
  }
}));
```

### TypeScript Integration

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// lib/api-client.ts
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}
```

## Migration from Pages to App Router

When you're ready to migrate to App Router:

```typescript
// pages/posts/[slug].tsx → app/posts/[slug]/page.tsx
// getServerSideProps becomes a Server Component
export default async function PostPage({ params }: { params: { slug: string } }) {
  const client = createServerClient();
  
  const { data: post } = await client
    .from('posts')
    .select('*')
    .eq('slug', params.slug)
    .single();
    
  return <div>{/* Component JSX */}</div>;
}
```

## Next Steps

- [App Router](./nextjs-app-router) - Modern App Router integration
- [API Routes](./nextjs-api-routes) - Building robust API endpoints
- [Static Generation](./nextjs-ssg) - Advanced SSG patterns
- [Server-Side Rendering](./nextjs-ssr) - SSR optimization techniques
- [Authentication](./nextjs-auth) - Complete auth implementation