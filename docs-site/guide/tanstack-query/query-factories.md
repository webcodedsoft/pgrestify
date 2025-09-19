# Query Factories

PGRestify provides pre-built query factories that generate TanStack Query configurations for common database operations. These factories eliminate boilerplate code and provide optimized query patterns with built-in caching strategies.

## Overview

Query factories provide:

- **Pre-configured TanStack Query options** for common operations
- **Automatic cache key management** with consistent naming patterns
- **Built-in error handling** optimized for PostgREST responses
- **Type-safe query configurations** with full TypeScript support
- **Optimized stale times** based on data usage patterns
- **Enhanced query options** with column selection and filtering

## Basic Query Factory

### Creating Query Factories

Create a query factory for any table:

```tsx
import { createPostgRESTQueries } from '@webcoded/pgrestify/tanstack-query';
import { createClient } from '@webcoded/pgrestify';

interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

const client = createClient({ url: 'http://localhost:3000' });
const userQueries = createPostgRESTQueries<User>(client, 'users');
```

### Available Query Methods

The factory provides these pre-built query configurations:

```tsx
// List queries
userQueries.list()                    // All records
userQueries.list({ active: true })    // Filtered records
userQueries.listWithOptions({...})    // Enhanced with column selection

// Detail queries
userQueries.detail('user-id')         // Single record by ID
userQueries.detailWithOptions('id', {...}) // Enhanced single record

// Single queries
userQueries.single((query) => {...})  // Custom single record query
userQueries.singleWithOptions({...})  // Enhanced single with options

// Custom queries
userQueries.custom((query) => {...}, ['cache-key']) // Custom query
userQueries.customWithOptions({...})  // Enhanced custom query
```

## List Queries

### Basic List Query

Fetch all records from a table:

