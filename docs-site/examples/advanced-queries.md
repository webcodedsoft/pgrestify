# Advanced Queries Example

Comprehensive guide to advanced querying techniques in PGRestify.

## Complex Filtering and Joins

```typescript
import { createClient } from '@webcoded/pgrestify';

// Define interfaces for type safety
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'moderator';
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

const client = createClient('http://localhost:3000');

// Modern approach: Relations array with aliases and multiple sorting
async function getAdvancedUserPostsModern() {
  const modernQuery = await client
    .from<User>('users')
    .select([
      'id AS user_id',
      'name AS author_name',
      'email AS contact_email',
      'posts.id AS post_id',
      'posts.title AS post_title',
      'posts.content AS post_content',
      'posts.tags',
      'posts.created_at AS published_date',
      'posts.comments.id AS comment_id',
      'posts.comments.content AS comment_text',
      'posts.comments.author.name AS commenter_name'
    ])
    .relations(['posts.comments.author'])
    .eq('role', 'admin')
    .gte('posts.created_at', '2023-01-01')
    .order('name')                                    // Primary: Author name
    .order('posts.created_at', { ascending: false })  // Secondary: Latest posts
    .order('posts.comments.created_at', { ascending: false })  // Tertiary: Recent comments
    .execute();

  return modernQuery.data;
}

// Traditional PostgREST syntax for comparison
async function getAdvancedUserPostsTraditional() {
  const traditionalQuery = await client
    .from<User>('users')
    .select(`
      id, 
      name, 
      email,
      posts:posts(
        id, 
        title, 
        content, 
        tags,
        comments:comments(
          id, 
          content, 
          author:users(name, email)
        )
      )
    `)
    .eq('role', 'admin')
    .gte('posts.created_at', '2023-01-01')
    .contains('posts.tags', ['typescript', 'postgresql'])
    .order('posts.created_at', { ascending: false })
    .limit(10)
    .execute();

  return complexQuery;
}
```

## Aggregation and Grouping

```typescript
// Advanced aggregation with grouping and filtering
async function getUserPostStatistics() {
  const aggregationQuery = await client
    .from<User>('users')
    .select(`
      role,
      count(*) as user_count,
      avg(posts:posts(count)) as avg_posts_per_user,
      sum(posts:posts(views)) as total_post_views,
      max(posts:posts(created_at)) as latest_post_date
    `)
    .groupBy('role')
    .having('count(*) > 5')
    .order('total_post_views', { ascending: false })
    .execute();

  return aggregationQuery;
}
```

## Full-Text Search with Ranking

```typescript
// Advanced full-text search with ranking
async function searchPostsWithRanking(searchTerm: string) {
  const searchQuery = await client
    .from<Post>('posts')
    .select(`
      *,
      ts_rank(to_tsvector(content), plainto_tsquery($1)) as rank
    `)
    .fts('content', searchTerm)
    .order('rank', { ascending: false })
    .limit(20)
    .execute();

  return searchQuery;
}
```

## Advanced Examples: Combining Relations, Aliases, and Sorting

### E-commerce Product Catalog

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  category_id: number;
  brand_id: number;
  active: boolean;
}

// Advanced product search with comprehensive sorting
async function getProductCatalogAdvanced(filters: {
  categoryId?: number;
  brandId?: number;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
}) {
  let query = client
    .from<Product>('products')
    .select([
      'id AS product_id',
      'name AS product_name',
      'price AS current_price',
      'description AS product_description',
      'category.name AS category_name',
      'category.slug AS category_slug',
      'brand.name AS brand_name',
      'brand.logo_url AS brand_logo',
      'reviews.average_rating AS avg_rating',
      'reviews.total_count AS review_count',
      'inventory.stock_quantity AS stock_level',
      'inventory.status AS availability_status'
    ])
    .relations(['category', 'brand', 'reviews', 'inventory'])
    .eq('active', true);

  // Apply dynamic filters
  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }
  
  if (filters.brandId) {
    query = query.eq('brand_id', filters.brandId);
  }
  
  if (filters.minPrice) {
    query = query.gte('price', filters.minPrice);
  }
  
  if (filters.maxPrice) {
    query = query.lte('price', filters.maxPrice);
  }
  
  if (filters.searchTerm) {
    query = query.ilike('name', `%${filters.searchTerm}%`);
  }

  // Complex multi-level sorting
  return query
    .order('inventory.status')                     // In-stock first
    .order('category.name')                        // Group by category
    .order('reviews.average_rating', { ascending: false })  // Best rated
    .order('reviews.total_count', { ascending: false })     // Most reviewed
    .order('price')                                // Cheapest first
    .order('name')                                 // Alphabetical
    .execute();
}

