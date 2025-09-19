# Data Fetching

Learn how to execute queries, handle responses, and manage data retrieval patterns with PGRestify.

## Overview

Data fetching in PGRestify involves executing queries built with the query builder and handling the responses. The library provides multiple execution methods, response handling patterns, and strategies for different data access scenarios.

## Basic Query Execution

### The execute() Method

The `execute()` method is the primary way to run queries and retrieve data:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Basic execution
const result = await client
  .from('users')
  .select('*')
  .execute();

console.log(result.data);    // Array of user objects
console.log(result.count);   // Total count (if requested)
console.log(result.status);  // HTTP status code
console.log(result.error);   // Error object (if any)
```

### Response Structure

All query executions return a standardized response object:

```typescript
interface QueryResponse<T> {
  data: T[];           // The actual data returned
  count?: number;      // Total count (when count option is used)
  status: number;      // HTTP status code
  statusText: string;  // HTTP status message
  error?: any;         // Error object if something went wrong
}

// Example usage
const response = await client
  .from('posts')
  .select('*')
  .execute();

if (response.error) {
  console.error('Query failed:', response.error);
} else {
  console.log(`Retrieved ${response.data.length} posts`);
  response.data.forEach(post => {
    console.log(`- ${post.title}`);
  });
}
```

## Single Record Fetching

### single() Method

When you expect exactly one record, use the `single()` method:

```typescript
// Get a specific user by ID
const userResponse = await client
  .from('users')
  .select('*')
  .eq('id', 123)
  .single()
  .execute();

if (userResponse.data) {
  console.log('User found:', userResponse.data.name);
} else {
  console.log('User not found');
}
```

### maybeSingle() Method

When you expect zero or one record:

```typescript
// Find user by email (might not exist)
const userResponse = await client
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .maybeSingle()
  .execute();

if (userResponse.data) {
  console.log('User exists:', userResponse.data.name);
} else {
  console.log('No user with that email');
}
```

### Error Handling for Single Records

```typescript
import { PGRestifyError } from '@webcoded/pgrestify';

try {
  const user = await client
    .from('users')
    .select('*')
    .eq('id', 123)
    .single()
    .execute();
    
  console.log('User:', user.data);
} catch (error) {
  if (error instanceof PGRestifyError) {
    if (error.code === 'PGRST116') {
      console.log('No user found with that ID');
    } else if (error.code === 'PGRST117') {
      console.log('Multiple users found (expected one)');
    } else {
      console.error('Database error:', error.message);
    }
  }
}
```

## Counting Records

### Getting Counts with Data

```typescript
// Get data and exact count
const response = await client
  .from('posts')
  .select('*', { count: 'exact' })
  .eq('published', true)
  .execute();

console.log(`Showing ${response.data.length} of ${response.count} published posts`);
```

### Count-Only Queries

```typescript
// Get only the count (no data)
const countResponse = await client
  .from('users')
  .select('*', { count: 'exact', head: true })
  .eq('active', true)
  .execute();

console.log(`Active users: ${countResponse.count}`);
```

### Estimated Counts

For better performance on large tables, use estimated counts:

```typescript
// Fast estimated count
const estimatedCount = await client
  .from('large_table')
  .select('*', { count: 'estimated', head: true })
  .execute();

console.log(`Approximately ${estimatedCount.count} records`);
```

## Async/Await Patterns

### Sequential Fetching

```typescript
const fetchUserData = async (userId: number) => {
  // Fetch user
  const user = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
    .execute();

  // Fetch user's posts
  const posts = await client
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .execute();

  // Fetch user's profile
  const profile = await client
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
    .execute();

  return {
    user: user.data,
    posts: posts.data,
    profile: profile.data
  };
};
```

### Parallel Fetching

```typescript
const fetchDashboardData = async (userId: number) => {
  // Execute multiple queries in parallel
  const [userResponse, postsResponse, profileResponse] = await Promise.all([
    client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
      .execute(),

    client
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
      .execute(),

    client
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .execute()
  ]);

  return {
    user: userResponse.data,
    posts: postsResponse.data,
    profile: profileResponse.data
  };
};
```

## Error Handling Strategies

### Comprehensive Error Handling

```typescript
import { PGRestifyError } from '@webcoded/pgrestify';

