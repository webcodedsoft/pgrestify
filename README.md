# PGRestify

[![npm version](https://badge.fury.io/js/pgrestify.svg)](https://badge.fury.io/js/pgrestify)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/pgrestify)](https://bundlephobia.com/package/pgrestify)

The **definitive TypeScript client library** for PostgREST APIs. No API keys required, TypeORM-inspired queries, PostgreSQL role-based security, and enterprise-grade features with zero-config setup.

## ✨ Key Features

- 🎯 **Zero Config** - No API keys required! Just provide your PostgREST URL
- 🏗️ **TypeORM-Style API** - Familiar `find()`, `findBy()`, `save()` methods
- 🔐 **PostgreSQL Roles** - Built-in `anonymous`, `authenticated`, `admin` role switching
- 🎭 **Per-Query Roles** - Override default role for individual queries
- 🔗 **Table Joining** - Full embedded resources support with nested relationships
- 📄 **Advanced Pagination** - Page-based, cursor-based, and infinite scroll patterns
- 🔍 **Full-Text Search** - Complete PostgreSQL FTS with ranking and phrase search
- 📊 **Aggregate Functions** - Sum, count, avg, min, max, group by, having clauses
- 🌐 **CORS Support** - Production-ready cross-origin request handling
- ⚡ **Real-time Subscriptions** - Live data updates via WebSockets
- 💾 **Smart Caching** - Intelligent query caching with TTL and invalidation
- 🛡️ **JWT Authentication** - Automatic token refresh and session management
- 🌐 **SSR Ready** - Server-side rendering with data hydration
- 🔗 **Framework Integrations** - React hooks, Next.js adapter, TanStack Query
- 🔒 **Full Type Safety** - Complete TypeScript support with schema inference
- 📦 **Lightweight** - Core library < 15KB gzipped
- 🐳 **Docker Ready** - Full support for containerized applications

## 📦 Installation

```bash
# npm
npm install pgrestify

# yarn
yarn add pgrestify

# pnpm
pnpm add pgrestify
```

### 🚀 Quick Setup with CLI

```bash
# Install CLI globally
npm install -g pgrestify

# Create a new project
pgrestify init my-app

# Or set up in existing project with interactive credential configuration
pgrestify setup database
```

### Development Setup

For local development and testing:

```bash
# Clone the repository
git clone https://github.com/pgrestify/pgrestify.git
cd pgrestify

# Install dependencies
pnpm install

# Run development setup
./scripts/dev-setup.sh

# Start development mode
pnpm dev:full
```

**For testing in other projects:**
```json
{
  "dependencies": {
    "pgrestify": "file:../path/to/pgrestify"
  }
}
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development guide.

## 🚀 Super Simple Quick Start

### 1. Zero-Config Setup (No API Keys!)

```typescript
import { createSimpleClient } from 'pgrestify';

// That's it! No API keys needed
const client = createSimpleClient('http://localhost:3000');

// Define your schema
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}
```

### 2. TypeORM-Style Queries

```typescript
// Simple TypeORM-like methods
const users = await client.from('users').find();
const activeUsers = await client.from('users').findBy({ active: true });
const user = await client.from('users').findOne({ id: 1 });

// Repository pattern
const userRepo = client.getRepository<User>('users');
const userData = await userRepo.find();
const specificUser = await userRepo.findById(1);

// Save data (upsert)
await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true,
});
```

### 3. PostgreSQL Role-Based Access

```typescript
import { createClientWithRole, PostgrestRole } from 'pgrestify';

// Anonymous access (default)
const anonymousClient = createClientWithRole(
  'http://localhost:3000', 
  PostgrestRole.ANONYMOUS
);

// Authenticated user
const authClient = createClientWithRole(
  'http://localhost:3000',
  PostgrestRole.AUTHENTICATED,
  'jwt-token-here'
);

// Admin access
const adminClient = createClientWithRole(
  'http://localhost:3000',
  PostgrestRole.ADMIN,
  'admin-jwt-token'
);

