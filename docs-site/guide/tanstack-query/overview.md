# TanStack Query Integration

PGRestify provides comprehensive TanStack Query integration with pre-built query factories, enhanced column selection, cache management utilities, and optimized patterns for PostgREST APIs. This integration makes React data fetching powerful, type-safe, and performant.

## Overview

The TanStack Query integration provides:

- **Pre-built Query Factories**: Ready-to-use query configurations for common operations
- **Enhanced Query Functions**: Built-in column selection with alias support
- **Mutation Factories**: Optimized insert, update, delete, and upsert operations
- **Cache Management**: Advanced cache optimization and invalidation utilities
- **Query Key Management**: Consistent cache key strategies
- **RPC Function Support**: Seamless integration with PostgREST RPC endpoints
- **TypeScript Integration**: Full type safety with automatic inference

## Installation

TanStack Query is a peer dependency that must be installed alongside PGRestify:

```bash
# Install TanStack Query
npm install @tanstack/react-query

# PGRestify automatically detects and integrates
npm install @webcoded/pgrestify
```

## Basic Setup

### Query Client Configuration

Set up TanStack Query with PGRestify integration:

```tsx
// app.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@webcoded/pgrestify';

// Create PGRestify client
const pgrestClient = createClient({
  url: 'http://localhost:3000',
  apikey: 'your-anon-key'
});

// Create TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      cacheTime: 10 * 60 * 1000,    // 10 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Custom retry logic for PostgREST errors
        if (error.message.includes('401')) return false;
        return failureCount < 3;
      }
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourAppComponents />
    </QueryClientProvider>
  );
}
```

### Basic Usage Example

```tsx
// components/UserList.tsx
import { useQuery } from '@tanstack/react-query';
import { createPostgRESTQueries } from '@webcoded/pgrestify/tanstack-query';
import { createClient } from '@webcoded/pgrestify';

interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

const client = createClient({ url: 'http://localhost:3000' });
const userQueries = createPostgRESTQueries<User>(client, 'users');

function UserList() {
  const { 
    data: users, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    ...userQueries.list({ active: true })
  });

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Active Users ({users?.data?.length || 0})</h1>
      <button onClick={() => refetch()}>Refresh</button>
      {users?.data?.map(user => (
        <div key={user.id} className="user-card">
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  );
}
```

## Enhanced Query Features

### Column Selection with Aliases

Select specific columns and use aliases for better data structures:

```tsx
// components/UserProfile.tsx
import { useQuery } from '@tanstack/react-query';
import { createPostgRESTQueries } from '@webcoded/pgrestify/tanstack-query';

const userQueries = createPostgRESTQueries<User>(client, 'users');

function UserProfile({ userId }: { userId: string }) {
  // Enhanced query with column selection and aliases
  const { data: user } = useQuery({
    ...userQueries.detailWithOptions(userId, {
      selectColumns: [
        'id',
        'first_name AS firstName',
        'last_name AS lastName', 
        'email',
        'created_at AS createdAt'
      ]
    })
  });

  return (
    <div>
      <h1>{user?.data?.firstName} {user?.data?.lastName}</h1>
      <p>Email: {user?.data?.email}</p>
      <p>Member since: {new Date(user?.data?.createdAt).toLocaleDateString()}</p>
    </div>
  );
}
```

### Advanced Filtering and Ordering

Use enhanced queries with built-in filtering and ordering:

```tsx
// components/PostList.tsx
function PostList() {
  const { data: posts } = useQuery({
    ...postQueries.listWithOptions({
      selectColumns: [
        'id',
        'title', 
        'content',
        'created_at AS createdAt',
        'author:users!author_id(name, email)'  // Join with users
      ],
      filters: { 
        published: true,
        category: 'technology' 
      },
      orderBy: [
        { column: 'created_at', ascending: false }
      ],
      limit: 20
    })
  });

  return (
    <div>
      {posts?.data?.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.name} on {new Date(post.createdAt).toLocaleDateString()}</p>
          <div>{post.content}</div>
        </article>
      ))}
    </div>
  );
}
```

## Query Factories

### Pre-built Query Configurations

PGRestify provides ready-to-use query configurations:

```tsx
// Create query factory for a table
const userQueries = createPostgRESTQueries<User>(client, 'users');

// Available query configurations:
const queries = {
  // List all records with optional filters
  list: userQueries.list({ active: true }),
  
  // Enhanced list with column selection and options
  listWithOptions: userQueries.listWithOptions({
    selectColumns: ['id', 'name AS fullName', 'email'],
    filters: { role: 'admin' },
    orderBy: [{ column: 'created_at', ascending: false }],
    limit: 50
  }),
  
  // Single record by ID
  detail: userQueries.detail('user-id-here'),
  
  // Enhanced single record with options
  detailWithOptions: userQueries.detailWithOptions('user-id', {
    selectColumns: ['id', 'name', 'profile:profiles(*)']
  }),
  
  // Custom query with query builder
  custom: userQueries.custom(
    (query) => query.eq('role', 'admin').gte('created_at', '2024-01-01'),
    ['admin-users', '2024']  // Cache key extension
  ),
  
  // Enhanced custom query
  customWithOptions: userQueries.customWithOptions({
    selectColumns: ['id', 'name', 'last_login AS lastLogin'],
    filters: { active: true }
  }, (query) => query.order('last_login', { ascending: false }))
};
```

### Complete Table Integration

Create comprehensive query and mutation factories:

```tsx
// utils/queries.ts
import { createTableQueries } from '@webcoded/pgrestify/tanstack-query';

// Complete integration for users table
export const userTable = createTableQueries<User>(client, 'users');

// Available in userTable:
// - userTable.queries.list()
// - userTable.queries.detail()
// - userTable.mutations.insert()
// - userTable.mutations.update()
// - userTable.keys.table('users')
```

