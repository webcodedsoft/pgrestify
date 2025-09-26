# Query Building

Learn how to construct powerful, type-safe queries using PGRestify's comprehensive query builder API.

## Overview

PGRestify provides a fluent, chainable query builder that maps directly to PostgREST's capabilities while maintaining full type safety. The query builder allows you to construct complex queries using method chaining, similar to popular ORMs but optimized for PostgREST's HTTP-based architecture.

## Basic Query Structure

### Simple Selection

The most basic query selects all columns from a table:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Select all columns
const users = await client
  .from('users')
  .select('*')
  .execute();

console.log(users.data); // Array of user objects
```

### Selecting Specific Columns

Control exactly which columns to return using multiple syntax options:

```typescript
// Array syntax (recommended)
const users = await client
  .from('users')
  .select(['id', 'name', 'email', 'created_at'])
  .execute();

// String syntax
const users = await client
  .from('users')
  .select('id, name, email, created_at')
  .execute();

// Dynamic column selection
const columns = ['id', 'name', 'email'];
const users = await client
  .from('users')
  .select(columns)
  .execute();
```

### Column Aliases

Create aliases for columns in your results using multiple syntax options:

```typescript
// Array syntax with AS keyword (recommended)
const users = await client
  .from('users')
  .select([
    'id',
    'name AS full_name',
    'email AS email_address', 
    'created_at AS registration_date'
  ])
  .execute();

// PostgREST colon syntax
const usersWithColon = await client
  .from('users')
  .select('id, name:full_name, email:email_address, created_at:registration_date')
  .execute();

// String syntax with AS keyword
const usersWithAS = await client
  .from('users')
  .select('id, name AS full_name, email AS email_address, created_at AS registration_date')
  .execute();

// Mixed aliases and regular columns
const mixedSelection = await client
  .from('users')
  .select([
    'id',
    'name AS full_name',
    'email',  // No alias
    'created_at AS signup_date',
    'active'  // No alias
  ])
  .execute();

// Result structure:
// { id: 1, full_name: "John Doe", email_address: "john@example.com", registration_date: "2024-01-01" }
```

### Advanced Aliasing with Relations

```typescript
// Aliases with relations using array syntax
const usersWithProfile = await client
  .from('users')
  .select([
    'id AS user_id',
    'name AS full_name',
    'profile.bio AS user_bio',
    'profile.avatar_url AS profile_image'
  ])
  .relations(['profile'])
  .execute();

// Complex field selection with aliases
const complexSelection = await client
  .from('orders')
  .select([
    'id AS order_id',
    'total AS order_total',
    'customer.name AS customer_name',
    'customer.email AS customer_email',
    'items.product.name AS product_name',
    'items.quantity AS item_quantity'
  ])
  .relations(['customer', 'items.product'])
  .execute();
```

## Query Building Methods

### from() - Table Selection

The `from()` method specifies the table to query:

```typescript
// Basic table selection
const query = client.from('users');

// With schema specification
const query = client.from('auth.users');

// Type-safe table selection with interface
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

const query = client.from<User>('users');
```

### select() - Column Selection

The `select()` method defines which columns to retrieve:

```typescript
// All columns
const query = client.from('users').select('*');

// Specific columns
const query = client.from('users').select('id, name, email');

// Complex selections with relationships
const query = client.from('posts').select(`
  id,
  title,
  content,
  created_at,
  author:users(id, name),
  category:categories(id, name)
`);

// Conditional column selection
const includeEmail = true;
const columns = ['id', 'name'];
if (includeEmail) {
  columns.push('email');
}

const query = client.from('users').select(columns.join(', '));
```

### Method Chaining

All query methods return the query builder, allowing for fluent chaining:

```typescript
const results = await client
  .from('posts')
  .select('id, title, content, created_at')
  .eq('published', true)
  .gte('created_at', '2024-01-01')
  .order('created_at', { ascending: false })
  .limit(10)
  .execute();
```

## Filtering Operations

### Equality Filters

```typescript
// Exact match
const activeUsers = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .execute();

// Multiple conditions (AND by default)
const specificUser = await client
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .eq('active', true)
  .execute();