// Switch roles dynamically
await authClient.switchRole(PostgrestRole.ADMIN);
```

### 4. Advanced Query Builder with All PostgREST Features

```typescript
// Complex query with joins, filtering, and pagination
const posts = await client
  .from('posts')
  .select(`
    id, title, content, tags, created_at,
    author:users(id, name, profile:profiles(avatar_url)),
    comments:comments(id, content, user:users(name))
  `)
  .withRole(PostgrestRole.AUTHENTICATED)  // Per-query role
  .fts('content', 'javascript react')     // Full-text search
  .contains('tags', ['tutorial'])         // Array operations
  .gte('created_at', '2023-01-01')       // Date filtering
  .eq('published', true)                 // Boolean filtering
  .order('created_at', { ascending: false })
  .paginate({ page: 1, pageSize: 10 })   // Pagination
  .executeWithPagination();              // Execute with metadata

console.log('Posts:', posts.data);
console.log('Pagination:', posts.pagination);
```

### 5. Aggregate Functions & Analytics

```typescript
// Basic aggregates
const stats = await client
  .from('posts')
  .select(`
    count(*) as total_posts,
    sum(views) as total_views,
    avg(views) as avg_views,
    min(created_at) as first_post,
    max(created_at) as latest_post
  `)
  .eq('published', true)
  .execute();

// Group by with aggregates
const authorStats = await client
  .from('posts')
  .select(`
    author_id,
    count(*) as post_count,
    sum(views) as total_views,
    avg(likes) as avg_likes
  `)
  .groupBy('author_id')
  .having('count(*) >= 5')
  .order('total_views', { ascending: false })
  .execute();
```

## 🎯 Framework Integrations

> **📝 Note**: Vue and Angular adapters are currently in development and temporarily disabled in this release to ensure the best possible experience with React, Next.js, and TanStack Query integrations. The implementation files remain in the codebase and will be re-enabled in a future release.

### React

```bash
npm install pgrestify
```

```typescript
import { useQuery, useMutation } from 'pgrestify/react';

function UserList() {
  const { data: users, loading, error } = useQuery('users', query => 
    query.select('*').eq('active', true)
  );

  const createUser = useMutation<User>();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

### Next.js

```bash
npm install pgrestify
```

```typescript
// lib/client.ts
import { createNextJSClient } from 'pgrestify/nextjs';

export const client = createNextJSClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Pages Router - pages/users.tsx
import { createGetServerSideProps } from 'pgrestify/nextjs';

export default function UsersPage({ users }) {
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}

export const getServerSideProps = createGetServerSideProps(async ({ client }) => {
  const users = await client.from('users').select('*').execute();
  return { props: { users: users.data } };
});

// App Router - app/users/page.tsx
import { createServerClient } from 'pgrestify/nextjs';

export default async function UsersPage() {
  const client = createServerClient();
  const users = await client.from('users').select('*').execute();
  
  return (
    <div>
      {users.data?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

### Vue 3

```typescript
import { useQuery } from 'pgrestify/vue';

export default {
  setup() {
    const { data: users, loading, error } = useQuery('users', query => 
      query.select('*').eq('active', true)
    );

    return { users, loading, error };
  }
}
```

### TanStack Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { createPostgRESTQuery } from 'pgrestify/tanstack-query';

const postgrestQuery = createPostgRESTQuery();

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => client.from('users').select('*').execute()
  });
}
```

## 🔥 Real-time Subscriptions

Live data updates with WebSocket support:

```typescript
// Enable real-time
const client = createClient({
  url: 'http://localhost:3000',
  realtime: {
    enabled: true,
    url: 'ws://localhost:3000/realtime',
  },
});

await client.realtime.connect();

// Subscribe to table changes
const subscription = client.realtime
  .from('users')
  .onInsert((payload) => {
    console.log('New user created:', payload.new);
  })
  .onUpdate((payload) => {
    console.log('User updated:', payload.new);
  });

// Subscribe to all changes
client.realtime
  .from('posts')
  .onAll((payload) => {
    console.log('Post changed:', payload);
  });
```

## 🔐 Authentication & Authorization

JWT authentication with automatic refresh:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

// Sign in
const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password123',
});

