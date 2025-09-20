# Introduction

PGRestify is the **definitive TypeScript client library** for PostgREST APIs. It offers two powerful approaches: PostgREST's native query syntax and a complete ORM-style interface with repositories and query builders. Zero configuration required.

## What is PGRestify?

PGRestify bridges the gap between your TypeScript application and PostgREST APIs, providing:

- **Dual query syntax** - Choose PostgREST native syntax OR complete ORM-style approach  
- **Zero-configuration setup** - No API keys required, just provide your PostgREST URL
- **Complete ORM features** - Repository pattern with query builders, `where()`, `leftJoinAndSelect()`
- **PostgreSQL role-based security** - Native support for `anonymous`, `authenticated`, and `admin` roles
- **Enterprise-grade features** - Real-time subscriptions, caching, SSR support
- **Full type safety** - Complete TypeScript support with schema inference

## Why Choose PGRestify?

### 🎯 **Zero Configuration**

Unlike other PostgREST clients that require API keys and complex setup, PGRestify works immediately:

```typescript
import { createClient } from '@webcoded/pgrestify';

// That's it!
const client = createClient({ url: 'http://localhost:3000' });
```

### 🏗️ **Dual Query Approaches**

Choose the syntax that fits your style - both are fully supported:

```typescript
// 🎯 PostgREST Native Syntax (clean and direct)
const users = await client.from('users').select('*').execute();
const activeUsers = await client.from('users').select('*').eq('active', true).execute();
const user = await client.from('users').select('*').eq('id', 1).single().execute();

// 🚀 ORM-Style Approach (familiar repository pattern)
const userRepo = client.getRepository<User>('users');

// Simple repository methods
const users = await userRepo.find();
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
await userRepo.save({ name: 'John Doe', email: 'john@example.com' });
```

### 🔐 **PostgreSQL Role-Based Security**

Built for PostgreSQL's native role system, not retrofitted from other databases:

```typescript
// Switch roles dynamically
await client.switchRole('authenticated', 'jwt-token');
const protectedData = await client.from('private_data').find();

// Per-query role override
const publicData = await client
  .from('public_content')
  .withRole('anonymous')
  .find();
```

### ⚡ **Enterprise Features Out of the Box**

No need to cobble together multiple libraries:

```typescript
// Real-time subscriptions
client.realtime.subscribe('users', 'INSERT', (payload) => {
  console.log('New user:', payload.new);
});

// Intelligent caching
const cachedUsers = await client
  .from('users')
  .cached(300) // Cache for 5 minutes
  .find();

// Full-text search
const searchResults = await client
  .from('posts')
  .fts('content', 'javascript typescript')
  .find();
```

## How It Works

PGRestify sits between your application and PostgREST, translating intuitive method calls into PostgREST API requests:

```
Your App → PGRestify → PostgREST → PostgreSQL
```

1. **Your Application** calls PGRestify methods like `client.from('users').find()`
2. **PGRestify** translates this into the appropriate PostgREST API call
3. **PostgREST** executes the query against PostgreSQL
4. **PGRestify** returns typed, validated results to your application

## Key Concepts

### Tables and Schemas

PGRestify works with your existing PostgreSQL tables and schemas:

```typescript
// Default 'public' schema
const users = await client.from('users').find();

// Specify schema
const authData = await client.from('auth.sessions').find();
```

### Type Safety

Full TypeScript support with schema inference:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

// Fully typed results
const users: User[] = await client.from<User>('users').find();
```

### Role-Based Access

PostgreSQL's role system is first-class:

```typescript
// Anonymous access
const client = createClientWithRole(url, 'anonymous');

// Authenticated access
const authClient = createClientWithRole(url, 'authenticated', token);

// Admin access
const adminClient = createClientWithRole(url, 'admin', adminToken);
```

## What Makes It Different?

| Feature | PGRestify | Other Clients |
|---------|-----------|---------------|
| **Setup** | Zero config | Requires API keys |
| **Query Syntax** | PostgREST + ORM dual approach | Single syntax only |
| **Query Builder** | Complete with `where()`, `leftJoinAndSelect()` | Basic or none |
| **Repository Pattern** | Full ORM with custom repositories | Manual implementation |
| **Role Support** | Native PostgreSQL roles | Manual implementation |
| **Type Safety** | Complete inference | Manual typing |
| **Real-time** | Built-in WebSockets | Separate library |
| **Caching** | Intelligent auto-cache | Manual implementation |
| **Docker** | Auto-optimized | Manual configuration |

## Next Steps

Ready to get started? Here's what to do next:

1. **[Installation](./installation)** - Install PGRestify in your project
2. **[Quick Start](./getting-started)** - Get up and running in 5 minutes
3. **[Configuration](./configuration)** - Learn about advanced configuration options
4. **[Examples](../examples/basic-usage)** - See real-world usage examples

Or dive deeper into specific features:

- **[Complete Features Guide](./complete-features.md)** - Every feature PGRestify offers
- **[CLI Tool](./cli.md)** - Comprehensive CLI command reference
- **[Query Builder](./query-builder.md)** - Learn the powerful query building API
- **[Authentication](./advanced-features/authentication.md)** - Implement secure authentication
- **[Real-time](./advanced-features/realtime.md)** - Add live data updates to your app
- **[Table-Based Structure](./table-folders.md)** - Modern SQL organization

Welcome to the future of PostgREST development! 🚀