const fetchWithErrorHandling = async (table: string, filters: any) => {
  try {
    const response = await client
      .from(table)
      .select('*')
      .match(filters)
      .execute();

    return {
      success: true,
      data: response.data,
      count: response.count
    };

  } catch (error) {
    if (error instanceof PGRestifyError) {
      // Handle PostgREST-specific errors
      return {
        success: false,
        error: {
          type: 'database',
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    } else {
      // Handle network or other errors
      return {
        success: false,
        error: {
          type: 'network',
          message: error.message
        }
      };
    }
  }
};

// Usage
const result = await fetchWithErrorHandling('users', { active: true });
if (result.success) {
  console.log('Users:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Retry Logic

```typescript
const fetchWithRetry = async (
  queryFn: () => Promise<any>,
  maxRetries = 3,
  delay = 1000
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
      console.log(`Retry attempt ${attempt} failed, trying again...`);
    }
  }
};

// Usage
const fetchUsersWithRetry = () => fetchWithRetry(
  () => client.from('users').select('*').execute(),
  3,
  1000
);
```

## Data Transformation

### Column Transformation

PGRestify can automatically transform column names between snake_case and camelCase:

```typescript
// Enable column transformation
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true
});

// Database has: user_id, first_name, last_name, created_at
const users = await client
  .from('users')
  .select('*')
  .execute();

// Result has: userId, firstName, lastName, createdAt
console.log(users.data[0].firstName); // Instead of first_name
```

### Custom Data Processing

```typescript
const fetchAndProcessUsers = async () => {
  const response = await client
    .from('users')
    .select('id, name, email, created_at, active')
    .execute();

  // Process the raw data
  const processedUsers = response.data.map(user => ({
    ...user,
    displayName: user.name || 'Anonymous',
    accountAge: calculateAge(user.created_at),
    status: user.active ? 'Active' : 'Inactive'
  }));

  return {
    users: processedUsers,
    totalCount: response.count,
    activeCount: processedUsers.filter(u => u.active).length
  };
};

const calculateAge = (createdAt: string): number => {
  const now = new Date();
  const created = new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};
```

## Streaming and Large Datasets

### Chunked Processing

```typescript
const processLargeDataset = async (chunkSize = 1000) => {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const chunk = await client
      .from('large_table')
      .select('*')
      .range(offset, offset + chunkSize - 1)
      .execute();

    // Process chunk
    await processChunk(chunk.data);

    // Check if there are more records
    hasMore = chunk.data.length === chunkSize;
    offset += chunkSize;

    console.log(`Processed ${Math.min(offset, offset - chunkSize + chunk.data.length)} records`);
  }
};

const processChunk = async (data: any[]) => {
  // Process each chunk of data
  for (const record of data) {
    // Perform processing logic
    await processRecord(record);
  }
};
```

### Cursor-Based Streaming

```typescript
const streamData = async (
  processor: (record: any) => Promise<void>,
  batchSize = 100
) => {
  let lastId = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await client
      .from('events')
      .select('*')
      .gt('id', lastId)
      .order('id')
      .limit(batchSize)
      .execute();

    // Process each record in the batch
    for (const record of batch.data) {
      await processor(record);
      lastId = record.id;
    }

    hasMore = batch.data.length === batchSize;
  }
};

// Usage
await streamData(async (event) => {
  console.log('Processing event:', event.id);
  // Perform processing logic
});
```

## Caching Strategies

### Built-in Query Caching

```typescript
// Enable client-side caching
const client = createClient({
  url: 'http://localhost:3000',
  cache: {
    ttl: 300000, // 5 minutes
    max: 100     // Maximum 100 cached queries
  }
});

// Cached queries (automatically cached for 5 minutes)
const users = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .execute(); // First call - hits database

const usersAgain = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .execute(); // Second call - returns cached result
```

### Manual Cache Control

```typescript
// Clear specific cache entries
client.cache.invalidate('users', { active: true });

// Clear all cache
client.cache.clear();

// Check if query is cached
const isCached = client.cache.has('users', { active: true });

// Get cached value without executing query
const cachedResult = client.cache.get('users', { active: true });
```

### Cache-First Pattern

```typescript
const fetchWithCacheFirst = async (key: string, queryFn: () => Promise<any>) => {
  // Try cache first
  const cached = client.cache.get(key);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  // Execute query and cache result
  const result = await queryFn();
  client.cache.set(key, result.data, 300000); // Cache for 5 minutes
  
  return { data: result.data, fromCache: false };
};
```

## Response Handling Patterns

### Generic Response Handler

```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  loading?: boolean;
}

const handleApiResponse = async <T>(
  queryPromise: Promise<any>
): Promise<ApiResponse<T>> => {
  try {
    const response = await queryPromise;
    
    if (response.error) {
      return { error: response.error.message };
    }
    
    return { data: response.data };
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Usage
const userResponse = await handleApiResponse(
  client
    .from('users')
    .select('*')
    .eq('id', 123)
    .single()
    .execute()
);

if (userResponse.error) {
  console.error('Error:', userResponse.error);
} else if (userResponse.data) {
  console.log('User:', userResponse.data);
}
```

### Typed Response Handlers

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

const fetchTypedUser = async (id: number): Promise<User | null> => {
  try {
    const response = await client
      .from<User>('users')
      .select('*')
      .eq('id', id)
      .single()
      .execute();
      
    return response.data;
  } catch (error) {
    if (error instanceof PGRestifyError && error.code === 'PGRST116') {
      return null; // User not found
    }
    throw error; // Re-throw other errors
  }
};
```

## Data Fetching Best Practices

### Selective Field Loading

```typescript
// Good: Load only needed fields
const loadUserSummary = async () => {
  return client
    .from('users')
    .select('id, name, email, last_login')
    .eq('active', true)
    .execute();
};

// Avoid: Loading unnecessary data
const inefficientLoad = async () => {
  return client
    .from('users')
    .select('*') // Loads all columns including large text fields
    .eq('active', true)
    .execute();
};
```

### Efficient Relationship Loading

```typescript
// Good: Load related data in single query
const loadPostsWithAuthor = async () => {
  return client
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
      )
    `)
    .eq('published', true)
    .execute();
};

// Avoid: N+1 queries
const inefficientLoad = async () => {
  const posts = await client
    .from('posts')
    .select('*')
    .eq('published', true)
    .execute();

  // This creates N additional queries!
  for (const post of posts.data) {
    const author = await client
      .from('users')
      .select('*')
      .eq('id', post.user_id)
      .single()
      .execute();
      
    post.author = author.data;
  }
  
  return posts.data;
};
```

### Pagination Strategies

```typescript
// Efficient pagination for UI
const paginateResults = async (page: number, pageSize: number) => {
  const start = page * pageSize;
  const end = start + pageSize - 1;

  return client
    .from('posts')
    .select('*', { count: 'exact' })
    .range(start, end)
    .order('created_at', { ascending: false })
    .execute();
};

// Cursor-based pagination for performance
const cursorPaginate = async (cursor?: string, limit = 20) => {
  let query = client
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  return query.execute();
};
```

### Conditional Fetching

```typescript
const fetchUserData = async (userId: number, includeProfile = false) => {
  let select = 'id, name, email, created_at';
  
  if (includeProfile) {
    select += ', profile:user_profiles(*)';
  }

  return client
    .from('users')
    .select(select)
    .eq('id', userId)
    .single()
    .execute();
};
```

## Performance Monitoring

### Query Performance Tracking

```typescript
const performanceWrapper = async <T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await queryFn();
    const endTime = performance.now();
    
    console.log(`Query "${queryName}" took ${endTime - startTime}ms`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(`Query "${queryName}" failed after ${endTime - startTime}ms:`, error);
    throw error;
  }
};

// Usage
const users = await performanceWrapper(
  'load-active-users',
  () => client
    .from('users')
    .select('*')
    .eq('active', true)
    .execute()
);
```

### Memory Management

```typescript
// Process large datasets without loading everything into memory
const processLargeTable = async () => {
  const batchSize = 1000;
  let offset = 0;
  let processedCount = 0;

  while (true) {
    const batch = await client
      .from('large_table')
      .select('*')
      .range(offset, offset + batchSize - 1)
      .execute();

    if (batch.data.length === 0) break;

    // Process batch and immediately release memory
    await processBatch(batch.data);
    processedCount += batch.data.length;
    
    // Clear processed data from memory
    batch.data.length = 0;
    
    offset += batchSize;
    
    console.log(`Processed ${processedCount} records`);
  }
};
```

---

## Summary

Effective data fetching with PGRestify involves:

- **Query Execution**: Using `execute()`, `single()`, and `maybeSingle()` appropriately
- **Response Handling**: Understanding the response structure and error patterns
- **Performance**: Optimizing queries, using efficient pagination, and avoiding N+1 problems
- **Error Management**: Implementing comprehensive error handling and retry logic
- **Caching**: Leveraging built-in caching for better performance
- **Type Safety**: Using TypeScript interfaces for better development experience
- **Memory Management**: Processing large datasets efficiently

The key is to match your data fetching strategy to your application's specific needs while maintaining good performance and user experience.