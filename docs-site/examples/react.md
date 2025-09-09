# React Integration Example

Comprehensive guide to integrating PGRestify with React applications.

## Basic Setup

```tsx
import React from 'react';
import { createClient, PGRestifyProvider } from 'pgrestify/react';

// Create PGRestify client
const client = createClient('http://localhost:3000');

// App component with PGRestify provider
function App() {
  return (
    <PGRestifyProvider client={client}>
      <UserManagementApp />
    </PGRestifyProvider>
  );
}
```

## Query Hook

```tsx
import { useQuery } from 'pgrestify/react';

// Define type for user
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

function UserList() {
  const { 
    data: users, 
    loading, 
    error 
  } = useQuery<User>('users', query => 
    query.select('*').eq('active', true)
  );

  if (loading) return <div>Loading...</div>;
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

```tsx
import { useMutation } from 'pgrestify/react';

function CreateUserForm() {
  const { 
    mutate: createUser, 
    loading, 
    error 
  } = useMutation<User>('users');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newUser = await createUser({
        name: 'John Doe',
        email: 'john@example.com',
        active: true
      });
      
      console.log('User created:', newUser);
    } catch (submitError) {
      console.error('User creation failed', submitError);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {loading && <div>Submitting...</div>}
      {error && <div>Error: {error.message}</div>}
      <button type="submit">Create User</button>
    </form>
  );
}
```

## Pagination Hook

```tsx
import { usePaginatedQuery } from 'pgrestify/react';

function PaginatedUserList() {
  const { 
    data: users, 
    loading, 
    error,
    pagination,
    fetchNextPage,
    fetchPreviousPage
  } = usePaginatedQuery<User>('users', query => 
    query.select('*').order('created_at', { ascending: false })
  );

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      
      <div>
        <button 
          disabled={!pagination.hasPreviousPage}
          onClick={fetchPreviousPage}
        >
          Previous
        </button>
        <button 
          disabled={!pagination.hasNextPage}
          onClick={fetchNextPage}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

## Real-time Subscription Hook

```tsx
import { useRealtimeSubscription } from 'pgrestify/react';

function LiveUserUpdates() {
  const { 
    data: newUsers, 
    error 
  } = useRealtimeSubscription<User>('users', 'INSERT');

  return (
    <div>
      {newUsers?.map(user => (
        <div key={user.id}>New user: {user.name}</div>
      ))}
    </div>
  );
}
```

## Advanced Query Configuration

```tsx
function ComplexUserQuery() {
  const { 
    data: users, 
    loading, 
    error 
  } = useQuery<User>('users', query => 
    query
      .select('id', 'name', 'email')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(10)
  );

  // Render logic
}
```

## Error Handling

```tsx
function UserQueryWithErrorHandling() {
  const { 
    data: users, 
    loading, 
    error,
    retry 
  } = useQuery<User>('users', query => 
    query.select('*')
  );

  if (error) {
    return (
      <div>
        <p>Error loading users: {error.message}</p>
        <button onClick={retry}>Retry</button>
      </div>
    );
  }

  // Render users
}
```

## Caching and Performance

```tsx
function CachedUserQuery() {
  const { 
    data: users 
  } = useQuery<User>('users', query => 
    query.select('*'), 
    {
      // Cache configuration
      cacheTime: 300000, // 5 minutes
      staleTime: 60000,  // 1 minute
      refetchOnWindowFocus: true
    }
  );

  // Render users
}
```

## Type Safety

```tsx
interface ComplexUser {
  id: number;
  name: string;
  email: string;
  posts: {
    id: number;
    title: string;
  }[];
}

function TypeSafeUserQuery() {
  const { 
    data: users 
  } = useQuery<ComplexUser>('users', query => 
    query.select(`
      id,
      name,
      email,
      posts:posts(id, title)
    `)
  );

  // TypeScript ensures type safety
  users?.forEach(user => {
    console.log(user.posts[0].title);
  });
}
```

## Optimistic Updates

```tsx
function OptimisticUpdateExample() {
  const { 
    mutate: updateUser,
    optimisticUpdate
  } = useMutation<User>('users');

  const handleUserUpdate = async (userId: number, updates: Partial<User>) => {
    // Optimistic update before server confirmation
    optimisticUpdate(userId, updates);

    try {
      await updateUser(userId, updates);
    } catch (error) {
      // Rollback if server update fails
      optimisticUpdate(userId, null);
    }
  };
}
```

## Authentication Integration

```tsx
import { useAuth } from 'pgrestify/react';

function AuthenticatedUserProfile() {
  const { 
    user, 
    signOut 
  } = useAuth();

  if (!user) return <LoginForm />;

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

## Best Practices

- Wrap app with `PGRestifyProvider`
- Use type generics for type safety
- Handle loading and error states
- Leverage caching for performance
- Use hooks for different query types
- Implement error boundaries

## Performance Considerations

- Hooks are lightweight
- Minimal re-renders with memoization
- Automatic caching and deduplication
- Configurable refetch strategies
- Supports server-side rendering

## Troubleshooting

- Ensure `PGRestifyProvider` is set up
- Check network connectivity
- Verify PostgREST URL
- Use error handling in hooks
- Monitor network tab for query details