// Repository pattern for complex business logic
const productRepo = client.getRepository<Product>('products');

async function getFeaturedProductsAdvanced() {
  return productRepo
    .createQueryBuilder()
    .select([
      'id AS product_id',
      'name AS product_name',
      'price AS current_price',
      'featured_until AS feature_expires',
      'category.name AS category_name',
      'brand.name AS brand_name',
      'reviews.average_rating AS rating',
      'sales.total_sold AS units_sold',
      'inventory.stock_quantity AS stock'
    ])
    .relations(['category', 'brand', 'reviews', 'sales', 'inventory'])
    .where('featured = :featured', { featured: true })
    .andWhere('featured_until > :now', { now: new Date() })
    .andWhere('inventory.stock_quantity > :minStock', { minStock: 0 })
    .orderBy('sales.total_sold', 'DESC')           // Best sellers first
    .addOrderBy('reviews.average_rating', 'DESC')  // Then by rating
    .addOrderBy('featured_until', 'ASC')           // Expiring soon first
    .addOrderBy('price', 'ASC')                    // Then by price
    .limit(20)
    .getMany();
}
```

### Content Management System

```typescript
interface Article {
  id: number;
  title: string;
  content: string;
  author_id: number;
  category_id: number;
  published: boolean;
  created_at: string;
}

// Advanced CMS query with comprehensive relationships
async function getCMSContentAdvanced() {
  return client
    .from<Article>('articles')
    .select([
      'id AS article_id',
      'title AS article_title',
      'excerpt AS article_excerpt',
      'published_at AS publication_date',
      'author.first_name AS author_first_name',
      'author.last_name AS author_last_name',
      'author.bio AS author_bio',
      'author.avatar_url AS author_avatar',
      'category.name AS category_name',
      'category.slug AS category_slug',
      'tags.name AS tag_name',
      'comments.content AS comment_text',
      'comments.author.name AS commenter_name',
      'comments.created_at AS comment_date',
      'analytics.view_count AS total_views',
      'analytics.share_count AS total_shares'
    ])
    .relations([
      'author', 
      'category', 
      'tags', 
      'comments.author', 
      'analytics'
    ])
    .eq('published', true)
    .gte('published_at', '2024-01-01')
    .order('analytics.view_count', { ascending: false })    // Most viewed first
    .order('published_at', { ascending: false })            // Recent content
    .order('comments.created_at', { ascending: false })     // Recent engagement
    .order('category.name')                                 // Group by category
    .execute();
}