if (data.user) {
  console.log('Signed in:', data.user);
  
  // Now all queries use authenticated user
  const userPosts = await client.from('posts').eq('user_id', data.user.id).find();
}

// Listen to auth changes
client.auth.onAuthStateChange((session) => {
  if (session) {
    console.log('User signed in:', session.user);
  } else {
    console.log('User signed out');
  }
});
```

## 💾 Smart Caching

Intelligent caching with TTL and invalidation:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
  },
});

// First call - hits database
const users1 = await client.from('users').find();

// Second call - uses cache
const users2 = await client.from('users').find();

// Manual cache management
client.invalidateCache('table:users*'); // Clear specific table
client.clearCache(); // Clear all cache
```

## 🌐 Server-Side Rendering (SSR)

Full SSR support with data hydration:

```typescript
// Server-side
if (typeof window === 'undefined') {
  const client = createClient({
    url: 'http://localhost:3000',
    ssr: { enabled: true },
  });

  // Pre-fetch data on server
  const users = await client.ssr.executeQuery(
    client.from('users').select('*'),
    'users-list'
  );

  const ssrData = client.ssr.serializeSSRData();
  // Send to client...
}

// Client-side hydration
if (typeof window !== 'undefined') {
  const client = createClient({
    url: 'http://localhost:3000',
    ssr: { enabled: true },
  });

  // Hydrate with server data
  const ssrData = window.__INITIAL_DATA__ || '{}';
  client.ssr.hydrateFromSSRData(ssrData);
}
```

## 📚 Core Concepts

### TypeORM-Style Repository Pattern

```typescript
// Get repository
const userRepo = client.getRepository<User>('users');

// Basic queries
const allUsers = await userRepo.find();
const activeUsers = await userRepo.findBy({ active: true });
const user = await userRepo.findById(1);
const user2 = await userRepo.findOne({ email: 'john@example.com' });

// Create/update
const newUser = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true,
});

// Delete
await userRepo.remove(user);
```

### Advanced Query Builder

Build complex queries with full type safety:

```typescript
const query = client
  .from<Post>('posts')
  .select(`
    id,
    title,
    content,
    author:users(id, name),
    comments(id, content, user:users(name))
  `)
  .eq('published', true)
  .gte('created_at', '2023-01-01')
  .order('created_at', { ascending: false })
  .limit(20);

const { data, error } = await query.execute();
```

### Filters & Operators

Support for all PostgREST operators:

```typescript
// Comparison
.eq('status', 'active')        // equals
.neq('status', 'inactive')     // not equals  
.gt('age', 18)                 // greater than
.gte('score', 90)              // greater than or equal
.lt('price', 100)              // less than
.lte('discount', 50)           // less than or equal

// Pattern matching
.like('name', 'John%')         // case-sensitive pattern
.ilike('email', '%@gmail.com') // case-insensitive pattern

// Array operations
.in('category', ['tech', 'science'])
.contains('tags', ['javascript'])
.containedBy('skills', ['js', 'ts', 'react'])

// Logical operations
.and('active.eq.true', 'verified.eq.true')
.or('role.eq.admin', 'role.eq.moderator')
.not('banned.eq.true')
```

### Mutations

Perform create, update, and delete operations:

```typescript
// Create
const newUser = await client
  .from<User>('users')
  .insert({ name: 'John Doe', email: 'john@example.com' })
  .select('*')
  .single()
  .execute();

// Update
const updatedUser = await client
  .from<User>('users')  
  .update({ name: 'Jane Doe' })
  .eq('id', 123)
  .select('*')
  .single()
  .execute();

// Delete
await client
  .from('users')
  .delete()
  .eq('id', 123)
  .execute();

// Upsert
const user = await client
  .from<User>('users')
  .upsert({ id: 123, name: 'John Doe', email: 'john@example.com' })
  .select('*')
  .single()
  .execute();
```

