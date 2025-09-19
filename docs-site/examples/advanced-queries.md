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

// Complex query with multiple filters and joins
async function getAdvancedUserPosts() {
  const complexQuery = await client
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