## Mutation Integration

### Built-in Mutation Factories

```tsx
// components/UserForm.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPostgRESTMutations } from '@webcoded/pgrestify/tanstack-query';

const userMutations = createPostgRESTMutations<User>(client, 'users');

function UserForm() {
  const queryClient = useQueryClient();
  
  const createUser = useMutation({
    ...userMutations.insert({
      onSuccess: (data) => {
        // Invalidate and refetch user list
        queryClient.invalidateQueries({ queryKey: ['pgrestify', 'tables', 'users'] });
        console.log('User created:', data.data);
      }
    })
  });
  
  const updateUser = useMutation({
    ...userMutations.update({
      onSuccess: (data, variables) => {
        // Update specific user in cache
        queryClient.setQueryData(
          ['pgrestify', 'tables', 'users', 'item', variables.where.id],
          data
        );
      }
    })
  });

  const handleSubmit = async (formData: Partial<User>) => {
    try {
      if (formData.id) {
        // Update existing user
        await updateUser.mutateAsync({
          where: { id: formData.id },
          values: formData
        });
      } else {
        // Create new user
        await createUser.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Operation failed:', error);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSubmit({
        name: formData.get('name') as string,
        email: formData.get('email') as string
      });
    }}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={createUser.isPending || updateUser.isPending}>
        {createUser.isPending || updateUser.isPending ? 'Saving...' : 'Save User'}
      </button>
    </form>
  );
}
```

## Query Key Management

### Consistent Cache Keys

PGRestify provides structured query key management:

```tsx
import { createQueryKeys } from '@webcoded/pgrestify/tanstack-query';

const queryKeys = createQueryKeys();

// Generated query keys:
queryKeys.all()                                    // ['pgrestify']
queryKeys.tables()                                 // ['pgrestify', 'tables']  
queryKeys.table('users')                          // ['pgrestify', 'tables', 'users']
queryKeys.tableData('users', { active: true })   // ['pgrestify', 'tables', 'users', 'data', { active: true }]
queryKeys.tableItem('users', 'user-id')          // ['pgrestify', 'tables', 'users', 'item', 'user-id']
queryKeys.rpc('get_user_stats', { userId: '1' }) // ['pgrestify', 'rpc', 'get_user_stats', { userId: '1' }]
```

### Cache Invalidation

```tsx
// components/UserActions.tsx
import { useQueryClient } from '@tanstack/react-query';
import { createInvalidationHelpers } from '@webcoded/pgrestify/tanstack-query';

function UserActions() {
  const queryClient = useQueryClient();
  const userInvalidation = createInvalidationHelpers('users');
  
  const refreshUsers = () => {
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateTable() 
    });
  };
  
  const refreshUserList = () => {
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateList() 
    });
  };
  
  const refreshSpecificUser = (userId: string) => {
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateItem(userId) 
    });
  };

  return (
    <div>
      <button onClick={refreshUsers}>Refresh All User Data</button>
      <button onClick={refreshUserList}>Refresh User List</button>
    </div>
  );
}
```

## Error Handling

### PostgREST-Specific Error Handling

```tsx
// utils/errorHandling.ts
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data, error, isError } = useQuery({
    ...userQueries.list(),
    retry: (failureCount, error) => {
      // Don't retry client errors (4xx)
      if (error.message.includes('401') || error.message.includes('403')) {
        return false;
      }
      // Retry server errors (5xx) up to 3 times
      return failureCount < 3;
    },
    onError: (error) => {
      // Handle PostgREST-specific errors
      if (error.message.includes('JWT')) {
        // Redirect to login
        window.location.href = '/login';
      }
    }
  });

  if (isError) {
    return (
      <div className="error">
        <h3>Something went wrong</h3>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  // ... rest of component
}
```

## Performance Optimization

### Optimized Query Configurations

```tsx
// Configure queries for optimal performance
const optimizedQueries = {
  // Frequently accessed data with longer cache time
  userProfile: useQuery({
    ...userQueries.detail(userId),
    staleTime: 10 * 60 * 1000,  // 10 minutes
    cacheTime: 30 * 60 * 1000,  // 30 minutes
  }),
  
  // Real-time data with shorter cache time
  notifications: useQuery({
    ...notificationQueries.list({ read: false }),
    staleTime: 30 * 1000,       // 30 seconds
    refetchInterval: 60 * 1000,  // Refetch every minute
  }),
  
  // Static data with very long cache time
  categories: useQuery({
    ...categoryQueries.list(),
    staleTime: 60 * 60 * 1000,   // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  })
};
```

## Integration with React Patterns

### Custom Hooks

Create reusable data fetching hooks:

```tsx
// hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query';
import { createPostgRESTQueries } from '@webcoded/pgrestify/tanstack-query';

const userQueries = createPostgRESTQueries<User>(client, 'users');

export function useUsers(filters?: Partial<User>) {
  return useQuery({
    ...userQueries.list(filters),
    select: (data) => ({
      users: data.data || [],
      total: data.data?.length || 0,
      isEmpty: !data.data || data.data.length === 0
    })
  });
}

export function useUser(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...userQueries.detail(userId),
    enabled: options?.enabled ?? !!userId,
    select: (data) => data.data
  });
}

// Usage in components
function UserComponent({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUser(userId);
  const { users, isEmpty } = useUsers({ active: true });
  
  // ... component logic
}
```

## Summary

PGRestify's TanStack Query integration provides a powerful, type-safe, and performant solution for React data fetching with PostgREST APIs. The pre-built factories, enhanced query features, and optimized cache management make it easy to build responsive applications with excellent user experience.