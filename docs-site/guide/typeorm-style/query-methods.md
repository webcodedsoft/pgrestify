# Query Methods

PGRestify's Repository pattern provides TypeORM-style query methods that make database operations intuitive and type-safe. This guide covers all the query methods available through the Repository class and QueryBuilder integration.

## Overview

Query methods in PGRestify repositories include:

- **Find Methods**: Various ways to retrieve records
- **Filtering Methods**: Advanced filtering with PostgREST operators
- **Ordering and Pagination**: Sort and paginate results
- **Counting Methods**: Get record counts and statistics
- **Existence Checks**: Verify record existence
- **Query Builder Integration**: Access to advanced query building

## Find Methods

### Basic Find Operations

```tsx
import { createClient } from 'pgrestify';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  role: 'user' | 'admin' | 'moderator';
  created_at: string;
  updated_at: string;
}

const client = createClient({ url: 'http://localhost:3000' });
const dataManager = client.dataManager;
const userRepository = dataManager.getRepository<User>('users');

async function basicFindMethods() {
  // Find all records
  const allUsers = await userRepository.find();
  console.log(`Total users: ${allUsers.length}`);
  
  // Find by conditions
  const activeUsers = await userRepository.findBy({ 
    active: true 
  });
  
  // Find by multiple conditions (AND logic)
  const adminUsers = await userRepository.findBy({ 
    active: true, 
    role: 'admin' 
  });
  
  // Find one record (returns null if not found)
  const user = await userRepository.findOne({ 
    email: 'john@example.com' 
  });
  
  if (user) {
    console.log('Found user:', user.email);
  } else {
    console.log('User not found');
  }
  
  // Find one record or throw error
  try {
    const requiredUser = await userRepository.findOneOrFail({ 
      email: 'required@example.com' 
    });
    console.log('Required user:', requiredUser.email);
  } catch (error) {
    console.error('Required user not found:', error.message);
  }
}
```

### ID-Based Operations

```tsx
async function idBasedOperations() {
  // Find by single ID
  const user = await userRepository.findById('user-123');
  
  if (user) {
    console.log('User found:', user.first_name, user.last_name);
  }
  
  // Find by multiple IDs
  const users = await userRepository.findByIds([
    'user-1', 
    'user-2', 
    'user-3'
  ]);
  
  console.log(`Found ${users.length} users by ID`);
  
  // Process each user
  users.forEach(user => {
    console.log(`User: ${user.first_name} ${user.last_name} (${user.email})`);
  });
}
```

## Advanced Query Building

### Using the Query Builder

Access the underlying QueryBuilder for complex operations:

```tsx
async function advancedQueries() {
  // Get query builder instance
  const queryBuilder = userRepository.getQueryBuilder();
  
  // Complex filtering
  const complexQuery = await queryBuilder
    .select('id, email, first_name, last_name, created_at')
    .eq('active', true)
    .in('role', ['admin', 'moderator'])
    .gte('created_at', '2024-01-01')
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  
  if (complexQuery.error) {
    throw complexQuery.error;
  }
  
  const users = complexQuery.data || [];
  console.log(`Found ${users.length} users with complex query`);
}
```

### Filter Methods

All PostgREST operators are available through the QueryBuilder:

```tsx
async function filterMethods() {
  const queryBuilder = userRepository.getQueryBuilder();
  
  // Equality operators
  const equalUsers = await queryBuilder
    .eq('role', 'admin')
    .execute();
  
  const notEqualUsers = await queryBuilder
    .neq('role', 'admin')
    .execute();
  
  // Comparison operators
  const recentUsers = await queryBuilder
    .gte('created_at', '2024-01-01')  // greater than or equal
    .lt('created_at', '2024-12-31')   // less than
    .execute();
  
  // Pattern matching
  const emailPattern = await queryBuilder
    .like('email', '%@company.com')   // SQL LIKE
    .execute();
  
  const caseInsensitive = await queryBuilder
    .ilike('first_name', 'john%')     // Case-insensitive LIKE
    .execute();
  
  // Regular expressions
  const regexMatch = await queryBuilder
    .match('email', '^[a-z]+@[a-z]+\\.[a-z]{2,}$')  // Regex match
    .execute();
  
  // Array operations
  const specificRoles = await queryBuilder
    .in('role', ['admin', 'moderator'])
    .execute();
  
  // Full-text search (if your database supports it)
  const textSearch = await queryBuilder
    .fts('bio', 'developer programmer')  // Full-text search
    .execute();
  
  console.log('Filter results:', {
    equal: equalUsers.data?.length,
    notEqual: notEqualUsers.data?.length,
    recent: recentUsers.data?.length,
    emailPattern: emailPattern.data?.length,
    caseInsensitive: caseInsensitive.data?.length,
    regex: regexMatch.data?.length,
    specificRoles: specificRoles.data?.length,
    textSearch: textSearch.data?.length
  });
}
```