```tsx
function UserList() {
  const { data: users, isLoading, error } = useQuery({
    ...userQueries.list()
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

### Filtered List Query

Apply filters to list queries:

```tsx
function ActiveUserList() {
  // Filter for active users only
  const { data: activeUsers } = useQuery({
    ...userQueries.list({ active: true })
  });

  // Multiple filters
  const { data: adminUsers } = useQuery({
    ...userQueries.list({ 
      active: true, 
      role: 'admin' 
    })
  });

  return (
    <div>
      <h2>Active Users ({activeUsers?.data?.length || 0})</h2>
      <h2>Admin Users ({adminUsers?.data?.length || 0})</h2>
    </div>
  );
}
```

### Enhanced List Query with Options

Use enhanced queries with column selection and advanced options:

```tsx
function EnhancedUserList() {
  const { data: users } = useQuery({
    ...userQueries.listWithOptions({
      // Select specific columns with aliases
      selectColumns: [
        'id',
        'first_name AS firstName',
        'last_name AS lastName',
        'email',
        'created_at AS joinedDate'
      ],
      
      // Apply filters
      filters: { 
        active: true,
        role: 'user'
      },
      
      // Custom ordering
      orderBy: [
        { column: 'created_at', ascending: false }
      ],
      
      // Pagination
      limit: 50,
      offset: 0,
      
      // Cache key extension for specific filtering
      keyExtension: ['active-users', 'page-1']
    })
  });

  return (
    <div>
      {users?.data?.map(user => (
        <div key={user.id}>
          <h3>{user.firstName} {user.lastName}</h3>
          <p>{user.email}</p>
          <small>Joined: {new Date(user.joinedDate).toLocaleDateString()}</small>
        </div>
      ))}
    </div>
  );
}
```

### Relationship Queries

Select related data using PostgREST's join syntax:

```tsx
function PostsWithAuthors() {
  const { data: posts } = useQuery({
    ...postQueries.listWithOptions({
      selectColumns: [
        'id',
        'title',
        'content',
        'published',
        'created_at AS publishedDate',
        // Join with users table
        'author:users!author_id(id, name, email)',
        // Join with categories
        'category:categories!category_id(name, slug)'
      ],
      filters: { published: true },
      orderBy: [{ column: 'created_at', ascending: false }],
      limit: 10
    })
  });

  return (
    <div>
      {posts?.data?.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.name} in {post.category.name}</p>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

## Detail Queries

### Basic Detail Query

Fetch a single record by ID:

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useQuery({
    ...userQueries.detail(userId)
  });

  if (isLoading) return <div>Loading user...</div>;

  return (
    <div>
      <h1>{user?.data?.name}</h1>
      <p>{user?.data?.email}</p>
    </div>
  );
}
```

### Enhanced Detail Query

Use enhanced detail queries with column selection:

```tsx
function UserProfileEnhanced({ userId }: { userId: string }) {
  const { data: user } = useQuery({
    ...userQueries.detailWithOptions(userId, {
      selectColumns: [
        'id',
        'first_name AS firstName',
        'last_name AS lastName',
        'email',
        'avatar_url AS avatar',
        // Include profile relationship
        'profile:profiles!user_id(bio, website, location)'
      ]
    })
  });

  return (
    <div>
      <img src={user?.data?.avatar} alt={`${user?.data?.firstName}'s avatar`} />
      <h1>{user?.data?.firstName} {user?.data?.lastName}</h1>
      <p>{user?.data?.email}</p>
      {user?.data?.profile && (
        <div>
          <p>{user.data.profile.bio}</p>
          <a href={user.data.profile.website}>Website</a>
          <p>Location: {user.data.profile.location}</p>
        </div>
      )}
    </div>
  );
}
```

## Single Record Queries

### Custom Single Record Query

Find a single record using custom conditions:

```tsx
function UserByEmail({ email }: { email: string }) {
  const { data: user } = useQuery({
    ...userQueries.single(
      (query) => query.eq('email', email),
      ['by-email', email]  // Cache key extension
    )
  });

  return user?.data ? (
    <div>Found user: {user.data.name}</div>
  ) : (
    <div>User not found</div>
  );
}
```

### Enhanced Single Query

Use enhanced single queries with options:

```tsx
function UserByEmailEnhanced({ email }: { email: string }) {
  const { data: user } = useQuery({
    ...userQueries.singleWithOptions({
      selectColumns: [
        'id',
        'name',
        'email', 
        'last_login AS lastLogin'
      ],
      filters: { active: true }  // Additional filters
    }, 
    (query) => query.eq('email', email),  // Custom query builder
    ['active-user-by-email', email]       // Cache key extension
    )
  });

  return (
    <div>
      {user?.data && (
        <div>
          <h3>{user.data.name}</h3>
          <p>Last login: {user.data.lastLogin}</p>
        </div>
      )}
    </div>
  );
}
```

## Custom Queries

### Advanced Custom Queries

Create complex queries with full control:

```tsx
function RecentActiveUsers() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: users } = useQuery({
    ...userQueries.custom(
      (query) => query
        .eq('active', true)
        .gte('last_login', thirtyDaysAgo.toISOString())
        .order('last_login', { ascending: false })
        .limit(20),
      ['recent-active', '30-days']  // Cache key extension
    )
  });

  return (
    <div>
      <h2>Recently Active Users</h2>
      {users?.data?.map(user => (
        <div key={user.id}>
          {user.name} - Last seen: {new Date(user.last_login).toLocaleDateString()}
        </div>
      ))}
    </div>
  );
}
```

### Enhanced Custom Queries

Combine custom query logic with enhanced options:

```tsx
function TopContributors() {
  const { data: contributors } = useQuery({
    ...userQueries.customWithOptions({
      selectColumns: [
        'id',
        'name',
        'email',
        'created_at AS joinedDate'
      ],
      // Base filters applied first
      filters: { active: true },
      orderBy: [{ column: 'created_at', ascending: true }]
    },
    // Additional custom query logic
    (query) => query
      .gte('contribution_score', 100)
      .limit(10),
    ['top-contributors', 'score-100+']
    )
  });

  return (
    <div>
      <h2>Top Contributors</h2>
      {contributors?.data?.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>Member since: {new Date(user.joinedDate).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
```

## Query Configuration Options

### Stale Time Configuration

Each query type has optimized stale times:

```tsx
// Built-in stale times:
userQueries.list()           // 5 minutes (frequently changing)
userQueries.detail(id)       // 10 minutes (more stable)
userQueries.custom(...)      // 5 minutes (variable data)

// Override stale times:
const { data } = useQuery({
  ...userQueries.list(),
  staleTime: 15 * 60 * 1000,  // 15 minutes custom stale time
});
```

### Cache Key Patterns

Query factories generate consistent cache keys:

```tsx
// Generated cache key patterns:
userQueries.list()                    // ['pgrestify', 'tables', 'users', 'data', undefined]
userQueries.list({ active: true })    // ['pgrestify', 'tables', 'users', 'data', { active: true }]
userQueries.detail('123')             // ['pgrestify', 'tables', 'users', 'item', '123']
userQueries.custom(..., ['recent'])   // ['pgrestify', 'tables', 'users', 'custom', 'recent']
```

### Query Key Extensions

Extend cache keys for more specific caching:

```tsx
const { data } = useQuery({
  ...userQueries.listWithOptions({
    filters: { role: 'admin' },
    keyExtension: ['admin-only', 'page-1']
  })
});

// Generated key: ['pgrestify', 'tables', 'users', 'data', { role: 'admin' }, 'admin-only', 'page-1']
```

## Error Handling in Factories

### Built-in Error Processing

Query factories include PostgREST-specific error handling:

```tsx
// Factories automatically handle PostgREST errors
const { data, error, isError } = useQuery({
  ...userQueries.list(),
  onError: (error) => {
    // PostgREST errors are already converted to JavaScript errors
    console.error('Query failed:', error.message);
  }
});

// Custom error handling
const { data } = useQuery({
  ...userQueries.list(),
  retry: (failureCount, error) => {
    // Don't retry authentication errors
    if (error.message.includes('JWT') || error.message.includes('401')) {
      return false;
    }
    return failureCount < 3;
  }
});
```

## Performance Optimization

### Selective Data Fetching

Use column selection to minimize data transfer:

```tsx
// Fetch only needed columns
const { data: userSummaries } = useQuery({
  ...userQueries.listWithOptions({
    selectColumns: ['id', 'name', 'email'],  // Only essential fields
    limit: 100
  })
});

// Fetch detailed data only when needed
const { data: userDetails } = useQuery({
  ...userQueries.detailWithOptions(userId, {
    selectColumns: [
      'id', 'name', 'email', 'bio', 'avatar_url',
      'profile:profiles(*)',  // Full profile data
      'posts:posts(id, title, created_at)'  // Recent posts
    ]
  }),
  enabled: !!userId  // Only fetch when userId is available
});
```

### Query Deduplication

TanStack Query automatically deduplicates identical queries:

```tsx
// These queries will be deduped if called simultaneously
function Component1() {
  const { data } = useQuery({ ...userQueries.list() });
  // ... component logic
}

function Component2() {
  const { data } = useQuery({ ...userQueries.list() });  // Same query, deduped
  // ... component logic
}
```

## Complete Table Integration

### All-in-One Table Factory

Use the complete table factory for comprehensive integration:

```tsx
import { createTableQueries } from '@webcoded/pgrestify/tanstack-query';

const userTable = createTableQueries<User>(client, 'users');

// Access queries and mutations
const queries = userTable.queries;
const mutations = userTable.mutations;
const keys = userTable.keys;

// Use in components
function UserManagement() {
  const { data: users } = useQuery({ ...queries.list() });
  const createUser = useMutation({ ...mutations.insert() });
  
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: keys.table('users') });
  };

  return (
    <div>
      <button onClick={handleRefresh}>Refresh Users</button>
      {/* User list and creation form */}
    </div>
  );
}
```

## Summary

PGRestify query factories provide powerful, pre-configured TanStack Query options that eliminate boilerplate code while providing advanced features like column selection, relationship loading, and optimized caching. These factories make it easy to build performant, type-safe React applications with PostgREST APIs.