# PGRestify

[![npm version](https://badge.fury.io/js/%40webcoded%2Fpgrestify.svg)](https://badge.fury.io/js/%40webcoded%2Fpgrestify)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/%40webcoded%2Fpgrestify)](https://bundlephobia.com/package/@webcoded/pgrestify)

**📖 [Complete Documentation](https://pgrestify.netlify.app/) | [Getting Started](https://pgrestify.netlify.app/guide/getting-started) | [API Reference](https://pgrestify.netlify.app/guide/api/)**

The **definitive TypeScript client library** for PostgREST APIs. Choose between PostgREST's native syntax or a complete ORM-style approach with repositories and query builders. No API keys required, PostgreSQL role-based security, and enterprise-grade features with zero-config setup.

## ✨ Key Features

- 🎯 **Zero Configuration** - No API keys required! Just provide your PostgREST URL
- 🏗️ **Dual Query Syntax** - Choose PostgREST syntax OR ORM-style repositories
- 🚀 **ORM-Style Methods** - Familiar `find()`, `save()`, `createQueryBuilder()` methods
- 🔐 **PostgreSQL Roles** - Built-in role-based security with dynamic switching
- ⚡ **Real-time & Caching** - WebSocket subscriptions and intelligent caching
- 🔗 **Framework Ready** - React hooks, Next.js adapter, query library support
- 🔒 **Full Type Safety** - Complete TypeScript support with schema inference
- 📦 **Lightweight** - Core library < 15KB gzipped

## 📦 Installation

```bash
npm install @webcoded/pgrestify
# or
yarn add @webcoded/pgrestify
# or
pnpm add @webcoded/pgrestify
```

## 🚀 Quick Start

```typescript
import { createClient } from '@webcoded/pgrestify';

// 1. Create client (zero config!)
const client = createClient({
  url: 'http://localhost:3000'
});

// 2. Define your types
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

// 3. Choose your style:

// 🎯 PostgREST Syntax
const users = await client
  .from<User>('users')
  .select('*')
  .eq('active', true)
  .execute();

// 🏗️ Repository Pattern
const userRepo = client.getRepository<User>('users');
const activeUsers = await userRepo.find({ where: { active: true } });
const user = await userRepo.findOne({ id: 1 });

// Save data
await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});

// 🚀 Query Builder
const users = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .orderBy('created_at', 'DESC')
  .getMany();
```

## 🎯 Framework Integrations

### React Hooks
```typescript
import { useQuery, useMutation } from '@webcoded/pgrestify/react';

function UserList() {
  const { data: users, loading } = useQuery('users', 
    query => query.select('*').eq('active', true)
  );
  
  return <div>{users?.map(user => <div key={user.id}>{user.name}</div>)}</div>;
}
```

### Next.js
```typescript
// App Router
import { createServerClient } from '@webcoded/pgrestify/nextjs';

export default async function Page() {
  const client = createServerClient();
  const users = await client.from('users').find();
  return <div>{/* render users */}</div>;
}
```

### Query Libraries
```typescript
import { useQuery } from '@tanstack/react-query';

function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => client.from('users').find()
  });
}
```

## 🔥 Advanced Features

```typescript
// Real-time subscriptions
await client.realtime.connect();
client.realtime.from('users').onInsert(payload => {
  console.log('New user:', payload.new);
});

// Authentication with auto-refresh
const { data } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});

// Smart caching with TTL
const client = createClient({
  url: 'http://localhost:3000',
  cache: { enabled: true, ttl: 300000 }
});

// PostgreSQL role switching
await client.switchRole('admin');
const adminData = await client.from('users').find();
```

**📖 [View Complete Documentation](https://pgrestify.netlify.app/) for detailed guides on:**
- [Authentication & Authorization](https://pgrestify.netlify.app/guide/advanced-features/authentication)
- [Real-time Subscriptions](https://pgrestify.netlify.app/guide/advanced-features/realtime)
- [Caching Strategies](https://pgrestify.netlify.app/guide/advanced-features/caching)
- [Server-Side Rendering](https://pgrestify.netlify.app/guide/production/deployment)
- [Custom Repositories](https://pgrestify.netlify.app/guide/orm/custom-repositories)
- [Query Builder Guide](https://pgrestify.netlify.app/guide/api/query-builder)

## 📖 Documentation

**📖 [Complete Documentation](https://pgrestify.netlify.app/)**

### Quick Links
- [Getting Started Guide](https://pgrestify.netlify.app/guide/getting-started)
- [API Reference](https://pgrestify.netlify.app/guide/api/)
- [Repository Pattern Guide](https://pgrestify.netlify.app/guide/orm/)
- [React Integration](https://pgrestify.netlify.app/guide/react/)
- [Next.js Integration](https://pgrestify.netlify.app/guide/nextjs/)
- [Advanced Features](https://pgrestify.netlify.app/guide/advanced-features/)

## 🚧 Why Choose PGRestify?

| Feature | PGRestify | Supabase-js | Other Libraries |
|---------|-----------|-------------|-----------------|
| **No API Keys** | ✅ | ❌ | ❌ |
| **ORM-Style API** | ✅ | ❌ | ❌ |
| **PostgreSQL Roles** | ✅ | ⚠️ | ❌ |
| **Real-time** | ✅ | ✅ | ⚠️ |
| **Smart Caching** | ✅ | ❌ | ⚠️ |
| **React & Next.js** | ✅ | ⚠️ | ❌ |
| **Bundle Size** | <15KB | ~20KB | Varies |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/pgrestify/pgrestify.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the library
pnpm build
```

## 📄 License

MIT © [PGRestify Team](https://github.com/pgrestify)

## 🙏 Acknowledgments

- [PostgREST](https://postgrest.org/) - The amazing REST API for PostgreSQL
- Popular ORM libraries - Inspiration for the repository pattern
- Modern query libraries - Caching strategy inspiration

---

**[⭐ Star us on GitHub](https://github.com/pgrestify/pgrestify)** • **[📖 Complete Documentation](https://pgrestify.netlify.app/)**

*Built with ❤️ for the PostgreSQL and TypeScript communities*