// Not equal
const inactiveUsers = await client
  .from('users')
  .select('*')
  .neq('active', true)
  .execute();
```

### Comparison Filters

```typescript
// Greater than
const recentPosts = await client
  .from('posts')
  .select('*')
  .gt('created_at', '2024-01-01')
  .execute();

// Greater than or equal
const adultUsers = await client
  .from('users')
  .select('*')
  .gte('age', 18)
  .execute();

// Less than
const youngUsers = await client
  .from('users')
  .select('*')
  .lt('age', 30)
  .execute();

// Less than or equal
const budgetItems = await client
  .from('products')
  .select('*')
  .lte('price', 100)
  .execute();
```

### Pattern Matching

```typescript
// LIKE pattern matching (case sensitive)
const gmailUsers = await client
  .from('users')
  .select('*')
  .like('email', '%@gmail.com')
  .execute();

// ILIKE pattern matching (case insensitive)
const johnUsers = await client
  .from('users')
  .select('*')
  .ilike('name', '%john%')
  .execute();

// NOT LIKE
const nonGmailUsers = await client
  .from('users')
  .select('*')
  .not('email', 'like', '%@gmail.com')
  .execute();
```

### Range and List Filters

```typescript
// IN operator (list of values)
const specificUsers = await client
  .from('users')
  .select('*')
  .in('id', [1, 2, 3, 4, 5])
  .execute();

// Check for values in array column
const posts = await client
  .from('posts')
  .select('*')
  .contains('tags', ['javascript', 'typescript'])
  .execute();

// Range queries
const priceRange = await client
  .from('products')
  .select('*')
  .gte('price', 10)
  .lte('price', 100)
  .execute();
```

### Null Checks

```typescript
// IS NULL
const usersWithoutProfile = await client
  .from('users')
  .select('*')
  .is('profile_image', null)
  .execute();

// IS NOT NULL
const usersWithProfile = await client
  .from('users')
  .select('*')
  .not('profile_image', 'is', null)
  .execute();
```

### Advanced Filtering

```typescript
// Multiple OR conditions
const results = await client
  .from('posts')
  .select('*')
  .or('published.eq.true,draft.eq.true')
  .execute();

// Complex AND/OR combinations
const complexQuery = await client
  .from('users')
  .select('*')
  .or('age.gte.18,verified.eq.true')
  .eq('active', true)
  .execute();

// Negation with NOT
const results = await client
  .from('posts')
  .select('*')
  .not('category', 'eq', 'archived')
  .execute();
```

## Ordering and Sorting

### Basic Ordering

```typescript
// Ascending order (default)
const usersByName = await client
  .from('users')
  .select('*')
  .order('name')
  .execute();

// Descending order
const newestPosts = await client
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .execute();
```

### Multiple Sort Criteria

Chain multiple `.order()` calls to create complex sorting logic:

```typescript
// Sort by last name, then first name
const sortedUsers = await client
  .from('users')
  .select('*')
  .order('last_name')
  .order('first_name')
  .execute();

// Sort by status (active first), then by creation date (newest first), then alphabetically
const prioritizedUsers = await client
  .from('users')
  .select('*')
  .order('is_active', { ascending: false })
  .order('created_at', { ascending: false })
  .order('name')
  .execute();

// Complex product sorting: category, then featured status, then price
const organizedProducts = await client
  .from('products')
  .select('*')
  .order('category')
  .order('featured', { ascending: false })
  .order('price', { ascending: false })
  .execute();

// E-commerce order sorting: priority, then due date, then ID
const processedOrders = await client
  .from('orders')
  .select('*')
  .order('priority', { ascending: false })
  .order('due_date')
  .order('id')
  .execute();
```

### Dynamic Multiple Sorting

Build sorts dynamically based on user preferences:

```typescript
interface SortCriteria {
  column: string;
  direction: 'asc' | 'desc';
}

const buildSortedQuery = (sortCriteria: SortCriteria[]) => {
  let query = client
    .from('products')
    .select('*');

  sortCriteria.forEach(sort => {
    query = query.order(sort.column, { 
      ascending: sort.direction === 'asc' 
    });
  });

  return query;
};

