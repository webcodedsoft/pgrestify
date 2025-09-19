# TanStack Query Integration

PGRestify provides comprehensive TanStack Query integration with pre-built query factories, enhanced column selection, cache management utilities, and optimized patterns for PostgREST APIs.

## Quick Start

```bash
npm install @webcoded/pgrestify @tanstack/react-query
```

## Basic Usage

```typescript
import { useQuery } from '@tanstack/react-query';
import { createPostgRESTQueries } from '@webcoded/pgrestify/tanstack-query';
import { createClient } from '@webcoded/pgrestify';

const client = createClient({ url: 'http://localhost:3000' });
const userQueries = createPostgRESTQueries<User>(client, 'users');

function UserList() {
  const { data: users, isLoading, error } = useQuery({
    ...userQueries.list({ active: true })
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {users?.data?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

## Mutations

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPostgRESTMutations } from '@webcoded/pgrestify/tanstack-query';

function CreateUserForm() {
  const queryClient = useQueryClient();
  const userMutations = createPostgRESTMutations<User>(client, 'users');
  
  const createUser = useMutation({
    ...userMutations.insert({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['pgrestify', 'tables', 'users'] });
        console.log('User created:', data.data);
      }
    })
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createUser.mutate({ 
      name: 'John Doe', 
      email: 'john@example.com' 
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? 'Creating...' : 'Create User'}
      </button>
      {createUser.error && <div>Error: {createUser.error.message}</div>}
    </form>
  );
}
```

## Pagination

```typescript
function PaginatedUserList() {
  const [page, setPage] = useState(1);

  const { 
    data, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['users', page],
    queryFn: () => client
      .from<User>('users')
      .select('*')
      .order('created_at', { ascending: false })
      .paginate({ page, pageSize: 10 })
      .executeWithPagination(),
    ...postgrestQuery.options
  });

  return (
    <div>
      {data?.data.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      <div>
        <button 
          disabled={!data?.pagination.hasPreviousPage}
          onClick={() => setPage(p => p - 1)}
        >
          Previous
        </button>
        <button 
          disabled={!data?.pagination.hasNextPage}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

## Infinite Query

```typescript
function InfiniteUserList() {
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ['users', 'infinite'],
    queryFn: ({ pageParam = 1 }) => client
      .from<User>('users')
      .select('*')
      .order('created_at', { ascending: false })
      .paginate({ page: pageParam, pageSize: 10 })
      .executeWithPagination(),
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasNextPage 
        ? lastPage.pagination.page + 1 
        : undefined,
    ...postgrestQuery.options
  });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.data.map(user => (
            <div key={user.id}>{user.name}</div>
          ))}
        </React.Fragment>
      ))}
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage
          ? 'Loading more...'
          : hasNextPage
          ? 'Load More'
          : 'Nothing more to load'}
      </button>
    </div>
  );
}
```

## Query Provider Setup

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PGRestifyProvider } from '@webcoded/pgrestify/react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
    }
  }
});

function App() {
  return (
    <PGRestifyProvider client={client}>
      <QueryClientProvider client={queryClient}>
        {/* Your app components */}
      </QueryClientProvider>
    </PGRestifyProvider>
  );
}
```

## Advanced Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global query configuration
      retry: (failureCount, error) => {
        // Custom retry logic
        if (error.status === 404) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => 
        Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
});
```

## Real-time Integration

```typescript
function LiveUserUpdates() {
  const queryClient = useQueryClient();

  // Subscribe to real-time updates
  useEffect(() => {
    const subscription = client.realtime
      .from('users')
      .onInsert((payload) => {
        // Invalidate and refetch users query
        queryClient.invalidateQueries(['users']);
      });

    return () => subscription.unsubscribe();
  }, [queryClient]);
}
```

## Error Handling

```typescript
function UserQueryWithErrorHandling() {
  const { 
    data: users, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => client.from('users').select('*'),
    retry: 2, // Retry failed queries twice
    onError: (error) => {
      // Log or handle specific error types
      if (error.status === 403) {
        // Handle authorization errors
        showAuthorizationError();
      }
    }
  });

  if (isError) {
    return (
      <div>
        <p>Error loading users: {error.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  // Render users
}
```

## Best Practices

- Use query keys consistently
- Implement optimistic updates
- Handle loading and error states
- Use infinite queries for large datasets
- Configure global query options
- Leverage caching and invalidation
- Implement real-time updates

## Performance Considerations

- Automatic deduplication of requests
- Configurable caching strategies
- Minimal re-renders
- Supports server-side rendering
- Efficient data fetching and state management