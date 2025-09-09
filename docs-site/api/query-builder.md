# Query Builder API Reference

Comprehensive API documentation for PGRestify's powerful and type-safe Query Builder.

## Basic Query Builder Interface

```typescript
interface QueryBuilder<T = Record<string, unknown>> {
  // Select specific columns
  select(...columns: (keyof T)[]): QueryBuilder<T>;
  
  // Filter methods
  eq(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  neq(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  gt(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  gte(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  lt(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  lte(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
}
```

## Instantiation

```typescript
// Basic instantiation
const query = client.from<User>('users');

// With type inference
interface User {
  id: number;
  name: string;
  email: string;
}

const userQuery = client.from<User>('users');
```

## Selection Methods

```typescript
// Select specific columns
const selectedUsers = await client
  .from<User>('users')
  .select('id', 'name', 'email')
  .execute();

// Select with aliases
const aliasedUsers = await client
  .from<User>('users')
  .select(`
    id as user_id, 
    name as full_name, 
    email as contact_email
  `)
  .execute();
```

## Filtering Methods

```typescript
// Equality filter
const activeUsers = await client
  .from<User>('users')
  .select('*')
  .eq('active', true)
  .execute();

// Multiple filters
const filteredUsers = await client
  .from<User>('users')
  .select('*')
  .eq('active', true)
  .gte('age', 18)
  .lt('age', 35)
  .execute();
```

## Logical Operators

```typescript
// AND filter
const complexFilter = await client
  .from<User>('users')
  .select('*')
  .and(
    'active.eq.true', 
    'verified.eq.true'
  )
  .execute();

// OR filter
const roleFilter = await client
  .from<User>('users')
  .select('*')
  .or(
    'role.eq.admin', 
    'role.eq.moderator'
  )
  .execute();
```

## Sorting and Ordering

```typescript
// Basic ordering
const orderedUsers = await client
  .from<User>('users')
  .select('*')
  .order('created_at', { ascending: false })
  .execute();

// Multiple column ordering
const complexOrdering = await client
  .from<User>('users')
  .select('*')
  .order('age', { ascending: false })
  .order('name', { ascending: true })
  .execute();
```

## Pagination

```typescript
// Page-based pagination
const paginatedUsers = await client
  .from<User>('users')
  .select('*')
  .paginate({ 
    page: 1, 
    pageSize: 10 
  })
  .executeWithPagination();

// Cursor-based pagination
const cursorPage = await client
  .from<User>('users')
  .select('*')
  .range(0, 9)
  .executeWithPagination();
```

## Full-Text Search

```typescript
// Basic full-text search
const searchResults = await client
  .from<Post>('posts')
  .select('*')
  .fts('content', 'typescript postgresql')
  .execute();

// Phrase search
const phraseSearch = await client
  .from<Documentation>('docs')
  .select('*')
  .phfts('text', '"type safety"')
  .execute();
```

## Aggregate Functions

```typescript
// Basic aggregates
const userStats = await client
  .from<User>('users')
  .select(`
    count(*) as total_users,
    avg(age) as average_age,
    min(created_at) as first_user_date
  `)
  .execute();

// Grouped aggregates
const roleStats = await client
  .from<User>('users')
  .select(`
    role,
    count(*) as user_count,
    avg(age) as average_age
  `)
  .groupBy('role')
  .execute();
```

## Joins and Embedded Resources

```typescript
// One-to-many join
const usersWithPosts = await client
  .from<User>('users')
  .select(`
    id, 
    name, 
    posts:posts(id, title, content)
  `)
  .execute();

// Nested joins
const complexJoin = await client
  .from<User>('users')
  .select(`
    id, 
    name,
    posts:posts(
      id, 
      title, 
      comments:comments(
        id, 
        content, 
        author:users(name)
      )
    )
  `)
  .execute();
```

## Mutation Methods

```typescript
// Insert single record
const newUser = await client
  .from<User>('users')
  .insert({ 
    name: 'John Doe', 
    email: 'john@example.com' 
  })
  .select('*')
  .single()
  .execute();

// Bulk insert
const newUsers = await client
  .from<User>('users')
  .insert([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' }
  ])
  .select('*')
  .execute();

// Update records
const updatedUsers = await client
  .from<User>('users')
  .update({ active: false })
  .eq('last_login', null)
  .select('*')
  .execute();

// Delete records
await client
  .from<User>('users')
  .delete()
  .eq('id', 123)
  .execute();
```

## Error Handling

```typescript
try {
  const users = await client
    .from<User>('users')
    .select('*')
    .execute();
} catch (error) {
  if (error.name === 'QueryBuilderError') {
    console.error('Query execution failed:', error.message);
    
    // Handle specific error types
    switch (error.code) {
      case 'INVALID_FILTER':
        // Handle invalid filter
        break;
      case 'UNAUTHORIZED':
        // Handle unauthorized access
        break;
    }
  }
}
```

## Advanced Configuration

```typescript
const query = client
  .from<User>('users')
  .select('*')
  .configure({
    // Query-specific settings
    timeout: 5000, // 5 seconds
    retryAttempts: 3,
    cacheStrategy: 'aggressive',
    
    // Performance optimization
    selectStrategy: 'minimal',
    
    // Logging
    logQuery: true
  });
```

## Type Safety and Inference

```typescript
// Strict type checking
const typeSafeQuery = client
  .from<User>('users')
  .select('id', 'name') // Only allowed User fields
  .eq('active', true);  // Type-safe value

// Prevents type errors
// This would cause a TypeScript compilation error:
// .eq('nonexistent_field', 123)
```

## Performance Considerations

- Use selective column selection
- Apply filters server-side
- Leverage indexes
- Use pagination for large datasets
- Minimize client-side data processing
- Cache query results when appropriate

## Best Practices

- Always use type generics
- Apply filters early in the query
- Select only necessary columns
- Use server-side aggregations
- Handle potential errors
- Implement proper logging
- Monitor query performance