### Complex Filtering with OR Logic

```tsx
async function orLogic() {
  const queryBuilder = userRepository.getQueryBuilder();
  
  // OR conditions using PostgREST syntax
  const orQuery = await queryBuilder
    .or('role.eq.admin,role.eq.moderator,active.eq.false')
    .execute();
  
  // More complex OR with AND
  const complexOr = await queryBuilder
    .eq('active', true)  // AND active = true
    .or('role.eq.admin,email.like.*@company.com')  // AND (role = admin OR email LIKE '@company.com')
    .execute();
  
  // Multiple OR conditions
  const multipleOr = await queryBuilder
    .or('first_name.ilike.john*,last_name.ilike.smith*')
    .or('created_at.gte.2024-01-01,updated_at.gte.2024-01-01')
    .execute();
  
  console.log('OR query results:', {
    basic: orQuery.data?.length,
    complex: complexOr.data?.length,
    multiple: multipleOr.data?.length
  });
}
```

## Ordering and Pagination

### Sorting Results

```tsx
async function sortingMethods() {
  const queryBuilder = userRepository.getQueryBuilder();
  
  // Single column sorting
  const sortedByDate = await queryBuilder
    .order('created_at', { ascending: false })  // Newest first
    .execute();
  
  // Multiple column sorting
  const multipleSorted = await queryBuilder
    .order('role', { ascending: true })      // Role ascending
    .order('last_name', { ascending: true }) // Then last name ascending
    .order('first_name', { ascending: true }) // Then first name ascending
    .execute();
  
  // Complex sorting with nulls handling
  const nullsHandled = await queryBuilder
    .order('updated_at', { ascending: false, nullsFirst: false })
    .execute();
  
  console.log('Sorted results:', {
    byDate: sortedByDate.data?.length,
    multiple: multipleSorted.data?.length,
    nullsHandled: nullsHandled.data?.length
  });
}
```

### Pagination

```tsx
interface PaginationOptions {
  page: number;
  pageSize: number;
}

interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

async function paginatedQuery(
  options: PaginationOptions = { page: 1, pageSize: 20 }
): Promise<PaginationResult<User>> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;
  
  // Get paginated data
  const queryBuilder = userRepository.getQueryBuilder();
  const result = await queryBuilder
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)  // PostgREST range
    .execute();
  
  if (result.error) {
    throw result.error;
  }
  
  // Get total count for pagination info
  const totalCount = await userRepository.count({ active: true });
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return {
    data: result.data || [],
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

// Usage
async function usePagination() {
  const page1 = await paginatedQuery({ page: 1, pageSize: 10 });
  console.log('Page 1:', page1.data.length, 'users');
  console.log('Pagination:', page1.pagination);
  
  if (page1.pagination.hasNextPage) {
    const page2 = await paginatedQuery({ page: 2, pageSize: 10 });
    console.log('Page 2:', page2.data.length, 'users');
  }
}
```

### Cursor-Based Pagination

