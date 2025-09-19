# Basic Usage Example

This example demonstrates the core functionality of PGRestify with a typical user management scenario.

## Setup

First, install PGRestify:

```bash
npm install @webcoded/pgrestify
```

## Define Your Types

```typescript
// Define interfaces for type safety
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  published: boolean;
}
```

## Create a Client

```typescript
import { createClient } from '@webcoded/pgrestify';

// Create a simple client
const client = createClient('http://localhost:3000');
```

## Basic CRUD Operations

### Create (Insert) Records

```typescript
// Insert a single user
const newUser = await client
  .from<User>('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    active: true
  })
  .select('*')
  .single();

// Bulk insert users
const newUsers = await client
  .from<User>('users')
  .insert([
    { name: 'Alice', email: 'alice@example.com', active: true },
    { name: 'Bob', email: 'bob@example.com', active: false }
  ])
  .select('*');
```

### Read (Select) Records

```typescript
// Find all active users
const activeUsers = await client
  .from<User>('users')
  .select('*')
  .eq('active', true);

// Find a specific user
const user = await client
  .from<User>('users')
  .select('id', 'name', 'email')
  .eq('id', 1)
  .single();

// Complex query with joins
const usersWithPosts = await client
  .from<User>('users')
  .select(`
    id, 
    name, 
    email, 
    posts:posts(id, title, content)
  `)
  .eq('active', true);
```

### Update Records

```typescript
// Update a user
const updatedUser = await client
  .from<User>('users')
  .update({ active: false })
  .eq('id', 1)
  .select('*')
  .single();

// Bulk update
await client
  .from<User>('users')
  .update({ active: false })
  .lt('created_at', '2023-01-01');
```

### Delete Records

```typescript
// Delete a specific user
await client
  .from<User>('users')
  .delete()
  .eq('id', 1);

// Bulk delete
await client
  .from<User>('users')
  .delete()
  .eq('active', false);
```

## Advanced Querying

```typescript
// Pagination
const paginatedUsers = await client
  .from<User>('users')
  .select('*')
  .order('created_at', { ascending: false })
  .range(0, 9)
  .executeWithPagination();

// Full-text search
const searchResults = await client
  .from<Post>('posts')
  .select('*')
  .fts('content', 'typescript postgresql')
  .limit(10);

// Aggregate functions
const userStats = await client
  .from<User>('users')
  .select(`
    count(*) as total_users,
    avg(id) as avg_id,
    min(created_at) as first_user_date
  `)
  .single();
```

## Error Handling

```typescript
try {
  const user = await client
    .from<User>('users')
    .select('*')
    .eq('id', 999)
    .single();
} catch (error) {
  if (error.name === 'NotFoundError') {
    console.log('User not found');
  } else {
    console.error('Unexpected error', error);
  }
}
```

## Repository Pattern

```typescript
// Get a type-safe repository
const userRepo = client.getRepository<User>('users');

// Use repository methods
const allUsers = await userRepo.find();
const activeUser = await userRepo.findOne({ active: true });

// Save (insert or update)
await userRepo.save({
  name: 'New User',
  email: 'new@example.com',
  active: true
});
```

## Best Practices

- Always use type generics for type safety
- Handle potential errors with try-catch
- Use repository pattern for complex data operations
- Leverage PGRestify's type inference
- Keep sensitive operations server-side

## Performance Tips

- Use `select()` to limit returned fields
- Utilize server-side filtering and sorting
- Implement pagination for large datasets
- Use caching for frequently accessed data