# Table Joining

PGRestify provides powerful and intuitive table joining capabilities, leveraging PostgreSQL's embedded resources feature.

## Basic Joins

### PostgREST Native Syntax

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient('http://localhost:3000');

// One-to-Many Join
const usersWithPosts = await client
  .from('users')
  .select(`
    id, 
    name, 
    email,
    posts:posts(id, title, content)
  `)
  .find();
```

### Relations Array Syntax

For a more declarative approach, you can use the `relations` array to specify which tables to join:

```typescript
// Simple relation join
const usersWithProfile = await client
  .from('users')
  .select(['id', 'name', 'email', 'profile.bio', 'profile.avatar_url'])
  .relations(['profile'])
  .find();

// Multiple relations
const usersWithPostsAndComments = await client
  .from('users')
  .select(['id', 'name', 'posts.title', 'posts.content', 'comments.text'])
  .relations(['posts', 'comments'])
  .find();

// Nested relations
const usersWithPostComments = await client
  .from('users')
  .select(['id', 'name', 'posts.title', 'posts.comments.text'])
  .relations(['posts.comments'])
  .find();
```

### Advanced Relations Usage

```typescript
// Relations with filtering
const activeUsersWithRecentPosts = await client
  .from('users')
  .select(['id', 'name', 'posts.title', 'posts.created_at'])
  .relations(['posts'])
  .eq('active', true)
  .gte('posts.created_at', '2024-01-01')
  .find();

// Relations with custom select and ordering
const usersWithTopPosts = await client
  .from('users')
  .select(['id', 'name', 'posts.title', 'posts.upvotes'])
  .relations(['posts'])
  .order('posts.upvotes', { ascending: false })
  .limit(10)
  .find();

// Relations with aggregation
const usersWithPostCount = await client
  .from('users')
  .select(['id', 'name'])
  .relations(['posts'])
  .aggregate('posts', 'count')
  .find();
```

## Nested Joins

```typescript
// Multi-level nested joins
const complexJoin = await client
  .from('users')
  .select(`
    id, 
    name,
    profile:profiles(bio, avatar_url),
    posts:posts(
      id, 
      title, 
      comments:comments(
        id, 
        content, 
        author:users(name, email)
      )
    )
  `)
  .find();
```

## Filtering Joined Resources

```typescript
// Filter joined resources
const filteredJoin = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts!inner(
      id, 
      title, 
      content
    )
  `)
  .gte('posts.created_at', '2023-01-01')
  .find();
```

## Aggregated Joins

```typescript
// Aggregate joined resources
const userStats = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts(count),
    comments:comments(count)
  `)
  .find();
```

## Conditional Joins

```typescript
// Conditional join with filtering
const conditionalJoin = await client
  .from('orders')
  .select(`
    id,
    total,
    customer:users!inner(
      id, 
      name, 
      email
    ),
    items:order_items(
      product:products(name, price)
    )
  `)
  .eq('status', 'completed')
  .find();
```

## Type-Safe Joins

```typescript
interface User {
  id: number;
  name: string;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
}

// Type-safe join with generics
const typeSafeJoin = await client
  .from<User>('users')
  .select(`
    id, 
    name,
    posts:posts(id, title, content)
  `)
  .find();
```

## Advanced Join Techniques

### Outer Joins

```typescript
// Left outer join
const usersWithOptionalPosts = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts(id, title)!left
  `)
  .find();
```

### Computed Columns in Joins

```typescript
// Computed columns in joined resources
const joinWithComputation = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts(
      id, 
      title, 
      total_comments:comments(count)
    )
  `)
  .find();
```

## Performance Optimization

```typescript
// Optimize joins by selecting specific fields
const optimizedJoin = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts(id, title)
  `)
  .limit(100)  // Limit result set
  .find();
```

## Error Handling

```typescript
try {
  const joinedData = await client
    .from('users')
    .select(`
      id, 
      name, 
      posts:posts(id, title)
    `)
    .find();
} catch (error) {
  if (error.name === 'JoinError') {
    console.log('Join operation failed:', error.message);
  }
}
```

## Best Practices

- Use inner joins (`!inner`) for strict filtering
- Select only necessary fields to reduce payload
- Be mindful of join complexity
- Create appropriate indexes on join columns
- Use limit and pagination for large datasets

## Advanced Configuration

```typescript
const client = createClient({
  joins: {
    // Global join configuration
    maxDepth: 3,  // Maximum join nesting level
    defaultJoinType: 'left'
  }
});
```

## Performance Considerations

- Joins can be computationally expensive
- Use indexes on join columns
- Limit the depth and breadth of joins
- Consider denormalization for complex join scenarios
- Monitor query performance and execution time

## Security Implications

```typescript
// Role-based join access
const secureJoin = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts(id, title)
  `)
  .withRole('authenticated')
  .find();
```

## Combining with Other Features

```typescript
// Join with filtering, sorting, and pagination
const complexJoinQuery = await client
  .from('users')
  .select(`
    id, 
    name,
    posts:posts(id, title, content)
  `)
  .eq('active', true)
  .order('posts.created_at', { ascending: false })
  .paginate({ page: 1, pageSize: 10 })
  .executeWithPagination();
```