### RPC (Remote Procedure Calls)

Call PostgreSQL functions:

```typescript
interface GetUserStatsArgs {
  user_id: number;
  start_date: string;
  end_date: string;
}

interface UserStats {
  total_posts: number;
  total_comments: number;
  reputation: number;
}

const stats = await client
  .rpc<GetUserStatsArgs, UserStats>('get_user_stats', {
    user_id: 123,
    start_date: '2023-01-01',
    end_date: '2023-12-31'
  })
  .execute();
```

## 🛠️ Error Handling

Comprehensive error types for better debugging:

```typescript
try {
  const user = await client
    .from('users')
    .findOneOrFail({ id: 999 });
    
  console.log(user);
} catch (error) {
  if (error.name === 'NotFoundError') {
    console.log('User not found');
  } else if (error.name === 'ValidationError') {
    console.log('Validation failed:', error.field, error.value);
  } else if (error.name === 'AuthError') {
    console.log('Authentication required');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## 📊 Advanced Features

### Per-Query Role Specification

Override client's default role for individual queries:

```typescript
// Different roles in the same client
const [publicData, adminData] = await Promise.all([
  client.from('posts').withRole(PostgrestRole.ANONYMOUS).find(),
  client.from('users').withRole(PostgrestRole.ADMIN).find()
]);

// Elevated permissions for specific operations
const sensitiveData = await client
  .from('audit_logs')
  .withRole(PostgrestRole.ADMIN)
  .select('*')
  .gte('created_at', '2024-01-01')
  .find();
```

### Table Joining (Embedded Resources)

PostgREST's embedded resources work like SQL JOINs but return nested JSON:

```typescript
// One-to-many with nested relationships
const usersWithPosts = await client
  .from('users')
  .select(`
    id, name, email,
    profile:profiles(bio, avatar_url),
    posts:posts(
      id, title, content,
      comments:comments(id, content, user:users(name))
    )
  `)
  .find();

// Filtered embedded resources
const postsWithRecentComments = await client
  .from('posts')
  .select('id, title, comments:comments!inner(*)')
  .gte('comments.created_at', '2024-01-01')
  .find();

// Aggregated embedded data
const userStats = await client
  .from('users')
  .select(`
    id, name,
    posts:posts(count),
    comments:comments(count)
  `)
  .find();
```

### Comprehensive Pagination

Multiple pagination strategies with full metadata:

```typescript
// Page-based pagination
const page1 = await client
  .from('posts')
  .select('*')
  .eq('published', true)
  .paginate({ page: 1, pageSize: 10 })
  .executeWithPagination();

console.log(page1.pagination); 
// {
//   page: 1,
//   pageSize: 10,
//   totalItems: 150,
//   totalPages: 15,
//   hasNextPage: true,
//   hasPreviousPage: false,
//   offset: 0
// }

// Cursor-based pagination for large datasets
const cursorPage = await client
  .from('posts')
  .select('*')
  .range(0, 9)
  .executeWithPagination();

// Infinite scroll helper
class InfiniteScroll<T> {
  async loadNextPage(): Promise<{ data: T[]; hasMore: boolean }> {
    const result = await this.client
      .from(this.table)
      .offset(this.offset)
      .limit(this.pageSize)
      .executeWithPagination();
    
    this.offset += result.data.length;
    return { data: result.data, hasMore: result.pagination.hasNextPage };
  }
}
```

### Full-Text Search

All PostgREST full-text search operators:

```typescript
// Basic full-text search
const posts = await client
  .from('posts')
  .fts('content', 'javascript typescript')
  .find();

// Phrase search
const exactPhrases = await client
  .from('posts')
  .phfts('content', '"machine learning"')
  .find();

// Web-style search with operators
const webSearch = await client
  .from('posts')
  .wfts('content', 'javascript OR typescript NOT python')
  .find();

// Search with ranking
const rankedResults = await client
  .from('posts')
  .select('*, ts_rank(to_tsvector(content), plainto_tsquery($1)) as rank')
  .fts('content', 'react hooks')
  .order('rank', { ascending: false })
  .find();
