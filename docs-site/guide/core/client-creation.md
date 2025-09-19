# Client Creation

Learn how to create and configure PGRestify clients for different use cases and environments.

## Overview

PGRestify provides multiple client creation methods to fit different architectural patterns and use cases. The client is your main entry point for interacting with your PostgREST API.

## Basic Client Creation

### Simple Client

The most straightforward way to create a client:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Start using immediately
const users = await client.from('users').select('*').execute();
```

### Configured Client

Add configuration options for production use:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'https://api.yourapp.com',
  
  // Authentication
  auth: {
    autoRefresh: true,
    storage: 'localStorage', // or 'sessionStorage', 'memory'
    storageKey: 'pgrestify.session'
  },
  
  // Global settings
  transformColumns: true,
  
  // Caching
  cache: {
    ttl: 300000, // 5 minutes
    max: 100     // Maximum cached queries
  },
  
  // Request configuration
  fetch: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 10000 // 10 seconds
  }
});
```

## Client Configuration Options

### Core Configuration

```typescript
interface ClientConfig {
  // Required: PostgREST API URL
  url: string;
  
  // Optional: Custom fetch implementation
  fetch?: typeof fetch;
  
  // Optional: Global column transformation
  transformColumns?: boolean;
  
  // Optional: Default schema (default: 'public')
  schema?: string;
  
  // Optional: API key for services that require it
  apiKey?: string;
}
```

### Authentication Configuration

```typescript
interface AuthConfig {
  // Enable automatic token refresh
  autoRefresh?: boolean;
  
  // Storage mechanism for tokens
  storage?: 'localStorage' | 'sessionStorage' | 'memory' | Storage;
  
  // Custom storage key
  storageKey?: string;
  
  // JWT configuration
  jwt?: {
    // Custom JWT secret for development
    secret?: string;
    
    // Token expiration buffer (refresh before expiry)
    expirationBuffer?: number;
  };
}
```

### Caching Configuration

```typescript
interface CacheConfig {
  // Time-to-live in milliseconds
  ttl?: number;
  
  // Maximum number of cached queries
  max?: number;
  
  // Cache implementation
  implementation?: 'memory' | 'localStorage' | Cache;
  
  // Custom cache key generator
  keyGenerator?: (query: string) => string;
}
```

## Client Factory Patterns

### Environment-based Clients

Create different clients for different environments:

```typescript
// config/clients.ts
import { createClient } from '@webcoded/pgrestify';

const createEnvironmentClient = () => {
  const baseConfig = {
    transformColumns: true,
    auth: { autoRefresh: true }
  };

  switch (process.env.NODE_ENV) {
    case 'development':
      return createClient({
        ...baseConfig,
        url: 'http://localhost:3000',
        cache: { ttl: 60000 } // Short cache for development
      });
      
    case 'production':
      return createClient({
        ...baseConfig,
        url: process.env.PGRESTIFY_API_URL!,
        cache: { ttl: 300000, max: 1000 },
        fetch: {
          timeout: 30000 // Longer timeout for production
        }
      });
      
    case 'test':
      return createClient({
        ...baseConfig,
        url: 'http://localhost:3001',
        cache: { ttl: 0 } // No caching in tests
      });
      
    default:
      throw new Error(`Unknown environment: ${process.env.NODE_ENV}`);
  }
};

export const client = createEnvironmentClient();
```

### Multi-tenant Clients

Handle multiple tenants or databases:

```typescript
// services/ClientManager.ts
import { createClient, PostgRESTClient } from '@webcoded/pgrestify';

class ClientManager {
  private clients = new Map<string, PostgRESTClient>();
  
  getClient(tenantId: string): PostgRESTClient {
    if (!this.clients.has(tenantId)) {
      const client = createClient({
        url: `https://${tenantId}.api.yourapp.com`,
        transformColumns: true,
        auth: { 
          autoRefresh: true,
          storageKey: `pgrestify.session.${tenantId}`
        }
      });
      
      this.clients.set(tenantId, client);
    }
    
    return this.clients.get(tenantId)!;
  }
  
  clearClient(tenantId: string): void {
    this.clients.delete(tenantId);
  }
}

export const clientManager = new ClientManager();

// Usage
const client = clientManager.getClient('tenant-123');
```

### Singleton Pattern

Ensure single client instance across your app:

```typescript
// lib/client.ts
import { createClient, PostgRESTClient } from '@webcoded/pgrestify';

class PGRestifyClient {
  private static instance: PostgRESTClient;
  