// Advanced search across multiple content types
async function searchContentAdvanced(searchTerm: string) {
  const [articles, tutorials, videos] = await Promise.all([
    // Articles with comprehensive data
    client
      .from('articles')
      .select([
        'id AS content_id',
        '"article" AS content_type',
        'title AS content_title',
        'excerpt AS content_excerpt',
        'author.name AS author_name',
        'category.name AS category_name',
        'published_at AS content_date',
        'analytics.view_count AS popularity_score'
      ])
      .relations(['author', 'category', 'analytics'])
      .textSearch('title,content', searchTerm)
      .eq('published', true)
      .order('analytics.view_count', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(10)
      .execute(),

    // Tutorials with difficulty and duration
    client
      .from('tutorials')
      .select([
        'id AS content_id',
        '"tutorial" AS content_type',
        'title AS content_title',
        'description AS content_excerpt',
        'difficulty_level AS difficulty',
        'estimated_duration AS duration',
        'instructor.name AS author_name',
        'topic.name AS category_name',
        'created_at AS content_date',
        'enrollments.total_count AS popularity_score'
      ])
      .relations(['instructor', 'topic', 'enrollments'])
      .textSearch('title,description', searchTerm)
      .eq('active', true)
      .order('difficulty_level')  // Beginner first
      .order('enrollments.total_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
      .execute(),

    // Videos with view statistics
    client
      .from('videos')
      .select([
        'id AS content_id',
        '"video" AS content_type',
        'title AS content_title',
        'description AS content_excerpt',
        'duration_seconds AS video_duration',
        'creator.name AS author_name',
        'playlist.name AS category_name',
        'uploaded_at AS content_date',
        'stats.view_count AS popularity_score'
      ])
      .relations(['creator', 'playlist', 'stats'])
      .textSearch('title,description', searchTerm)
      .eq('published', true)
      .order('stats.view_count', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .limit(10)
      .execute()
  ]);

  // Combine and sort all results by popularity
  const allContent = [
    ...(articles.data || []),
    ...(tutorials.data || []),
    ...(videos.data || [])
  ].sort((a, b) => {
    // Multi-criteria sorting in JavaScript
    if (b.popularity_score !== a.popularity_score) {
      return b.popularity_score - a.popularity_score;
    }
    return new Date(b.content_date).getTime() - new Date(a.content_date).getTime();
  });

  return allContent;
}
```

### Analytics Dashboard

```typescript
// Complex analytics query with multiple aggregations
async function getAnalyticsDashboard(dateRange: { start: string; end: string }) {
  return client
    .from('page_views')
    .select([
      'page.title AS page_title',
      'page.url AS page_url',
      'page.category.name AS page_category',
      'user.country AS visitor_country',
      'user.device_type AS device_type',
      'session.referrer_domain AS traffic_source',
      'count(*) AS total_views',
      'count(DISTINCT user_id) AS unique_visitors',
      'avg(session.duration_seconds) AS avg_session_duration',
      'sum(CASE WHEN converted = true THEN 1 ELSE 0 END) AS conversions'
    ])
    .relations(['page.category', 'user', 'session'])
    .gte('created_at', dateRange.start)
    .lte('created_at', dateRange.end)
    .groupBy([
      'page.title',
      'page.url', 
      'page.category.name',
      'user.country',
      'user.device_type',
      'session.referrer_domain'
    ])
    .having('count(*) > 10')  // Minimum views threshold
    .order('total_views', { ascending: false })         // Most viewed
    .order('unique_visitors', { ascending: false })     // Most unique visitors
    .order('conversions', { ascending: false })         // Most conversions
    .order('page.category.name')                        // Group by category
    .limit(100)
    .execute();
}
```

### Dynamic Query Builder

```typescript
// Advanced dynamic query builder with all features
class AdvancedQueryBuilder {
  private client: any;
  
  constructor(client: any) {
    this.client = client;
  }

  async buildDynamicQuery(options: {
    table: string;
    fields: Array<{ field: string; alias?: string }>;
    relations: string[];
    filters: Array<{ field: string; operator: string; value: any }>;
    sorts: Array<{ field: string; direction: 'asc' | 'desc' }>;
    limit?: number;
  }) {
    // Build select array with aliases
    const selectFields = options.fields.map(field => {
      return field.alias ? `${field.field} AS ${field.alias}` : field.field;
    });

    // Start building the query
    let query = this.client
      .from(options.table)
      .select(selectFields);

    // Add relations
    if (options.relations.length > 0) {
      query = query.relations(options.relations);
    }

    // Add dynamic filters
    options.filters.forEach(filter => {
      switch (filter.operator) {
        case 'eq':
          query = query.eq(filter.field, filter.value);
          break;
        case 'gte':
          query = query.gte(filter.field, filter.value);
          break;
        case 'lte':
          query = query.lte(filter.field, filter.value);
          break;
        case 'ilike':
          query = query.ilike(filter.field, `%${filter.value}%`);
          break;
        case 'in':
          query = query.in(filter.field, filter.value);
          break;
      }
    });

    // Add dynamic sorting
    options.sorts.forEach(sort => {
      query = query.order(sort.field, { ascending: sort.direction === 'asc' });
    });

    // Add limit if specified
    if (options.limit) {
      query = query.limit(options.limit);
    }

    return query.execute();
  }
}

// Usage example
const queryBuilder = new AdvancedQueryBuilder(client);

const dynamicResult = await queryBuilder.buildDynamicQuery({
  table: 'orders',
  fields: [
    { field: 'id', alias: 'order_id' },
    { field: 'total', alias: 'order_total' },
    { field: 'customer.name', alias: 'customer_name' },
    { field: 'items.product.name', alias: 'product_name' }
  ],
  relations: ['customer', 'items.product'],
  filters: [
    { field: 'status', operator: 'eq', value: 'completed' },
    { field: 'created_at', operator: 'gte', value: '2024-01-01' },
    { field: 'total', operator: 'gte', value: 100 }
  ],
  sorts: [
    { field: 'created_at', direction: 'desc' },
    { field: 'total', direction: 'desc' },
    { field: 'customer.name', direction: 'asc' }
  ],
  limit: 50
});
```

## Conditional Aggregation

```typescript
// Conditional aggregation with case statements
async function getUserActivityStats() {
  const conditionalQuery = await client
    .from<User>('users')
    .select(`
      role,
      count(*) as total_users,
      sum(case when posts:posts(count) > 10 then 1 else 0 end) as power_users,
      sum(case when posts:posts(created_at) >= '2023-01-01' then 1 else 0 end) as recent_active_users,
      avg(posts:posts(views)) as avg_post_views
    `)
    .groupBy('role')
    .having('total_users > 0')
    .execute();

  return conditionalQuery;
}
```

## Nested Filtering

```typescript
// Nested filtering with complex conditions
async function getFilteredUserPosts() {
  const nestedFilterQuery = await client
    .from<User>('users')
    .select(`
      id, 
      name,
      posts:posts!inner(
        id, 
        title, 
        content
      )
    `)
    .eq('role', 'admin')
    .gte('posts.views', 100)
    .contains('posts.tags', ['tutorial'])
    .execute();

  return nestedFilterQuery;
}
```

## Window Functions

```typescript
// Window functions for advanced analytics
async function getRankedPosts() {
  const windowFunctionQuery = await client
    .from<Post>('posts')
    .select(`
      *,
      rank() over (partition by category order by views desc) as category_rank,
      dense_rank() over (order by views desc) as overall_rank
    `)
    .limit(50)
    .execute();

  return windowFunctionQuery;
}
```

## Time-Based Aggregation

```typescript
// Time-based aggregation and trend analysis
async function getMonthlyPostTrends() {
  const timeBasedQuery = await client
    .from<Post>('posts')
    .select(`
      date_trunc('month', created_at) as month,
      count(*) as post_count,
      sum(views) as total_views,
      avg(views) as avg_monthly_views
    `)
    .groupBy('date_trunc(month, created_at)')
    .order('month')
    .execute();

  return timeBasedQuery;
}
```

## Complex Filtering with Multiple Conditions

```typescript
// Advanced filtering with multiple complex conditions
async function getAdvancedFilteredUsers() {
  const multiConditionQuery = await client
    .from<User>('users')
    .select(`
      id, 
      name, 
      email,
      posts:posts(id, title)
    `)
    .and(
      'role.eq.admin',
      'posts.count.gte.5',
      'created_at.gte.2023-01-01'
    )
    .order('posts.count', { ascending: false })
    .limit(10)
    .execute();

  return multiConditionQuery;
}
```

## Performance Optimization

```typescript
// Query optimization techniques
async function optimizedQuery() {
  const optimizedResult = await client
    .from<Post>('posts')
    .select('id, title, summary') // Select only necessary fields
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(100)
    .cache(true) // Enable caching
    .execute();

  return optimizedResult;
}
```

## Error Handling in Complex Queries

```typescript
async function safeAdvancedQuery() {
  try {
    const result = await client
      .from<User>('users')
      .select(`
        id, 
        name, 
        posts:posts(id, title)
      `)
      .eq('role', 'admin')
      .execute();

    return result;
  } catch (error) {
    if (error.name === 'QueryBuilderError') {
      console.error('Query failed:', error.message);
      
      // Implement fallback or error recovery
      return [];
    }
    
    throw error; // Re-throw unexpected errors
  }
}
```

## Best Practices

- Use type generics for type safety
- Select only necessary columns
- Apply filters early in the query
- Use server-side aggregations
- Implement proper error handling
- Leverage caching for repeated queries
- Use window functions for advanced analytics
- Be mindful of query complexity

## Performance Considerations

- Minimize data transfer
- Use server-side filtering
- Implement appropriate indexing
- Cache frequently used queries
- Monitor query performance
- Use pagination for large datasets
- Optimize query complexity