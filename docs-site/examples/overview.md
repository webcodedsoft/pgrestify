# Examples Overview

Welcome to the PGRestify examples! This section provides comprehensive, real-world examples to help you get the most out of PGRestify.

## 🚀 Getting Started

Start here if you're new to PGRestify:

### [Basic Usage](./basic-usage)
Learn the fundamentals with practical examples covering:
- **Dual Query Syntax**: Both PostgREST native and repository patterns
- **CRUD Operations**: Create, read, update, and delete data
- **Type Safety**: Full TypeScript integration
- **Error Handling**: Proper error management
- **Real-world Architecture**: Service patterns and best practices

## 🔧 Advanced Examples

### [Advanced Queries](./advanced-queries)
Master complex querying techniques:
- Complex filtering and joins
- Aggregation and grouping
- Full-text search
- Performance optimization

### [Authentication](./authentication)
Secure your applications with:
- JWT authentication flows
- Role-based access control
- Session management
- Protected routes

### [Real-time Updates](./realtime)
Build live applications with:
- WebSocket subscriptions
- Live data updates
- Real-time notifications
- Event-driven architecture

### [Docker Setup](./docker)
Deploy with confidence:
- Docker containerization
- PostgreSQL + PostgREST setup
- Development environments
- Production deployment

## ⚛️ Framework Integration

### [React Integration](./react)
Build powerful React applications:
- **Built-in Hooks**: `useQuery`, `useMutation`, `useRepository`
- **State Management**: Automatic caching and updates
- **Loading States**: Handle loading and error states
- **Optimistic Updates**: Immediate UI feedback
- **Type Safety**: Full TypeScript support

### [Next.js Examples](./nextjs-examples)
Complete Next.js integration:
- **App Router**: Server Components and Client Components
- **Pages Router**: SSG, SSR, and API routes
- **Authentication**: Auth flows and protected pages
- **Real-time**: Live updates and subscriptions
- **Performance**: Optimization techniques

## 🎯 Example Structure

Each example follows this structure:

### Code Variants
Most examples show **both query syntaxes**:

::: code-group

```typescript [PostgREST Syntax]
// Direct PostgREST API calls
const { data, error } = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .execute();
```

```typescript [Repository Pattern]
// ORM-style repository pattern
const userRepo = client.getRepository<User>('users');
const users = await userRepo.findBy({ active: true });
```

:::

### Complete Examples
- **Setup**: Installation and configuration
- **Types**: TypeScript interfaces
- **Implementation**: Working code
- **Error Handling**: Proper error management
- **Best Practices**: Performance and security tips

## 🛠️ What You'll Learn

### Core Concepts
- **Type-safe queries** with full IntelliSense
- **Dual syntax support** - choose your preferred style
- **Advanced filtering** and complex queries
- **Relationship handling** and joins
- **Error management** and loading states

### Framework Integration
- **React hooks** for data fetching and mutations
- **Next.js patterns** for SSR, SSG, and API routes
- **Authentication flows** and protected routes
- **Real-time subscriptions** and live updates

### Production Readiness
- **Performance optimization** techniques
- **Caching strategies** and invalidation
- **Security best practices** and validation
- **Deployment patterns** and Docker setup

## 🎯 Quick Navigation

| Category | Examples | What You'll Learn |
|----------|----------|-------------------|
| **Getting Started** | [Basic Usage](./basic-usage) | CRUD operations, type safety, dual syntax |
| **Advanced Queries** | [Advanced Queries](./advanced-queries) | Complex filtering, joins, aggregation |
| **Security** | [Authentication](./authentication) | JWT auth, RBAC, session management |
| **Real-time** | [Real-time Updates](./realtime) | WebSocket subscriptions, live data |
| **React** | [React Integration](./react) | Hooks, state management, optimistic updates |
| **Next.js** | [Next.js Examples](./nextjs-examples) | SSR, SSG, API routes, authentication |
| **DevOps** | [Docker Setup](./docker) | Containerization, deployment |

## 💡 Tips for Success

1. **Start with Basic Usage** - Get familiar with both query syntaxes
2. **Choose Your Style** - Pick PostgREST syntax or repository pattern
3. **Add Type Safety** - Define your database types for better DX
4. **Handle Errors** - Always implement proper error handling
5. **Optimize Performance** - Use caching and selective queries
6. **Follow Examples** - Copy and adapt the patterns shown

Ready to get started? Begin with [Basic Usage](./basic-usage) and work your way through the examples! 🚀