# Caching Strategies

PGRestify provides intelligent caching mechanisms to optimize performance and reduce database load. The caching system supports memory-based caching with TTL (Time To Live), automatic garbage collection, and flexible invalidation patterns.

## Built-in Cache Configuration

### Basic Cache Setup

Configure caching when creating your client:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000',
  cache: {
    enabled: true,
    ttl: 300000,        // 5 minutes default TTL
    maxSize: 1000,      // Maximum cache entries
    gcInterval: 60000   // Garbage collection every minute
  }
});
```

### Cache Options

```typescript
interface CacheOptions {
  /** Enable/disable caching */
  enabled?: boolean;
  
  /** Default Time To Live in milliseconds */
  ttl?: number;
  
  /** Maximum number of cache entries */
  maxSize?: number;
  
  /** Garbage collection interval in milliseconds */
  gcInterval?: number;
}

// Example configurations for different scenarios
const configs = {
  // High-performance caching for read-heavy applications
  aggressive: {
    enabled: true,
    ttl: 600000,     // 10 minutes
    maxSize: 2000,   // Large cache
    gcInterval: 30000 // Frequent cleanup
  },
  
  // Conservative caching for frequently changing data
  conservative: {
    enabled: true,
    ttl: 60000,      // 1 minute
    maxSize: 500,    // Small cache
    gcInterval: 120000 // Less frequent cleanup
  },
  
  // Development - no caching for always fresh data
  development: {
    enabled: false
  }
};
```

## Cache Key Generation

### Automatic Key Generation

PGRestify automatically generates cache keys based on query parameters:

```typescript
// These queries will have different cache keys
const users1 = await client
  .from('users')
  .select('id', 'name')
  .eq('active', true)
  .execute(); // Cache key: users:select=id,name&active=eq.true

const users2 = await client
  .from('users')
  .select('id', 'name', 'email')
  .eq('active', true)
  .execute(); // Cache key: users:select=id,name,email&active=eq.true
```

### Custom Cache Keys

Override automatic key generation for specific use cases:

```typescript
// Using custom cache key
const result = await client
  .from('users')
  .select('*')
  .execute({
    cache: {
      key: 'all-users-custom', // Custom cache key
      ttl: 600000 // 10 minutes
    }
  });
```

## Per-Query Caching

### Query-Level Cache Control

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  last_login: string;
}

// Cache this query for 10 minutes
const activeUsers = await client
  .from<User>('users')
  .select('id', 'name', 'email')
  .eq('active', true)
  .execute({
    cache: {
      enabled: true,
      ttl: 600000, // 10 minutes
      key: 'active-users'
    }
  });

// Don't cache this query (always fresh)
const recentLogins = await client
  .from<User>('users')
  .select('*')
  .order('last_login', { ascending: false })
  .limit(10)
  .execute({
    cache: {
      enabled: false // Always fetch fresh data
    }
  });

// Use default cache settings
const allUsers = await client
  .from<User>('users')
  .select('*')
  .execute(); // Uses client-level cache configuration
```

## Cache Invalidation Patterns

### Pattern-Based Invalidation

```typescript
// Invalidate all user-related cache entries
client.cache.invalidate('users*');

// Invalidate specific user
client.cache.invalidate('users:*id=eq.123*');

// Invalidate by table and operation
client.cache.invalidate('posts:select*');

// Complex pattern matching
client.cache.invalidate('users:*active=eq.true*');
```

### Programmatic Cache Management

```typescript
class CacheManager {
  constructor(private client: any) {}

  // Clear all cache
  clearAll() {
    this.client.cache.clear();
  }

  // Invalidate user-specific data
  invalidateUser(userId: string) {
    this.client.cache.invalidate(`*user_id=eq.${userId}*`);
    this.client.cache.invalidate(`users:*id=eq.${userId}*`);
  }

  // Invalidate table data
  invalidateTable(tableName: string) {
    this.client.cache.invalidate(`${tableName}*`);
  }

  // Smart invalidation based on mutation
  handleMutation(table: string, operation: string, data: any) {
    switch (operation) {
      case 'INSERT':
        // Invalidate list queries for the table
        this.client.cache.invalidate(`${table}:select*`);
        break;
        
      case 'UPDATE':
        // Invalidate specific record and list queries
        if (data.id) {
          this.client.cache.invalidate(`${table}:*id=eq.${data.id}*`);
        }
        this.client.cache.invalidate(`${table}:select*`);
        break;
        
      case 'DELETE':
        // Invalidate everything related to the table
        this.client.cache.invalidate(`${table}*`);
        break;
    }
  }
}

const cacheManager = new CacheManager(client);

// Usage with mutations
const createUser = async (userData: Partial<User>) => {
  const result = await client
    .from('users')
    .insert(userData)
    .execute();
    
  // Invalidate relevant cache entries
  cacheManager.handleMutation('users', 'INSERT', userData);
  
  return result;
};
```

## Best Practices

### 1. Cache Strategy by Data Type

```typescript
// Configure different strategies for different data types
const cacheConfig = {
  // Static/Reference data - long cache
  reference: {
    ttl: 86400000, // 24 hours
    invalidateOn: ['admin-update']
  },
  
  // User-specific data - medium cache
  user: {
    ttl: 300000, // 5 minutes
    invalidateOn: ['user-update', 'user-login']
  },
  
  // Real-time data - short cache or no cache
  realtime: {
    ttl: 10000, // 10 seconds
    invalidateOn: ['any-update']
  },
  
  // Analytics/Reports - long cache with scheduled refresh
  analytics: {
    ttl: 1800000, // 30 minutes
    refreshCron: '0 */30 * * * *' // Every 30 minutes
  }
};
```

### 2. Smart Cache Keys

```typescript
// Good: Descriptive, hierarchical cache keys
const cacheKeys = {
  user: (id: string) => `users:profile:${id}`,
  userPosts: (userId: string, page: number) => `users:${userId}:posts:page:${page}`,
  searchResults: (query: string, filters: any) => 
    `search:${query}:${hashObject(filters)}`,
  analytics: (type: string, period: string) => 
    `analytics:${type}:${period}`
};

// Avoid: Generic or collision-prone keys
// Bad: 'user123', 'posts1', 'data'
```

### 3. Error Handling

```typescript
// Graceful degradation when cache fails
async function getCachedData<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  try {
    // Try cache first
    const cached = client.cache.get<T>(key);
    if (cached) return cached;
  } catch (error) {
    console.warn('Cache read failed, falling back to query:', error);
  }
  
  // Execute query
  const result = await queryFn();
  
  try {
    // Try to cache result
    client.cache.set(key, result, ttl);
  } catch (error) {
    console.warn('Cache write failed:', error);
    // Continue without caching
  }
  
  return result;
}
```

## Summary

PGRestify's caching system provides:

- **Memory-based Caching**: Fast in-memory cache with automatic garbage collection
- **Flexible TTL**: Per-query and global TTL configuration
- **Pattern-based Invalidation**: Powerful cache invalidation using patterns
- **Custom Implementations**: Support for Redis, multi-level, and custom cache backends
- **Performance Monitoring**: Built-in cache metrics and monitoring capabilities
- **Automatic Key Generation**: Smart cache key generation based on query parameters

Effective caching strategies can dramatically improve application performance by reducing database load and improving response times. Choose the appropriate caching strategy based on your data characteristics and access patterns.