// Usage
const multiSortedProducts = await buildSortedQuery([
  { column: 'category', direction: 'asc' },
  { column: 'rating', direction: 'desc' },
  { column: 'price', direction: 'asc' },
  { column: 'name', direction: 'asc' }
]).execute();
```

### Advanced Ordering

```typescript
// Null handling
const orderedPosts = await client
  .from('posts')
  .select('*')
  .order('updated_at', { 
    ascending: false, 
    nullsFirst: true 
  })
  .execute();

// Foreign table ordering
const postsWithAuthor = await client
  .from('posts')
  .select('*, author:users(name)')
  .order('users(name)')
  .execute();
```

## Pagination and Limits

### Basic Limits

```typescript
// Limit number of results
const firstTenUsers = await client
  .from('users')
  .select('*')
  .limit(10)
  .execute();

// Skip and limit (offset-based pagination)
const secondPageUsers = await client
  .from('users')
  .select('*')
  .limit(10)
  .range(10, 19)
  .execute();
```

### Range-Based Pagination

```typescript
// Range pagination (more efficient)
const page1 = await client
  .from('posts')
  .select('*')
  .range(0, 9)   // First 10 items (0-9)
  .execute();

const page2 = await client
  .from('posts')
  .select('*')
  .range(10, 19) // Next 10 items (10-19)
  .execute();

// Get total count with pagination
const paginatedResults = await client
  .from('posts')
  .select('*', { count: 'exact' })
  .range(0, 9)
  .execute();

console.log(paginatedResults.count); // Total number of posts
console.log(paginatedResults.data);  // First 10 posts
```

### Cursor-Based Pagination

```typescript
// Cursor pagination (for large datasets)
let lastId = 0;
const pageSize = 10;

const getNextPage = async (cursor: number) => {
  return await client
    .from('posts')
    .select('*')
    .gt('id', cursor)
    .order('id')
    .limit(pageSize)
    .execute();
};

// Get first page
const firstPage = await getNextPage(lastId);
lastId = firstPage.data[firstPage.data.length - 1]?.id || lastId;

// Get next page
const secondPage = await getNextPage(lastId);
```

## Relationships and Joins

### Basic Relationships

```typescript
// Select related data
const postsWithAuthors = await client
  .from('posts')
  .select(`
    id,
    title,
    content,
    author:users (
      id,
      name,
      email
    )
  `)
  .execute();
```

### Multiple Relationships

```typescript
// Multiple related tables
const postsWithRelations = await client
  .from('posts')
  .select(`
    id,
    title,
    content,
    created_at,
    author:users (
      id,
      name,
      avatar_url
    ),
    category:categories (
      id,
      name,
      slug
    ),
    tags:post_tags (
      tag:tags (
        id,
        name
      )
    )
  `)
  .execute();
```

### Nested Filtering

```typescript
// Filter on related data
const postsWithActiveAuthors = await client
  .from('posts')
  .select(`
    id,
    title,
    author:users!inner (
      id,
      name
    )
  `)
  .eq('users.active', true)
  .execute();

// Complex nested filtering
const results = await client
  .from('posts')
  .select(`
    *,
    comments:comments (
      id,
      content,
      author:users (
        name
      )
    )
  `)
  .eq('published', true)
  .eq('comments.approved', true)
  .execute();
```

### Left and Inner Joins

```typescript
// Inner join (only records with matching relations)
const postsWithAuthors = await client
  .from('posts')
  .select(`
    *,
    author:users!inner (
      name,
      email
    )
  `)
  .execute();

// Left join (all posts, with or without authors)
const allPostsWithAuthors = await client
  .from('posts')
  .select(`
    *,
    author:users (
      name,
      email
    )
  `)
  .execute();
```

## Text Search

### Full-Text Search

```typescript
// Simple text search
const searchResults = await client
  .from('posts')
  .select('*')
  .textSearch('content', 'javascript typescript')
  .execute();

// Text search with configuration
const advancedSearch = await client
  .from('posts')
  .select('*')
  .textSearch('title', 'web development', {
    type: 'websearch',
    config: 'english'
  })
  .execute();
