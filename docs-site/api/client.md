# Client API Reference

## `createClient(options)`

Creates a new PGRestify client with specified configuration options.

### Parameters

```typescript
interface ClientOptions {
  // Required: PostgREST API URL
  url: string;

  // Optional: JWT authentication token
  token?: string;

  // Optional: Default database role
  role?: string;

  // Optional: Database schema
  schema?: string;

  // Optional: Authentication configuration
  auth?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
  };

  // Optional: Caching configuration
  cache?: {
    enabled?: boolean;
    ttl?: number;
    storage?: CacheStorage;
  };

  // Optional: Real-time configuration
  realtime?: {
    enabled?: boolean;
    url?: string;
    reconnect?: {
      enabled?: boolean;
      maxAttempts?: number;
      delay?: number;
    };
  };

  // Optional: CORS configuration
  cors?: {
    origins?: string[];
    credentials?: boolean;
    methods?: string[];
  };
}
```

### Example

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000',
  token: 'jwt-token',
  role: 'authenticated',
  schema: 'public',
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});
```

## Client Methods

### `client.from<T>(tableName)`

Creates a query builder for a specific table.

```typescript
interface User {
  id: number;
  name: string;
}

const users = await client
  .from<User>('users')
  .select('*')
  .eq('active', true);
```

### `client.getRepository<T>(tableName)`

Creates a repository for type-safe CRUD operations with ORM-style methods.

```typescript
const userRepo = client.getRepository<User>('users');

// Simple queries
const allUsers = await userRepo.find();
const activeUsers = await userRepo.findBy({ active: true });
const user = await userRepo.findOne({ id: 1 });

// Advanced query builder
const complexQuery = await userRepo
  .createQueryBuilder()
  .select(['id', 'name', 'email'])
  .where('active = :active', { active: true })
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .leftJoinAndSelect('posts', 'post')
  .orderBy('created_at', 'DESC')
  .getMany();

// CRUD operations
await userRepo.save({ name: 'John', email: 'john@example.com' });
await userRepo.update({ id: 1 }, { name: 'Updated Name' });
await userRepo.remove(user);
```

### `client.getCustomRepository<T>(repositoryClass, tableName)`

Creates a custom repository instance with your business logic.

```typescript
import { CustomRepositoryBase } from '@webcoded/pgrestify';

class UserRepository extends CustomRepositoryBase<User> {
  async findActiveUsers(): Promise<User[]> {
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .andWhere('verified = :verified', { verified: true })
      .getMany();
  }

  async findUserWithPosts(userId: number): Promise<User | null> {
    return this.createQueryBuilder()
      .leftJoinAndSelect('posts', 'post')
      .where('id = :id', { id: userId })
      .getOne();
  }
}

// Use custom repository
const userRepo = client.getCustomRepository(UserRepository, 'users');
const activeUsers = await userRepo.findActiveUsers();
```

### `client.switchRole(role, token?)`

Dynamically switch the client's role.

```typescript
await client.switchRole('admin', 'admin-jwt-token');
```

### `client.rpc<Args, Result>(functionName, args)`

Execute a PostgreSQL stored procedure.

```typescript
interface UserStatsArgs {
  user_id: number;
}

interface UserStats {
  total_posts: number;
  total_comments: number;
}

const stats = await client.rpc<UserStatsArgs, UserStats>(
  'get_user_stats', 
  { user_id: 123 }
);
```

### `client.clearCache()`

Clears all cached query results.

```typescript
client.clearCache();
```

### `client.invalidateCache(pattern)`

Invalidates cache entries matching a specific pattern.

```typescript
// Clear all user-related cache entries
client.invalidateCache('users*');

// Clear specific table cache
client.invalidateCache('table:posts*');
```

### `client.extend(config)`

Creates a new client instance with different configuration.

```typescript
const newClient = client.extend({
  schema: 'auth',
  headers: { 'X-Custom-Header': 'value' },
  timeout: 10000
});
```

### `client.raw<T>(path, options?)`

Execute a raw PostgREST query with full control over the request.

```typescript
const result = await client.raw<User[]>('users', {
  method: 'GET',
  params: { select: 'id,name', active: 'eq.true' },
  headers: { 'Accept': 'application/json' }
});

console.log(result.data); // User[]
console.log(result.count); // Total count if requested
console.log(result.status); // HTTP status
```

## Authentication Methods

### `client.auth.signIn(credentials)`

```typescript
const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});
```

### `client.auth.signUp(credentials)`

```typescript
const { user, session } = await client.auth.signUp({
  email: 'newuser@example.com',
  password: 'secure-password'
});
```

### `client.auth.signOut()`

```typescript
await client.auth.signOut();
```

## Real-time Methods

### `client.realtime.from(tableName)`

```typescript
const subscription = client.realtime
  .from('users')
  .onInsert((payload) => {
    console.log('New user:', payload.new);
  });
```

## Error Handling

```typescript
try {
  const result = await client.from('users').select('*');
} catch (error) {
  if (error.name === 'NetworkError') {
    // Handle connection issues
  }
  if (error.name === 'AuthorizationError') {
    // Handle permission errors
  }
}
```

## Performance Optimization

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    storage: customCacheStorage
  }
});
```

## Type Safety

PGRestify ensures complete type inference and safety:

```typescript
// TypeScript will provide autocomplete and type checking
const user = await client
  .from<User>('users')
  .select('id', 'name')  // Only allowed User fields
  .findOne();
```

## Advanced Configuration

```typescript
const extendedClient = client.extend({
  headers: { 'X-Custom-Header': 'value' },
  timeout: 5000
});
```