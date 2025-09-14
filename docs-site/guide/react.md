# React Integration

PGRestify provides powerful React hooks and components for seamless integration with React applications.

> **Note**: For comprehensive React integration including TanStack Query support, see our [React Guide](./react/hooks.md) and [TanStack Query Integration](./tanstack-query.md).

## Installation

```bash
npm install pgrestify
```

## Provider Setup

First, set up the PGRestify provider to make your client available throughout your app:

```typescript
import React from 'react';
import { PGRestifyProvider } from 'pgrestify/react';
import { createClient } from 'pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

function App() {
  return (
    <PGRestifyProvider client={client}>
      <UserList />
    </PGRestifyProvider>
  );
}
```

## Basic Query Hook

```typescript
import { useQuery } from 'pgrestify/react';
import { usePGRestify } from 'pgrestify/react';

interface User {
  id: number;
  name: string;
  email: string;
}

function UserList() {
  const client = usePGRestify();
  
  const { 
    data: users, 
    error,
    isLoading,
    refetch
  } = useQuery(
    client,
    'users',
    (query) => query.select('*').eq('active', true)
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {users?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## Mutation Hook

```typescript
import { useMutation, usePGRestify } from 'pgrestify/react';

function CreateUserForm() {
  const client = usePGRestify();
  
  const { 
    mutate: createUser, 
    isLoading, 
    error,
    data,
    mutateAsync
  } = useMutation(
    client,
    'users',
    {
      onSuccess: (newUser) => {
        console.log('User created:', newUser);
      },
      onError: (error) => {
        console.error('Failed to create user:', error);
      }
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {isLoading && <div>Submitting...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && <div>User created successfully!</div>}
      {/* Form inputs */}
    </form>
  );
}
```

## Advanced Features

For more advanced React patterns and features, see our comprehensive guides:

### 📖 Detailed React Documentation

- **[React Hooks Guide](./react/hooks.md)** - Complete React hooks reference with all available hooks and options
- **[React Data Fetching](./react/fetching.md)** - Advanced data fetching patterns and best practices  
- **[React Mutations](./react/mutations.md)** - Comprehensive guide to mutations, form handling, and optimistic updates

### 🚀 TanStack Query Integration

For the most powerful React experience, use our TanStack Query integration:

- **[TanStack Query Guide](./tanstack-query.md)** - Full TanStack Query integration with factories and utilities
- **[Advanced Caching](./advanced-features/caching.md)** - Intelligent caching strategies and invalidation patterns
- **[Real-time Updates](./advanced-features/realtime.md)** - Live data synchronization with PostgreSQL NOTIFY

### 🎯 Next.js Integration

For Next.js applications, see our specialized guides:

- **[Next.js Pages Router](./nextjs/pages-router.md)** - Integration with Pages Router
- **[Next.js App Router](./nextjs/app-router.md)** - Modern App Router patterns
- **[Next.js Server Components](./nextjs/server-components.md)** - Server-side rendering with React Server Components

## Quick Example

```typescript
// Complete example with provider, hooks, and error handling
import React from 'react';
import { PGRestifyProvider, useQuery, usePGRestify } from 'pgrestify/react';
import { createClient } from 'pgrestify';

const client = createClient({ url: 'http://localhost:3000' });

function UserList() {
  const client = usePGRestify();
  const { data: users, isLoading, error } = useQuery(
    client,
    'users', 
    (query) => query.select('id', 'name', 'email').eq('active', true)
  );

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Active Users</h2>
      {users?.map(user => (
        <div key={user.id}>
          <strong>{user.name}</strong> - {user.email}
        </div>
      ))}
    </div>
  );
}

function App() {
  return (
    <PGRestifyProvider client={client}>
      <UserList />
    </PGRestifyProvider>
  );
}
```

This provides a solid foundation for React integration. For production applications, we strongly recommend using the TanStack Query integration for optimal performance, caching, and developer experience.