```tsx
async function cursorPagination(
  lastCreatedAt?: string,
  pageSize: number = 20
): Promise<{ users: User[]; nextCursor?: string }> {
  const queryBuilder = userRepository.getQueryBuilder();
  
  let query = queryBuilder
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1); // Get one extra to check if there's a next page
  
  // Apply cursor if provided
  if (lastCreatedAt) {
    query = query.lt('created_at', lastCreatedAt);
  }
  
  const result = await query.execute();
  if (result.error) throw result.error;
  
  const users = result.data || [];
  const hasNext = users.length > pageSize;
  
  // Remove extra item if present
  if (hasNext) {
    users.pop();
  }
  
  // Get next cursor
  const nextCursor = hasNext && users.length > 0 
    ? users[users.length - 1].created_at 
    : undefined;
  
  return {
    users,
    nextCursor
  };
}

// Usage
async function useCursorPagination() {
  // First page
  const firstPage = await cursorPagination();
  console.log('First page:', firstPage.users.length, 'users');
  
  // Next page using cursor
  if (firstPage.nextCursor) {
    const secondPage = await cursorPagination(firstPage.nextCursor);
    console.log('Second page:', secondPage.users.length, 'users');
  }
}
```

## Counting and Statistics

### Count Methods

```tsx
async function countingMethods() {
  // Count all users
  const totalUsers = await userRepository.count();
  console.log('Total users:', totalUsers);
  
  // Count with conditions
  const activeUsers = await userRepository.count({ active: true });
  const adminUsers = await userRepository.count({ role: 'admin' });
  const inactiveUsers = await userRepository.count({ active: false });
  
  console.log('User statistics:', {
    total: totalUsers,
    active: activeUsers,
    admin: adminUsers,
    inactive: inactiveUsers
  });
  
  // Count with complex conditions using query builder
  const recentActiveUsers = await userRepository
    .getQueryBuilder()
    .eq('active', true)
    .gte('created_at', '2024-01-01')
    .getCount();
  
  console.log('Recent active users:', recentActiveUsers);
}
```

### Existence Checks

```tsx
async function existenceChecks() {
  // Check if user exists
  const emailExists = await userRepository.exists({ 
    email: 'check@example.com' 
  });
  
  if (emailExists) {
    console.log('Email is already taken');
  }
  
  // Check for admin users
  const hasAdmins = await userRepository.exists({ 
    role: 'admin', 
    active: true 
  });
  
  if (!hasAdmins) {
    console.log('No active admin users found');
  }
  
  // Complex existence check
  const hasRecentUsers = await userRepository
    .getQueryBuilder()
    .gte('created_at', '2024-01-01')
    .eq('active', true)
    .limit(1)
    .execute()
    .then(result => (result.data?.length || 0) > 0);
  
  console.log('Has recent users:', hasRecentUsers);
}
```

## Select Column Optimization

### Column Selection

```tsx
async function columnSelection() {
  // Select specific columns to reduce data transfer
  const minimalUsers = await userRepository
    .getQueryBuilder()
    .select('id, email, first_name, last_name')
    .eq('active', true)
    .execute();
  
  // Column aliases
  const aliasedUsers = await userRepository
    .getQueryBuilder()
    .select('id, email, first_name as firstName, last_name as lastName, created_at as createdAt')
    .limit(10)
    .execute();
  
  // Computed columns (if supported by your database)
  const computedUsers = await userRepository
    .getQueryBuilder()
    .select(`
      id, 
      email, 
      first_name, 
      last_name,
      first_name || ' ' || last_name as full_name,
      extract(year from created_at) as created_year
    `)
    .execute();
  
  console.log('Column selection results:', {
    minimal: minimalUsers.data?.length,
    aliased: aliasedUsers.data?.length,
    computed: computedUsers.data?.length
  });
}
```

## Relationship Queries

### Joining Related Data