  static getInstance(): PostgRESTClient {
    if (!PGRestifyClient.instance) {
      PGRestifyClient.instance = createClient({
        url: process.env.NEXT_PUBLIC_PGRESTIFY_URL!,
        transformColumns: true,
        auth: { autoRefresh: true },
        cache: { ttl: 300000, max: 100 }
      });
    }
    
    return PGRestifyClient.instance;
  }
  
  static resetInstance(): void {
    PGRestifyClient.instance = null as any;
  }
}

export const client = PGRestifyClient.getInstance();
```

## Framework-Specific Setup

### React Applications

Set up client with React context:

```typescript
// context/PGRestifyContext.tsx
import React, { createContext, useContext } from 'react';
import { createClient, PostgRESTClient } from '@webcoded/pgrestify';

const client = createClient({
  url: process.env.REACT_APP_PGRESTIFY_URL!,
  transformColumns: true,
  auth: { autoRefresh: true }
});

const PGRestifyContext = createContext<PostgRESTClient>(client);

export const PGRestifyProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  return (
    <PGRestifyContext.Provider value={client}>
      {children}
    </PGRestifyContext.Provider>
  );
};

export const usePGRestifyClient = () => {
  const context = useContext(PGRestifyContext);
  if (!context) {
    throw new Error('usePGRestifyClient must be used within PGRestifyProvider');
  }
  return context;
};
```

### Next.js Applications

#### App Router Setup

```typescript
// lib/pgrestify.ts
import { createClient } from '@webcoded/pgrestify';

export const client = createClient({
  url: process.env.NEXT_PUBLIC_PGRESTIFY_URL!,
  transformColumns: true,
  auth: { 
    autoRefresh: true,
    storage: typeof window !== 'undefined' ? 'localStorage' : 'memory'
  }
});

// For server-side usage
export const serverClient = createClient({
  url: process.env.PGRESTIFY_URL!, // Server-side URL (can be internal)
  transformColumns: true,
  // No auth storage on server
});
```

#### Pages Router Setup

```typescript
// lib/pgrestify.ts
import { createClient } from '@webcoded/pgrestify';

const isServer = typeof window === 'undefined';

export const client = createClient({
  url: isServer 
    ? process.env.PGRESTIFY_URL! 
    : process.env.NEXT_PUBLIC_PGRESTIFY_URL!,
  transformColumns: true,
  auth: {
    autoRefresh: !isServer,
    storage: isServer ? 'memory' : 'localStorage'
  }
});
```

### Node.js Applications

Server-side client setup:

```typescript
// lib/database.ts
import { createClient } from '@webcoded/pgrestify';

export const dbClient = createClient({
  url: process.env.PGRESTIFY_URL!,
  transformColumns: true,
  
  // Server-side specific configuration
  fetch: {
    timeout: 30000,
    headers: {
      'User-Agent': 'MyApp/1.0.0'
    }
  },
  
  // Use memory storage for server
  auth: { storage: 'memory' },
  
  // Longer cache times on server
  cache: { ttl: 600000, max: 500 }
});

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await dbClient.from('health_check').select('1').limit(1).execute();
    return true;
  } catch {
    return false;
  }
};
```

## Advanced Configuration

### Custom Fetch Implementation

Use your own fetch implementation:

```typescript
import { createClient } from '@webcoded/pgrestify';

// Custom fetch with retry logic
const fetchWithRetry = async (url: string, options: RequestInit = {}) => {
  const maxRetries = 3;
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
};

const client = createClient({
  url: 'https://api.yourapp.com',
  fetch: fetchWithRetry
});
```

### Custom Storage Implementation

Implement your own storage for tokens:

```typescript
import { createClient } from '@webcoded/pgrestify';

class CustomStorage implements Storage {
  private data = new Map<string, string>();
  
  get length(): number {
    return this.data.size;
  }
  
  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }
  
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  
  removeItem(key: string): void {
    this.data.delete(key);
  }
  
  clear(): void {
    this.data.clear();
  }
  
  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  }
}

const client = createClient({
  url: 'https://api.yourapp.com',
  auth: {
    storage: new CustomStorage()
  }
});
```

### Custom Cache Implementation

Implement your own caching strategy:

```typescript
import { createClient, QueryCache } from '@webcoded/pgrestify';

class RedisCache implements QueryCache {
  constructor(private redis: any) {} // Redis client
  