```

### Full PostgREST Operator Support

```typescript
// Comparison operators
.eq('status', 'active')        // equals
.neq('status', 'inactive')     // not equals  
.gt('age', 18)                 // greater than
.gte('score', 90)              // greater than or equal
.lt('price', 100)              // less than
.lte('discount', 50)           // less than or equal

// Pattern matching
.like('name', 'John%')         // case-sensitive pattern
.ilike('email', '%@gmail.com') // case-insensitive pattern
.match('content', 'postgres.*') // regex match
.imatch('title', 'CASE.*INSENSITIVE') // case-insensitive regex

// Array operations
.in('category', ['tech', 'science'])
.contains('tags', ['javascript'])
.containedBy('skills', ['js', 'ts', 'react'])

// Range operations
.overlaps('daterange', '[2023-01-01,2023-12-31)')
.strictlyLeft('range1', 'range2')
.strictlyRight('range1', 'range2')
.adjacent('date_range', '[2024-01-01,2024-01-31)')

// Logical operations
.and('active.eq.true,verified.eq.true')
.or('role.eq.admin,role.eq.moderator')
.not('banned.eq.true')

// Null operations
.is('deleted_at', null)
.is('published', true)
```

### Aggregate Functions & Analytics

Complete support for PostgreSQL aggregates:

```typescript
// Basic aggregates
const stats = await client
  .from('posts')
  .select(`
    count(*) as total_posts,
    sum(views) as total_views,
    avg(views) as avg_views,
    min(views) as min_views,
    max(views) as max_views,
    stddev(views) as views_stddev
  `)
  .execute();

// Group by with having
const topAuthors = await client
  .from('posts')
  .select(`
    author_id,
    count(*) as post_count,
    sum(views) as total_views,
    avg(likes) as avg_likes
  `)
  .eq('published', true)
  .groupBy('author_id')
  .having('count(*) >= 5 AND avg(views) > 1000')
  .order('total_views', { ascending: false })
  .execute();

// Time-based analytics
const monthlyTrends = await client
  .from('posts')
  .select(`
    date_trunc('month', created_at) as month,
    count(*) as posts_count,
    avg(views) as avg_views,
    sum(views) as total_views
  `)
  .gte('created_at', '2024-01-01')
  .groupBy('date_trunc(month, created_at)')
  .order('month')
  .execute();

// Statistical functions
const statistics = await client
  .from('posts')
  .select(`
    percentile_cont(0.5) within group (order by views) as median_views,
    percentile_cont(0.95) within group (order by views) as p95_views,
    mode() within group (order by category) as most_common_category
  `)
  .execute();
```

### CORS Configuration

Production-ready cross-origin request handling:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  cors: {
    credentials: true,
    origins: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://localhost:3001']
      : ['https://myapp.com', 'https://api.myapp.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
  }
});

// Dynamic origin validation
const dynamicCorsClient = createClient({
  url: 'http://localhost:3000',
  cors: {
    origins: (origin) => {
      return origin?.includes('localhost') || 
             ['https://myapp.com'].includes(origin || '');
    }
  }
});
```

### RPC (Remote Procedure Calls)

Call PostgreSQL functions with full type safety:

```typescript
interface GetUserStatsArgs {
  user_id: number;
  start_date: string;
  end_date: string;
}

interface UserStats {
  total_posts: number;
  total_comments: number;
  reputation: number;
}

const stats = await client
  .rpc<GetUserStatsArgs, UserStats>('get_user_stats', {
    user_id: 123,
    start_date: '2023-01-01',
    end_date: '2023-12-31'
  })
  .single()
  .execute();
```

### Full-Text Search

```typescript
// PostgreSQL full-text search (if supported by PostgREST)
const searchResults = await client
  .from('articles')
  .select('*')
  .fts('content', 'javascript typescript')
  .getMany();
```

## 🛠️ Configuration

### Complete Configuration Options

