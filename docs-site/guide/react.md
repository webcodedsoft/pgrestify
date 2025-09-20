# React Integration

PGRestify provides powerful React hooks and components for seamless integration with React applications.

> **Note**: For comprehensive React integration, see our [React Hooks Guide](./react/hooks.md).

## Installation

```bash
npm install @webcoded/pgrestify
```

## Provider Setup

First, set up the PGRestify provider to make your client available throughout your app:

```typescript
import React from 'react';
import { PGRestifyProvider } from '@webcoded/pgrestify/react';
import { createClient } from '@webcoded/pgrestify';

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
import { useQuery } from '@webcoded/pgrestify/react';

interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

function UserList() {
  const { 
    data: users, 
    error,
    isLoading,
    refetch
  } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email'],
    filter: { active: true },
    order: { column: 'name', ascending: true }
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {users?.map(user => (
        <li key={user.id}>{user.name} - {user.email}</li>
      ))}
    </ul>
  );
}
```

## Mutation Hook

```typescript
import { useMutation } from '@webcoded/pgrestify/react';

function CreateUserForm() {
  const { 
    mutate: createUser, 
    isLoading, 
    error,
    data,
    mutateAsync
  } = useMutation<User>('users', {
    operation: 'INSERT',
    onSuccess: (newUser) => {
      console.log('User created:', newUser);
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    }
  });

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

### 🚀 Advanced Features

For advanced React patterns:

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
import { PGRestifyProvider, useQuery } from '@webcoded/pgrestify/react';
import { createClient } from '@webcoded/pgrestify';

const client = createClient({ url: 'http://localhost:3000' });

function UserList() {
  const { data: users, isLoading, error } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email'],
    filter: { active: true }
  });

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

This provides a solid foundation for React integration with built-in hooks for querying and mutations.