```tsx
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
}

async function relationshipQueries() {
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Posts with author information
  const postsWithAuthors = await postRepository
    .getQueryBuilder()
    .select(`
      id,
      title,
      content,
      created_at,
      author:users!author_id(
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  
  // Users with their post counts
  const usersWithPostCounts = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      posts:posts!author_id(count)
    `)
    .eq('active', true)
    .execute();
  
  // Complex nested relationships
  const postsWithFullData = await postRepository
    .getQueryBuilder()
    .select(`
      id,
      title,
      content,
      created_at,
      author:users!author_id(
        id,
        first_name,
        last_name,
        email,
        profile:profiles!user_id(
          bio,
          avatar_url
        )
      ),
      category:categories!category_id(
        id,
        name,
        slug
      ),
      comments:comments!post_id(
        id,
        content,
        created_at,
        author:users!author_id(first_name, last_name)
      )
    `)
    .limit(5)
    .execute();
  
  console.log('Relationship query results:', {
    postsWithAuthors: postsWithAuthors.data?.length,
    usersWithCounts: usersWithPostCounts.data?.length,
    fullData: postsWithFullData.data?.length
  });
}
```

## Performance Optimization

### Query Optimization Patterns

```tsx
async function optimizedQueries() {
  // 1. Use indices effectively
  const indexedQuery = await userRepository
    .getQueryBuilder()
    .eq('email', 'specific@example.com')  // Assuming email is indexed
    .execute();
  
  // 2. Limit data transfer
  const limitedData = await userRepository
    .getQueryBuilder()
    .select('id, email, first_name, last_name')  // Only needed columns
    .eq('active', true)
    .limit(50)  // Reasonable limit
    .execute();
  
  // 3. Use appropriate operators
  const efficientFilter = await userRepository
    .getQueryBuilder()
    .gte('created_at', '2024-01-01')  // Range query on indexed date column
    .in('role', ['admin', 'moderator'])  // IN operator for multiple values
    .execute();
  
  // 4. Batch operations
  const userIds = ['id1', 'id2', 'id3', 'id4', 'id5'];
  const batchUsers = await userRepository.findByIds(userIds);  // Single query
  
  // Instead of multiple queries:
  // const users = await Promise.all(
  //   userIds.map(id => userRepository.findById(id))
  // );
  
  console.log('Optimization results:', {
    indexed: indexedQuery.data?.length,
    limited: limitedData.data?.length,
    efficient: efficientFilter.data?.length,
    batch: batchUsers.length
  });
}
```

### Caching Strategies

```tsx
async function cachingStrategies() {
  // The underlying QueryBuilder handles caching automatically
  // Multiple calls with the same parameters will use cached results
  
  const query1 = await userRepository
    .getQueryBuilder()
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  
  // This will use cached result if called within cache TTL
  const query2 = await userRepository
    .getQueryBuilder()
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  
  console.log('Cached queries return same data:', 
    JSON.stringify(query1.data) === JSON.stringify(query2.data)
  );
}
```

## Error Handling

### Query Error Patterns

```tsx
import { PostgRESTError } from 'pgrestify';

async function errorHandling() {
  try {
    // Query that might fail due to invalid column
    const result = await userRepository
      .getQueryBuilder()
      .eq('invalid_column', 'value')
      .execute();
    
    if (result.error) {
      throw result.error;
    }
    
    console.log('Query succeeded:', result.data?.length);
    
  } catch (error) {
    if (error instanceof PostgRESTError) {
      switch (error.statusCode) {
        case 400:
          console.error('Bad request - check column names and values');
          break;
        case 401:
          console.error('Unauthorized - check authentication');
          break;
        case 404:
          console.error('Table not found');
          break;
        default:
          console.error('PostgREST error:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
  
  // Safe query with validation
  const safeQuery = async (email: string) => {
    if (!email || !email.includes('@')) {
      throw new Error('Valid email required');
    }
    
    const user = await userRepository.findOne({ email });
    return user;
  };
  
  const user = await safeQuery('valid@example.com');
  console.log('Safe query result:', user?.email);
}
```

## Summary

PGRestify's query methods provide:

- **Comprehensive Find Operations**: Multiple ways to retrieve data with type safety
- **Advanced Filtering**: All PostgREST operators with intuitive method names
- **Flexible Ordering**: Single and multi-column sorting with null handling
- **Pagination Support**: Both offset-based and cursor-based pagination
- **Performance Optimization**: Column selection, batching, and caching strategies
- **Relationship Queries**: Join related data using PostgREST's powerful selection syntax
- **Error Handling**: Robust error handling with specific PostgREST error types

These methods provide a TypeORM-like experience while leveraging PostgREST's powerful querying capabilities and maintaining full type safety throughout your application.