```typescript
const client = createClient({
  // Required: PostgREST URL
  url: 'http://localhost:3000',
  
  // Optional: JWT token for authenticated requests
  token: 'jwt-token-here',
  
  // Optional: Default role (anonymous, authenticated, admin)
  role: 'authenticated',
  
  // Optional: Database schema (default: 'public')
  schema: 'public',
  
  // Optional: Custom headers
  headers: {
    'Custom-Header': 'value'
  },
  
  // Optional: Custom fetch implementation
  fetch: customFetch,
  
  // Optional: Cache configuration
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  },
  
  // Optional: Authentication settings
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  
  // Optional: Real-time configuration
  realtime: {
    enabled: true,
    url: 'ws://localhost:3000/realtime',
    heartbeatInterval: 30000,
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      delay: 1000
    }
  },
  
  // Optional: SSR configuration
  ssr: {
    enabled: true,
    serialize: true
  }
});
```

### Simple Configurations

```typescript
// Super simple - just URL
const simpleClient = createSimpleClient('http://localhost:3000');

// With role
const roleClient = createClientWithRole(
  'http://localhost:3000',
  PostgrestRole.AUTHENTICATED,
  'jwt-token'
);

// Extended from existing client
const extendedClient = client.extend({
  schema: 'auth',
  headers: { 'X-Custom': 'value' }
});
```

## 🐳 Docker Support

PGRestify is **fully Docker-compatible** and optimized for containerized applications:

### Quick Docker Setup

```typescript
// PGRestify automatically detects Docker environments
import { createSimpleClient } from 'pgrestify';

// Use Docker service names (automatic detection)
const client = createSimpleClient('http://postgrest:3000');

// Docker environment variables
const client = createSimpleClient(process.env.POSTGREST_URL!, {
  timeout: 30000, // Longer timeout for container networks
  retry: {
    attempts: 5,
    delay: 2000,
    shouldRetry: (error) => error.message.includes('ECONNREFUSED')
  }
});
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - POSTGREST_URL=http://postgrest:3000
      - JWT_SECRET=your-secret
    depends_on:
      - postgrest
      
  postgrest:
    image: postgrest/postgrest
    environment:
      PGRST_DB_URI: postgres://user:pass@postgres:5432/db
```

### Docker Features

- ✅ **Automatic Docker detection** - optimized timeouts and retry logic
- ✅ **Service discovery** - works with Docker service names
- ✅ **Health checks** - built-in container health monitoring
- ✅ **Environment variables** - full configuration via env vars
- ✅ **Docker secrets** - support for Docker Swarm secrets
- ✅ **Container logs** - structured logging for container environments

📖 **[Complete Docker Guide](docs/DOCKER_GUIDE.md)** - Comprehensive Docker usage guide

## 🧪 Testing

The library includes comprehensive testing utilities:

```typescript
import { createMockClient } from 'pgrestify/testing';

const mockClient = createMockClient();

// Mock responses
mockClient.from('users').select('*').mockResolve([
  { id: 1, name: 'John Doe', email: 'john@example.com' }
]);

// Use in tests
const users = await mockClient.from('users').select('*').execute();
expect(users.data).toHaveLength(1);
```

## 🚧 What Makes PGRestify Different?

### 🎯 Zero Configuration Required
- **No API keys needed** - just provide your PostgREST URL
- **Instant setup** - `createSimpleClient('http://localhost:3000')` and you're done
- **Smart defaults** - works out of the box with sensible configurations

### 🏗️ TypeORM-Inspired API
- **Familiar methods** - `find()`, `findBy()`, `save()`, `remove()`
- **Repository pattern** - clean separation of concerns
- **Active Record style** - intuitive data manipulation

### 🔐 PostgreSQL Role-Based Security
- **Native role support** - `anonymous`, `authenticated`, `admin`
- **Dynamic role switching** - change permissions at runtime
- **Security by design** - follows PostgreSQL security model