```

### Pattern Search

```typescript
// Case-insensitive search across multiple columns
const userSearch = await client
  .from('users')
  .select('*')
  .or('name.ilike.%john%,email.ilike.%john%')
  .execute();

// Search in JSON columns
const jsonSearch = await client
  .from('products')
  .select('*')
  .like('metadata->>name', '%laptop%')
  .execute();
```

## Aggregation Functions

### Count Operations

```typescript
// Get count only
const userCount = await client
  .from('users')
  .select('*', { count: 'exact', head: true })
  .execute();

console.log(userCount.count); // Total number of users

// Count with filtering
const activeUserCount = await client
  .from('users')
  .select('*', { count: 'exact', head: true })
  .eq('active', true)
  .execute();
```

### Aggregation Queries

```typescript
// Sum, average, min, max
const stats = await client
  .from('orders')
  .select(`
    count(),
    total_amount.sum(),
    total_amount.avg(),
    total_amount.min(),
    total_amount.max()
  `)
  .execute();

// Group by aggregation
const categoryStats = await client
  .from('products')
  .select(`
    category_id,
    count(),
    price.avg()
  `)
  .execute();
```

## Conditional Queries

### Dynamic Query Building

```typescript
interface UserFilters {
  active?: boolean;
  ageMin?: number;
  ageMax?: number;
  nameSearch?: string;
  email?: string;
}

