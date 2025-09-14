# Static Generation

Static Site Generation (SSG) pre-renders pages at build time, creating fast-loading static HTML files. PGRestify enhances SSG with database-driven content, Incremental Static Regeneration (ISR), and on-demand revalidation for optimal performance and SEO.

## Overview

PGRestify SSG features:

- **Build-Time Generation**: Pre-render pages with database data
- **Incremental Static Regeneration**: Update static pages after deployment
- **On-Demand Revalidation**: Trigger updates when content changes
- **Dynamic Static Paths**: Generate paths based on database content
- **Partial Pre-rendering**: Mix static and server-rendered content
- **CDN Optimization**: Serve static files globally
- **SEO Benefits**: Perfect meta tags and structured data

## Basic Static Generation

### getStaticProps with PGRestify

```typescript
// pages/posts/index.tsx
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import { createGetStaticProps } from 'pgrestify/nextjs';
import Link from 'next/link';
import Head from 'next/head';

interface StaticPostsPageProps {
  posts: {
    id: string;
    title: string;
    excerpt: string;
    slug: string;
    created_at: string;
    reading_time: number;
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
  }[];
  categories: {
    id: string;
    name: string;
    post_count: number;
  }[];
  totalPosts: number;
  lastUpdated: string;
}

export default function StaticPostsPage({
  posts,
  categories,
  totalPosts,
  lastUpdated
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>Blog Posts - Latest Articles and Insights</title>
        <meta name="description" content={`Browse our ${totalPosts} articles covering technology, design, and development.`} />
        <meta property="og:title" content="Blog Posts - Latest Articles" />
        <meta property="og:description" content={`Browse our ${totalPosts} articles covering technology, design, and development.`} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://yourdomain.com/posts" />
        
        {/* Structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Blog',
              name: 'Our Blog',
              description: 'Latest articles and insights',
              url: 'https://yourdomain.com/posts',
              author: {
                '@type': 'Organization',
                name: 'Your Company'
              },
              blogPost: posts.map(post => ({
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt,
                url: `https://yourdomain.com/posts/${post.slug}`,
                datePublished: post.created_at,
                author: {
                  '@type': 'Person',
                  name: post.author.name
                }
              }))
            })
          }}
        />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Latest Posts</h1>
          <p className="text-gray-600 text-lg">
            Discover our {totalPosts} articles across {categories.length} categories
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {new Date(lastUpdated).toLocaleDateString()}
          </p>
        </header>

        {/* Categories */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Categories</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map(category => (
              <Link
                key={category.id}
                href={`/categories/${category.name.toLowerCase()}`}
                className="px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                {category.name} ({category.post_count})
              </Link>
            ))}
          </div>
        </section>

        {/* Posts grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map(post => (
            <article key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: post.category.color }}
                  >
                    {post.category.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {post.reading_time} min read
                  </span>
                </div>
                
                <h2 className="text-xl font-semibold mb-3">
                  <Link 
                    href={`/posts/${post.slug}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                
                <p className="text-gray-600 mb-4 line-clamp-3">{post.excerpt}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img 
                      src={post.author.avatar_url} 
                      alt={post.author.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm text-gray-700">{post.author.name}</span>
                  </div>
                  <time className="text-sm text-gray-500">
                    {new Date(post.created_at).toLocaleDateString()}
                  </time>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<StaticPostsPageProps> = createGetStaticProps(
  async ({ client }) => {
    // Fetch posts with all related data
    const { data: posts, error: postsError } = await client
      .from('posts')
      .select(`
        id,
        title,
        excerpt,
        slug,
        created_at,
        reading_time,
        author:users(id, name, avatar_url),
        category:categories(id, name, color)
      `)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(50); // Limit for performance

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    // Fetch categories with post counts
    const { data: categories, error: categoriesError } = await client
      .from('categories')
      .select(`
        id,
        name,
        posts:posts(count)
      `)
      .order('name');

    if (categoriesError) {
      throw new Error(`Failed to fetch categories: ${categoriesError.message}`);
    }

    // Get total posts count
    const { count: totalPosts } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('published', true);

    return {
      props: {
        posts: posts || [],
        categories: categories?.map(cat => ({
          id: cat.id,
          name: cat.name,
          post_count: cat.posts[0].count
        })) || [],
        totalPosts: totalPosts || 0,
        lastUpdated: new Date().toISOString()
      },
      // Revalidate every hour
      revalidate: 3600
    };
  }
);
```

### Dynamic Static Generation

```typescript
// pages/posts/[slug].tsx
import { GetStaticProps, GetStaticPaths, InferGetStaticPropsType } from 'next';
import { createGetStaticProps } from 'pgrestify/nextjs';
import Head from 'next/head';

interface StaticPostPageProps {
  post: {
    id: string;
    title: string;
    content: string;
    excerpt: string;
    slug: string;
    featured_image?: string;
    created_at: string;
    updated_at: string;
    reading_time: number;
    view_count: number;
    author: {
      id: string;
      name: string;
      bio: string;
      avatar_url: string;
      social_links?: Record<string, string>;
    };
    category: {
      id: string;
      name: string;
      color: string;
      description: string;
    };
    tags: {
      id: string;
      name: string;
      color: string;
    }[];
    seo: {
      meta_title?: string;
      meta_description?: string;
      canonical_url?: string;
    };
  };
  relatedPosts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    created_at: string;
    author: {
      name: string;
      avatar_url: string;
    };
  }[];
}

export default function StaticPostPage({
  post,
  relatedPosts
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const {
    title,
    content,
    excerpt,
    featured_image,
    created_at,
    updated_at,
    reading_time,
    view_count,
    author,
    category,
    tags,
    seo
  } = post;

  return (
    <>
      <Head>
        <title>{seo.meta_title || title}</title>
        <meta name="description" content={seo.meta_description || excerpt} />
        <link rel="canonical" href={seo.canonical_url || `https://yourdomain.com/posts/${post.slug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://yourdomain.com/posts/${post.slug}`} />
        {featured_image && <meta property="og:image" content={featured_image} />}
        <meta property="article:published_time" content={created_at} />
        <meta property="article:modified_time" content={updated_at} />
        <meta property="article:author" content={author.name} />
        <meta property="article:section" content={category.name} />
        {tags.map(tag => (
          <meta key={tag.id} property="article:tag" content={tag.name} />
        ))}
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={excerpt} />
        {featured_image && <meta name="twitter:image" content={featured_image} />}
        
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: title,
              description: excerpt,
              image: featured_image,
              url: `https://yourdomain.com/posts/${post.slug}`,
              datePublished: created_at,
              dateModified: updated_at,
              author: {
                '@type': 'Person',
                name: author.name,
                description: author.bio,
                image: author.avatar_url,
                sameAs: author.social_links ? Object.values(author.social_links) : []
              },
              publisher: {
                '@type': 'Organization',
                name: 'Your Company',
                logo: {
                  '@type': 'ImageObject',
                  url: 'https://yourdomain.com/logo.png'
                }
              },
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `https://yourdomain.com/posts/${post.slug}`
              },
              wordCount: content.split(' ').length,
              keywords: tags.map(tag => tag.name).join(', ')
            })
          }}
        />
      </Head>

      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Article Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </span>
            {tags.map(tag => (
              <span
                key={tag.id}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: tag.color, color: 'white' }}
              >
                #{tag.name}
              </span>
            ))}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {title}
          </h1>
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img 
                src={author.avatar_url} 
                alt={author.name}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="font-medium text-lg">{author.name}</div>
                <div className="text-gray-600">{author.bio}</div>
              </div>
            </div>
            
            <div className="text-right text-sm text-gray-600">
              <time dateTime={created_at}>
                {new Date(created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
              <div>{reading_time} min read</div>
              <div>{view_count.toLocaleString()} views</div>
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {featured_image && (
          <div className="mb-8">
            <img 
              src={featured_image} 
              alt={title}
              className="w-full h-64 md:h-96 object-cover rounded-lg shadow-lg"
            />
          </div>
        )}

        {/* Article Content */}
        <div 
          className="prose prose-lg max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">Related Posts</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {relatedPosts.map(relatedPost => (
                <article key={relatedPost.id} className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-2">
                    <Link href={`/posts/${relatedPost.slug}`}>
                      {relatedPost.title}
                    </Link>
                  </h3>
                  <p className="text-gray-600 mb-4">{relatedPost.excerpt}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <img 
                      src={relatedPost.author.avatar_url} 
                      alt={relatedPost.author.name}
                      className="w-6 h-6 rounded-full"
                    />
                    <span>{relatedPost.author.name}</span>
                    <span>•</span>
                    <time>{new Date(relatedPost.created_at).toLocaleDateString()}</time>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

export const getStaticProps: GetStaticProps<StaticPostPageProps> = createGetStaticProps(
  async ({ client, params }) => {
    const slug = params?.slug as string;

    // Get main post data
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
        updated_at,
        reading_time,
        view_count,
        category_id,
        author:users(
          id,
          name,
          bio,
          avatar_url,
          social_links
        ),
        category:categories(
          id,
          name,
          color,
          description
        ),
        tags:post_tags(
          tag:tags(id, name, color)
        ),
        seo:post_seo(
          meta_title,
          meta_description,
          canonical_url
        )
      `)
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error || !post) {
      return {
        notFound: true
      };
    }

    // Get related posts from same category
    const { data: relatedPosts } = await client
      .from('posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        created_at,
        author:users(name, avatar_url)
      `)
      .eq('category_id', post.category_id)
      .eq('published', true)
      .neq('id', post.id)
      .limit(4);

    return {
      props: {
        post: {
          ...post,
          tags: post.tags?.map(pt => pt.tag) || [],
          seo: post.seo || {}
        },
        relatedPosts: relatedPosts || []
      },
      // Revalidate every 6 hours
      revalidate: 21600
    };
  }
);

export const getStaticPaths: GetStaticPaths = async () => {
  const client = createServerClient();
  
  // Only pre-generate most popular posts at build time
  const { data: posts } = await client
    .from('posts')
    .select('slug')
    .eq('published', true)
    .order('view_count', { ascending: false })
    .limit(100); // Top 100 most viewed posts

  const paths = posts?.map(post => ({
    params: { slug: post.slug }
  })) || [];

  return {
    paths,
    // Enable ISR for other posts
    fallback: 'blocking'
  };
};
```

## Incremental Static Regeneration (ISR)

### Time-based Revalidation

```typescript
// pages/dashboard/stats.tsx
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import { createGetStaticProps } from 'pgrestify/nextjs';

interface StatsPageProps {
  stats: {
    totalPosts: number;
    totalUsers: number;
    totalComments: number;
    viewsThisMonth: number;
    topCategories: {
      name: string;
      post_count: number;
    }[];
    recentActivity: {
      type: string;
      description: string;
      created_at: string;
    }[];
  };
  generatedAt: string;
}

export default function StatsPage({ 
  stats, 
  generatedAt 
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Site Statistics</h1>
        <p className="text-gray-600">
          Generated at: {new Date(generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total Posts</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalPosts}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total Users</h3>
          <p className="text-3xl font-bold text-green-600">{stats.totalUsers}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total Comments</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.totalComments}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Views This Month</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.viewsThisMonth}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Top Categories */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Top Categories</h2>
          <div className="space-y-3">
            {stats.topCategories.map((category, index) => (
              <div key={category.name} className="flex justify-between items-center">
                <span className="font-medium">
                  #{index + 1} {category.name}
                </span>
                <span className="text-gray-600">{category.post_count} posts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="border-l-2 border-blue-500 pl-3">
                <p className="font-medium">{activity.type}</p>
                <p className="text-sm text-gray-600">{activity.description}</p>
                <p className="text-xs text-gray-500">
                  {new Date(activity.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps<StatsPageProps> = createGetStaticProps(
  async ({ client }) => {
    // Run all queries in parallel for better performance
    const [
      { count: totalPosts },
      { count: totalUsers },
      { count: totalComments },
      { data: topCategories },
      { data: recentActivity }
    ] = await Promise.all([
      client.from('posts').select('*', { count: 'exact', head: true }).eq('published', true),
      client.from('users').select('*', { count: 'exact', head: true }),
      client.from('comments').select('*', { count: 'exact', head: true }),
      client
        .from('categories')
        .select('name, posts:posts(count)')
        .order('posts.count', { ascending: false })
        .limit(5),
      client
        .from('activity_log')
        .select('type, description, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    // Calculate views this month (assuming you have a views table)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: viewsThisMonth } = await client
      .from('post_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    return {
      props: {
        stats: {
          totalPosts: totalPosts || 0,
          totalUsers: totalUsers || 0,
          totalComments: totalComments || 0,
          viewsThisMonth: viewsThisMonth || 0,
          topCategories: topCategories?.map(cat => ({
            name: cat.name,
            post_count: cat.posts[0].count
          })) || [],
          recentActivity: recentActivity || []
        },
        generatedAt: new Date().toISOString()
      },
      // Revalidate every 15 minutes
      revalidate: 900
    };
  }
);
```

### On-Demand Revalidation

```typescript
// pages/api/revalidate.ts
import { NextApiRequest, NextApiResponse } from 'next/server';
import { createRouteHandler } from 'pgrestify/nextjs';

export default createRouteHandler({
  POST: async ({ req, res }) => {
    // Validate revalidation secret
    if (req.query.secret !== process.env.REVALIDATION_SECRET) {
      return res.status(401).json({ error: 'Invalid secret' });
    }

    const { paths, tags } = req.body;

    try {
      // Revalidate specific paths
      if (paths && Array.isArray(paths)) {
        await Promise.all(
          paths.map((path: string) => res.revalidate(path))
        );
      }

      // Revalidate by tags (App Router)
      if (tags && Array.isArray(tags)) {
        const { revalidateTag } = await import('next/cache');
        tags.forEach((tag: string) => revalidateTag(tag));
      }

      return res.json({ 
        revalidated: true, 
        paths: paths || [], 
        tags: tags || [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Error revalidating',
        details: error.message 
      });
    }
  }
});

// Webhook handler for content changes
// pages/api/webhooks/content-updated.ts
export default createRouteHandler({
  POST: async ({ client, req, res }) => {
    const { entity, action, id } = req.body;

    try {
      let pathsToRevalidate: string[] = [];

      switch (entity) {
        case 'post':
          if (action === 'created' || action === 'updated' || action === 'deleted') {
            // Get post slug for specific revalidation
            if (id && (action === 'updated' || action === 'deleted')) {
              const { data: post } = await client
                .from('posts')
                .select('slug, category_id')
                .eq('id', id)
                .single();

              if (post) {
                pathsToRevalidate.push(`/posts/${post.slug}`);
                
                // Also revalidate category page
                const { data: category } = await client
                  .from('categories')
                  .select('name')
                  .eq('id', post.category_id)
                  .single();

                if (category) {
                  pathsToRevalidate.push(`/categories/${category.name.toLowerCase()}`);
                }
              }
            }
            
            // Always revalidate posts index
            pathsToRevalidate.push('/posts');
            pathsToRevalidate.push('/');
          }
          break;

        case 'category':
          if (action === 'created' || action === 'updated' || action === 'deleted') {
            pathsToRevalidate.push('/posts');
            pathsToRevalidate.push('/');
            
            if (id && (action === 'updated' || action === 'deleted')) {
              const { data: category } = await client
                .from('categories')
                .select('name')
                .eq('id', id)
                .single();

              if (category) {
                pathsToRevalidate.push(`/categories/${category.name.toLowerCase()}`);
              }
            }
          }
          break;

        default:
          // For unknown entities, revalidate homepage
          pathsToRevalidate.push('/');
      }

      // Trigger revalidation
      if (pathsToRevalidate.length > 0) {
        await Promise.all(
          pathsToRevalidate.map(path => res.revalidate(path))
        );
      }

      return res.json({
        success: true,
        revalidated: pathsToRevalidate,
        entity,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Revalidation error:', error);
      return res.status(500).json({
        error: 'Revalidation failed',
        details: error.message
      });
    }
  }
});
```

## App Router Static Generation

### Static Page Generation

```typescript
// app/posts/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import { Metadata } from 'next';

// Enable static generation
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

interface PostsPageData {
  posts: Post[];
  categories: Category[];
  totalCount: number;
}

async function getPostsData(): Promise<PostsPageData> {
  const client = createServerClient();

  const [
    { data: posts },
    { data: categories },
    { count: totalCount }
  ] = await Promise.all([
    client
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
      .limit(50),
    client
      .from('categories')
      .select('id, name, color')
      .order('name'),
    client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('published', true)
  ]);

  return {
    posts: posts || [],
    categories: categories || [],
    totalCount: totalCount || 0
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPostsData();

  return {
    title: 'Blog Posts - Latest Articles',
    description: `Browse our collection of ${totalCount} articles covering technology, design, and development.`,
    openGraph: {
      title: 'Blog Posts - Latest Articles',
      description: `Browse our collection of ${totalCount} articles covering technology, design, and development.`,
      type: 'website'
    }
  };
}

export default async function PostsPage() {
  const { posts, categories, totalCount } = await getPostsData();

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Latest Posts</h1>
        <p className="text-gray-600 text-lg">
          Discover our {totalCount} articles across {categories.length} categories
        </p>
      </header>

      {/* Categories */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Categories</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map(category => (
            <Link
              key={category.id}
              href={`/categories/${category.name.toLowerCase()}`}
              className="px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Posts */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
```

### Dynamic Static Routes

```typescript
// app/posts/[slug]/page.tsx
import { createServerClient } from 'pgrestify/nextjs';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PostPageProps {
  params: { slug: string };
}

// Enable static generation
export const dynamic = 'force-static';
export const dynamicParams = true; // Allow dynamic params not in generateStaticParams
export const revalidate = 21600; // 6 hours

async function getPost(slug: string) {
  const client = createServerClient();
  
  const { data: post, error } = await client
    .from('posts')
    .select(`
      *,
      author:users(id, name, bio, avatar_url, social_links),
      category:categories(id, name, color, description),
      tags:post_tags(tag:tags(id, name, color)),
      seo:post_seo(meta_title, meta_description, canonical_url)
    `)
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (error || !post) {
    return null;
  }

  return {
    ...post,
    tags: post.tags?.map(pt => pt.tag) || [],
    seo: post.seo || {}
  };
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await getPost(params.slug);

  if (!post) {
    return {
      title: 'Post Not Found'
    };
  }

  return {
    title: post.seo.meta_title || post.title,
    description: post.seo.meta_description || post.excerpt,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      authors: [post.author.name],
      images: post.featured_image ? [post.featured_image] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.featured_image ? [post.featured_image] : undefined
    },
    alternates: {
      canonical: post.seo.canonical_url
    }
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      {/* Post content */}
      <PostContent post={post} />
    </article>
  );
}

export async function generateStaticParams() {
  const client = createServerClient();
  
  // Generate params for most popular posts
  const { data: posts } = await client
    .from('posts')
    .select('slug')
    .eq('published', true)
    .order('view_count', { ascending: false })
    .limit(100);

  return posts?.map(post => ({
    slug: post.slug
  })) || [];
}
```

## Performance Optimization

### Build-Time Optimization

```typescript
// lib/static-data.ts
import { createServerClient } from 'pgrestify/nextjs';

// Cache frequently accessed data at build time
export async function getStaticSiteData() {
  const client = createServerClient();

  const [
    { data: featuredPosts },
    { data: categories },
    { data: tags },
    { data: siteSettings }
  ] = await Promise.all([
    client
      .from('posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        featured_image,
        created_at,
        author:users(name, avatar_url),
        category:categories(name, color)
      `)
      .eq('featured', true)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(5),
    
    client
      .from('categories')
      .select('id, name, slug, color, description')
      .order('name'),
    
    client
      .from('tags')
      .select('id, name, slug, color')
      .order('name')
      .limit(50),
      
    client
      .from('site_settings')
      .select('*')
      .single()
  ]);

  return {
    featuredPosts: featuredPosts || [],
    categories: categories || [],
    tags: tags || [],
    siteSettings: siteSettings || {}
  };
}

// Generate sitemap data
export async function generateSitemapData() {
  const client = createServerClient();

  const [
    { data: posts },
    { data: categories },
    { data: staticPages }
  ] = await Promise.all([
    client
      .from('posts')
      .select('slug, updated_at')
      .eq('published', true),
    
    client
      .from('categories')
      .select('slug, updated_at'),
      
    client
      .from('pages')
      .select('slug, updated_at')
      .eq('published', true)
  ]);

  return {
    posts: posts || [],
    categories: categories || [],
    pages: staticPages || []
  };
}
```

### RSS Feed Generation

```typescript
// app/feed.xml/route.ts
import { createServerClient } from 'pgrestify/nextjs';

export const dynamic = 'force-static';
export const revalidate = 3600;

function generateRSS(posts: any[], siteInfo: any) {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteInfo.title}</title>
    <description>${siteInfo.description}</description>
    <link>${siteInfo.url}</link>
    <atom:link href="${siteInfo.url}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${post.excerpt}]]></description>
      <link>${siteInfo.url}/posts/${post.slug}</link>
      <guid isPermaLink="true">${siteInfo.url}/posts/${post.slug}</guid>
      <pubDate>${new Date(post.created_at).toUTCString()}</pubDate>
      <category><![CDATA[${post.category.name}]]></category>
      <author>${post.author.email} (${post.author.name})</author>
    </item>
    `).join('')}
  </channel>
</rss>`;

  return rss.trim();
}

export async function GET() {
  const client = createServerClient();

  const [
    { data: posts },
    { data: siteSettings }
  ] = await Promise.all([
    client
      .from('posts')
      .select(`
        title,
        excerpt,
        slug,
        created_at,
        author:users(name, email),
        category:categories(name)
      `)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(50),
    
    client
      .from('site_settings')
      .select('title, description, url')
      .single()
  ]);

  const rss = generateRSS(posts || [], siteSettings || {});

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate'
    }
  });
}
```

### Sitemap Generation

```typescript
// app/sitemap.xml/route.ts
import { createServerClient } from 'pgrestify/nextjs';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

function generateSitemap(data: any) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL}/posts</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  ${data.posts.map((post: any) => `
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL}/posts/${post.slug}</loc>
    <lastmod>${new Date(post.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  `).join('')}
  ${data.categories.map((category: any) => `
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL}/categories/${category.slug}</loc>
    <lastmod>${new Date(category.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}
</urlset>`;

  return sitemap.trim();
}

export async function GET() {
  const client = createServerClient();

  const [
    { data: posts },
    { data: categories }
  ] = await Promise.all([
    client
      .from('posts')
      .select('slug, updated_at')
      .eq('published', true),
    
    client
      .from('categories')
      .select('slug, updated_at')
  ]);

  const sitemap = generateSitemap({
    posts: posts || [],
    categories: categories || []
  });

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=86400, stale-while-revalidate'
    }
  });
}
```

## Best Practices

### Static Generation Strategy

1. **Pre-render Popular Content**: Generate high-traffic pages at build time
2. **Use ISR for Updates**: Enable automatic updates without full rebuilds  
3. **Fallback for Long Tail**: Use `fallback: 'blocking'` for less popular content
4. **Cache Optimization**: Set appropriate revalidation times
5. **SEO Optimization**: Include structured data and meta tags

### Performance Tips

```typescript
// Optimize database queries for static generation
export const getStaticProps: GetStaticProps = createGetStaticProps(
  async ({ client }) => {
    // Use parallel queries for better performance
    const [posts, categories, stats] = await Promise.all([
      client.from('posts').select('*').eq('published', true).limit(50),
      client.from('categories').select('*'),
      client.from('posts').select('*', { count: 'exact', head: true })
    ]);

    return {
      props: {
        posts: posts.data || [],
        categories: categories.data || [],
        totalPosts: stats.count || 0
      },
      revalidate: 3600
    };
  }
);
```

### Error Handling

```typescript
// Handle errors gracefully in static generation
export const getStaticProps: GetStaticProps = createGetStaticProps(
  async ({ client }) => {
    try {
      const { data: posts, error } = await client
        .from('posts')
        .select('*')
        .eq('published', true);

      if (error) {
        console.error('Static generation error:', error);
        // Return fallback data or throw to show error page
        return {
          props: {
            posts: [],
            error: 'Failed to load posts'
          },
          revalidate: 60 // Retry in 1 minute
        };
      }

      return {
        props: { posts: posts || [] },
        revalidate: 3600
      };
    } catch (error) {
      console.error('Unexpected error:', error);
      throw error; // This will show the error page
    }
  }
);
```

## Deployment Considerations

### Build Performance

```bash
# Environment variables for build optimization
NEXT_BUILD_ONLY=true
NEXT_STATIC_ONLY=true

# Build command
npm run build && npm run export
```

### CDN Configuration

Configure your CDN to cache static assets and HTML files appropriately:

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=86400, stale-while-revalidate=604800'
          }
        ]
      }
    ];
  }
};
```

## Next Steps

- [Server-Side Rendering](./ssr.md) - Advanced SSR patterns
- [API Routes](./api-routes.md) - Building robust API endpoints  
- [Authentication](./auth.md) - Auth integration with SSG