### ⚡ Enterprise-Grade Features
- **Real-time subscriptions** - live data updates via WebSockets
- **Intelligent caching** - automatic query caching with invalidation
- **SSR ready** - full server-side rendering support
- **Comprehensive error handling** - detailed error types and messages

### 🎨 Developer Experience First
- **Full TypeScript support** - complete type safety and inference
- **Framework agnostic** - works with any JavaScript framework
- **Extensive documentation** - comprehensive guides and examples
- **Zero dependencies** - lightweight and fast

## 📖 Documentation

- [Getting Started Guide](https://pgrestify.dev/guide)
- [API Reference](https://pgrestify.dev/api)  
- [Framework Integrations](https://pgrestify.dev/integrations)
<!-- - [TypeORM Migration Guide](https://pgrestify.dev/typeorm-migration) -->
- [PostgreSQL Roles Guide](https://pgrestify.dev/postgresql-roles)
- [Real-time Subscriptions](https://pgrestify.dev/realtime)
- [SSR Implementation](https://pgrestify.dev/ssr)
- [Examples & Recipes](https://pgrestify.dev/examples)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/pgrestify/pgrestify.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the library
pnpm build

# Start documentation site
pnpm docs:dev
```

## 📄 License

MIT © [PGRestify Team](https://github.com/pgrestify)

## 🚀 Roadmap

- [x] **Next.js Adapter** - Complete App Router and Pages Router support
- [ ] **CLI Tool** - Generate TypeScript types from PostgREST schema
- [ ] **Vue 3 Adapter** - Native Vue composables
- [ ] **Angular Adapter** - Angular services and interceptors
- [ ] **Svelte Adapter** - Svelte stores and actions
- [ ] **GraphQL Bridge** - Query PostgREST via GraphQL
- [ ] **Offline Support** - Local storage sync and offline queries
- [ ] **Schema Validation** - Runtime schema validation
- [ ] **Query Optimization** - Automatic query optimization
- [ ] **Performance Analytics** - Built-in performance monitoring

## 💪 Why Choose PGRestify?

| Feature | PGRestify | Supabase-js | Other Libraries |
|---------|-----------|-------------|-----------------|
| **No API Keys** | ✅ | ❌ | ❌ |
| **TypeORM Style** | ✅ | ❌ | ❌ |
| **PostgreSQL Roles** | ✅ | ⚠️ | ❌ |
| **Per-Query Roles** | ✅ | ❌ | ❌ |
| **Table Joining** | ✅ | ✅ | ⚠️ |
| **Advanced Pagination** | ✅ | ⚠️ | ❌ |
| **Full-Text Search** | ✅ | ✅ | ⚠️ |
| **Aggregate Functions** | ✅ | ⚠️ | ❌ |
| **CORS Configuration** | ✅ | ❌ | ⚠️ |
| **Real-time** | ✅ | ✅ | ⚠️ |
| **SSR Support** | ✅ | ⚠️ | ❌ |
| **Smart Caching** | ✅ | ❌ | ⚠️ |
| **React Integration** | ✅ | ⚠️ | ⚠️ |
| **Next.js Integration** | ✅ | ❌ | ❌ |
| **TanStack Query** | ✅ | ❌ | ❌ |
| **Framework Agnostic** | ✅ | ⚠️ | ❌ |
| **Bundle Size** | <15KB | ~20KB | Varies |
| **Type Safety** | ✅ | ✅ | ⚠️ |

## 🙏 Acknowledgments

- [PostgREST](https://postgrest.org/) - The amazing REST API for PostgreSQL
- [TypeORM](https://typeorm.io/) - Inspiration for the repository pattern
- [Supabase](https://supabase.com/) - Real-time and auth patterns
- [TanStack Query](https://tanstack.com/query) - Caching strategy inspiration
- The TypeScript and open source community

---

**[⭐ Star us on GitHub](https://github.com/pgrestify/pgrestify)** • **[💬 Join our Discord](https://discord.gg/pgrestify)** • **[📖 Read the Docs](https://pgrestify.dev)**

*Built with ❤️ for the PostgreSQL and TypeScript communities*