const buildUserQuery = (filters: UserFilters) => {
  let query = client
    .from('users')
    .select('id, name, email, age, active, created_at');

  // Apply filters conditionally
  if (filters.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  if (filters.ageMin !== undefined) {
    query = query.gte('age', filters.ageMin);
  }

  if (filters.ageMax !== undefined) {
    query = query.lte('age', filters.ageMax);
  }

  if (filters.nameSearch) {
    query = query.ilike('name', `%${filters.nameSearch}%`);
  }

  if (filters.email) {
    query = query.eq('email', filters.email);
  }

  return query;
};

// Usage
const filteredUsers = await buildUserQuery({
  active: true,
  ageMin: 18,
  nameSearch: 'john'
}).execute();
```

### Query Branching

```typescript
const getUsers = async (includeInactive: boolean = false) => {
  const baseQuery = client
    .from('users')
    .select('id, name, email, active');

  if (includeInactive) {
    return baseQuery.execute();
  } else {
    return baseQuery.eq('active', true).execute();
  }
};

// Get only active users
const activeUsers = await getUsers();

// Get all users
const allUsers = await getUsers(true);
```

## Query Performance Optimization

### Efficient Column Selection

```typescript
// Good: Select only needed columns
const userList = await client
  .from('users')
  .select('id, name, email')
  .execute();

// Avoid: Selecting unnecessary data
const inefficientQuery = await client
  .from('users')
  .select('*, profile_data, large_json_field')
  .execute();
```

### Index-Friendly Queries

```typescript
// Good: Use indexed columns in WHERE clauses
const userByEmail = await client
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .single()
  .execute();

// Good: Range queries on indexed date columns
const recentPosts = await client
  .from('posts')
  .select('*')
  .gte('created_at', '2024-01-01')
  .order('created_at', { ascending: false })
  .execute();
```

### Efficient Pagination

```typescript
// Good: Range-based pagination
const efficientPagination = async (page: number, pageSize: number) => {
  const start = page * pageSize;
  const end = start + pageSize - 1;
  
  return await client
    .from('posts')
    .select('*')
    .range(start, end)
    .order('created_at', { ascending: false })
    .execute();
};

// Better: Cursor-based for large datasets
const cursorPagination = async (lastCreatedAt?: string, limit = 10) => {
  let query = client
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (lastCreatedAt) {
    query = query.lt('created_at', lastCreatedAt);
  }

  return query.execute();
};
```

## Error Handling in Queries

### Basic Error Handling

```typescript
import { PGRestifyError } from '@webcoded/pgrestify';

try {
  const users = await client
    .from('users')
    .select('*')
    .eq('email', 'user@example.com')
    .execute();
    
  console.log(users.data);
} catch (error) {
  if (error instanceof PGRestifyError) {
    console.error('Database error:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Validation and Constraints

```typescript
// Handle constraint violations gracefully
const createUser = async (userData: any) => {
  try {
    const newUser = await client
      .from('users')
      .insert(userData)
      .select('*')
      .single()
      .execute();
      
    return { success: true, data: newUser.data };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      // Handle specific database constraints
      if (error.code === '23505') { // Unique violation
        return { 
          success: false, 
          error: 'Email already exists' 
        };
      }
      if (error.code === '23502') { // Not null violation
        return { 
          success: false, 
          error: 'Required field missing' 
        };
      }
    }
    throw error; // Re-throw unexpected errors
  }
};
```

## Advanced Query Patterns

### Subqueries and EXISTS

```typescript
// Users who have posted in the last 30 days
const activePosters = await client
  .from('users')
  .select(`
    id,
    name,
    email
  `)
  .in('id', 
    client
      .from('posts')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  )
  .execute();
```

### Window Functions

```typescript
// Ranking and analytical queries
const rankedPosts = await client
  .from('posts')
  .select(`
    id,
    title,
    view_count,
    row_number() OVER (ORDER BY view_count DESC) as rank
  `)
  .execute();
```

### JSON Operations

```typescript
// Query JSON columns
const productsWithFeatures = await client
  .from('products')
  .select('*')
  .contains('features', { wifi: true, bluetooth: true })
  .execute();

// Extract JSON path
const productNames = await client
  .from('products')
  .select('id, metadata->name as product_name')
  .execute();
```

## Query Builder Best Practices

### Reusable Query Fragments

```typescript
// Create reusable query builders
class UserQueryBuilder {
  private query;

  constructor(client: any) {
    this.query = client.from('users');
  }

  selectBasic() {
    this.query = this.query.select('id, name, email, created_at');
    return this;
  }

  selectDetailed() {
    this.query = this.query.select(`
      *,
      profile:user_profiles (
        avatar_url,
        bio,
        location
      )
    `);
    return this;
  }

  activeOnly() {
    this.query = this.query.eq('active', true);
    return this;
  }

  createdAfter(date: string) {
    this.query = this.query.gte('created_at', date);
    return this;
  }

  orderByNewest() {
    this.query = this.query.order('created_at', { ascending: false });
    return this;
  }

  async execute() {
    return this.query.execute();
  }
}

// Usage
const userBuilder = new UserQueryBuilder(client);

const recentActiveUsers = await userBuilder
  .selectBasic()
  .activeOnly()
  .createdAfter('2024-01-01')
  .orderByNewest()
  .execute();
```

### Type-Safe Query Building

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  user_id: number;
  published: boolean;
  created_at: string;
}

// Type-safe query construction
const getActiveUserPosts = async (userId: number): Promise<Post[]> => {
  const result = await client
    .from<Post>('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .execute();
    
  return result.data;
};
```

### Query Composition

```typescript
// Compose complex queries from simple parts
const composeUserQuery = (options: {
  includeProfile?: boolean;
  activeOnly?: boolean;
  limit?: number;
  search?: string;
}) => {
  let select = 'id, name, email, created_at';
  
  if (options.includeProfile) {
    select += ', profile:user_profiles(*)';
  }

  let query = client
    .from('users')
    .select(select);

  if (options.activeOnly) {
    query = query.eq('active', true);
  }

  if (options.search) {
    query = query.or(`name.ilike.%${options.search}%,email.ilike.%${options.search}%`);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  return query;
};

// Usage
const searchResults = await composeUserQuery({
  includeProfile: true,
  activeOnly: true,
  limit: 20,
  search: 'john'
}).execute();
```

---

## Summary

The PGRestify query builder provides a comprehensive, type-safe way to construct database queries:

- **Fluent API**: Chain methods to build complex queries
- **Type Safety**: Full TypeScript support with intelligent inference
- **PostgREST Native**: Maps directly to PostgREST's HTTP API
- **Flexible Filtering**: Support for all PostgreSQL operators and conditions
- **Relationship Handling**: Easy joins and nested data selection
- **Performance Optimized**: Efficient pagination and query patterns
- **Error Handling**: Comprehensive error types and handling strategies

The query builder strikes a balance between simplicity for basic operations and power for complex database interactions, making it suitable for both simple applications and enterprise-scale systems.