  get<T>(key: string): T | null {
    const value = this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  set<T>(key: string, value: T, ttl?: number): void {
    const serialized = JSON.stringify(value);
    if (ttl) {
      this.redis.setex(key, Math.floor(ttl / 1000), serialized);
    } else {
      this.redis.set(key, serialized);
    }
  }
  
  delete(key: string): void {
    this.redis.del(key);
  }
  
  clear(): void {
    this.redis.flushdb();
  }
  
  invalidate(pattern: string): void {
    // Implement pattern-based invalidation
    const keys = this.redis.keys(pattern);
    if (keys.length > 0) {
      this.redis.del(...keys);
    }
  }
}

const client = createClient({
  url: 'https://api.yourapp.com',
  cache: {
    implementation: new RedisCache(redisClient),
    ttl: 300000
  }
});
```

## Error Handling

### Connection Error Handling

Handle connection and configuration errors:

```typescript
import { createClient, PGRestifyError } from '@webcoded/pgrestify';

const createRobustClient = async () => {
  try {
    const client = createClient({
      url: process.env.PGRESTIFY_URL!,
      transformColumns: true
    });
    
    // Test connection
    await client.from('users').select('id').limit(1).execute();
    
    return client;
  } catch (error) {
    if (error instanceof PGRestifyError) {
      console.error('PGRestify configuration error:', error.message);
    } else {
      console.error('Connection error:', error);
    }
    
    throw error;
  }
};

// Usage with error handling
export const initializeClient = async () => {
  try {
    return await createRobustClient();
  } catch (error) {
    // Fallback or retry logic
    console.warn('Failed to create client, using fallback configuration');
    
    return createClient({
      url: 'http://localhost:3000', // Fallback URL
      transformColumns: false,
      cache: { ttl: 0 } // Disable caching on fallback
    });
  }
};
```

## Best Practices

### Configuration Management

```typescript
// config/pgrestify.ts
interface AppConfig {
  pgrestify: {
    url: string;
    transformColumns: boolean;
    auth: {
      autoRefresh: boolean;
      storageKey: string;
    };
    cache: {
      ttl: number;
      max: number;
    };
  };
}

const config: AppConfig = {
  pgrestify: {
    url: process.env.PGRESTIFY_URL || 'http://localhost:3000',
    transformColumns: true,
    auth: {
      autoRefresh: true,
      storageKey: 'myapp.session'
    },
    cache: {
      ttl: 300000, // 5 minutes
      max: 100
    }
  }
};

export const client = createClient(config.pgrestify);
```

### Environment Validation

```typescript
// lib/client.ts
import { createClient } from '@webcoded/pgrestify';

// Validate required environment variables
const requiredEnvVars = ['NEXT_PUBLIC_PGRESTIFY_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

export const client = createClient({
  url: process.env.NEXT_PUBLIC_PGRESTIFY_URL!,
  transformColumns: true,
  auth: { autoRefresh: true }
});
```

### Type Safety

```typescript
// types/database.ts
export interface Database {
  users: {
    id: number;
    email: string;
    name: string;
    created_at: string;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    user_id: number;
    published: boolean;
  };
}

// lib/typed-client.ts
import { createClient } from '@webcoded/pgrestify';
import type { Database } from '../types/database';

export const typedClient = createClient({
  url: process.env.NEXT_PUBLIC_PGRESTIFY_URL!,
  transformColumns: true
});

// Type-safe table access
export const getUsersTable = () => typedClient.from<Database['users']>('users');
export const getPostsTable = () => typedClient.from<Database['posts']>('posts');
```

## Testing Clients

### Mock Client for Tests

```typescript
// __tests__/utils/mock-client.ts
import { createClient } from '@webcoded/pgrestify';

export const createMockClient = () => {
  return createClient({
    url: 'http://localhost:3001', // Test database
    transformColumns: true,
    cache: { ttl: 0 }, // No caching in tests
    auth: { storage: 'memory' } // Use memory storage for tests
  });
};

// Usage in tests
describe('User service', () => {
  let client: PostgRESTClient;
  
  beforeEach(() => {
    client = createMockClient();
  });
  
  it('should fetch users', async () => {
    const users = await client.from('users').select('*').execute();
    expect(users.data).toBeDefined();
  });
});
```

---

## Summary

Client creation in PGRestify is flexible and powerful:

- **Simple setup** for quick prototyping
- **Rich configuration** for production use
- **Framework integrations** for popular libraries
- **Advanced patterns** for complex architectures
- **Error handling** for robust applications
- **Type safety** for better development experience

Choose the pattern that best fits your application's needs and scale from simple to complex as your requirements grow.