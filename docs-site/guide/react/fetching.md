# React Data Fetching

PGRestify's React hooks provide powerful data fetching capabilities with built-in state management, caching, and error handling. This guide covers the various data fetching patterns and advanced techniques available.

## Basic Data Fetching

### Simple Query Hook

The `useQuery` hook is the primary tool for fetching data:

```tsx
import { useQuery } from 'pgrestify/react';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

function UserList() {
  const { data: users, loading, error } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email'],
    order: { column: 'name', ascending: true }
  });

  if (loading) return <div>Loading...</div>;
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

### Single Record Fetching

Use `useSingleQuery` when you need exactly one record:

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { data: user, loading, error } = useSingleQuery<User>({
    from: 'users',
    select: '*',
    filter: { id: userId }
  });

  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>Member since: {new Date(user.created_at).toLocaleDateString()}</p>
    </div>
  );
}
```

## Advanced Query Configuration

### Filtering and Search

```tsx
function SearchableUserList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>();

  const { data: users, loading } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email', 'active'],
    filter: {
      ...(searchTerm && { 
        or: `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%` 
      }),
      ...(isActive !== undefined && { active: isActive })
    },
    order: { column: 'name', ascending: true },
    limit: 50
  });

  return (
    <div>
      <div className="filters">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select 
          value={isActive?.toString() ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setIsActive(val === '' ? undefined : val === 'true');
          }}
        >
          <option value="">All Users</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {loading ? (
        <div>Searching...</div>
      ) : (
        <div className="user-list">
          {users?.map(user => (
            <div key={user.id} className={`user ${user.active ? 'active' : 'inactive'}`}>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Relationships and Joins

```tsx
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  // Relations
  author?: User;
  comments?: Comment[];
}

function PostList() {
  const { data: posts, loading } = useQuery<Post>({
    from: 'posts',
    select: [
      'id',
      'title', 
      'content',
      'created_at',
      'author:users(id,name,email)', // Join with users table
      'comments(id,content,user:users(name))' // Nested join
    ],
    order: { column: 'created_at', ascending: false },
    limit: 10
  });

  if (loading) return <div>Loading posts...</div>;

  return (
    <div className="posts">
      {posts?.map(post => (
        <article key={post.id} className="post">
          <header>
            <h2>{post.title}</h2>
            <div className="meta">
              By {post.author?.name} on {new Date(post.created_at).toLocaleDateString()}
            </div>
          </header>
          
          <div className="content">
            {post.content}
          </div>
          
          <footer>
            <div className="comments-count">
              {post.comments?.length || 0} comments
            </div>
          </footer>
        </article>
      ))}
    </div>
  );
}
```

### Dynamic Query Building

```tsx
interface SearchFilters {
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
}

function DynamicPostSearch() {
  const [filters, setFilters] = useState<SearchFilters>({});
  
  const { data: posts, loading, refetch } = useQuery<Post>({
    from: 'posts',
    select: ['id', 'title', 'content', 'category', 'status', 'created_at'],
    filter: {
      ...(filters.category && { category: filters.category }),
      ...(filters.status && { status: filters.status }),
      ...(filters.dateFrom && { 
        created_at: `gte.${filters.dateFrom}` 
      }),
      ...(filters.dateTo && { 
        created_at: `lte.${filters.dateTo}` 
      }),
      ...(filters.tags?.length && {
        tags: `cs.{${filters.tags.join(',')}}` // Contains any of these tags
      })
    },
    order: { column: 'created_at', ascending: false },
    enabled: Object.keys(filters).length > 0 // Only run when filters are set
  });

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <div className="search-filters">
        <select 
          value={filters.category || ''}
          onChange={(e) => updateFilter('category', e.target.value || undefined)}
        >
          <option value="">All Categories</option>
          <option value="tech">Technology</option>
          <option value="design">Design</option>
          <option value="business">Business</option>
        </select>

        <select 
          value={filters.status || ''}
          onChange={(e) => updateFilter('status', e.target.value || undefined)}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
          placeholder="From date"
        />

        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
          placeholder="To date"
        />

        <button onClick={() => setFilters({})}>
          Clear Filters
        </button>
      </div>

      {loading && <div>Searching...</div>}
      
      <div className="results">
        {posts?.map(post => (
          <div key={post.id} className="search-result">
            <h3>{post.title}</h3>
            <p>{post.content.substring(0, 150)}...</p>
            <div className="meta">
              {post.category} • {post.status} • {new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Query Options and Caching

### Caching Configuration

```tsx
function CachedUserData({ userId }: { userId: string }) {
  const { data: user, loading } = useQuery<User>({
    from: 'users',
    select: '*',
    filter: { id: userId },
    
    // Caching options
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    
    // Refetch options
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
    
    // Only run if userId is provided
    enabled: !!userId
  });

  return (
    <div>
      {loading ? (
        <div>Loading user data...</div>
      ) : user ? (
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
      ) : (
        <div>User not found</div>
      )}
    </div>
  );
}
```

### Conditional Queries

```tsx
function ConditionalData() {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Main query always runs
  const { data: users } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email']
  });

  // Detail query only runs when enabled
  const { data: userDetails, loading: detailsLoading } = useQuery<User>({
    from: 'users',
    select: '*',
    filter: { id: selectedUserId },
    relations: ['profile', 'posts'],
    enabled: showDetails && !!selectedUserId // Conditional execution
  });

  return (
    <div>
      <div className="user-list">
        {users?.map(user => (
          <div key={user.id} className="user-item">
            <span>{user.name}</span>
            <button 
              onClick={() => {
                setSelectedUserId(user.id);
                setShowDetails(true);
              }}
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {showDetails && (
        <div className="user-details">
          {detailsLoading ? (
            <div>Loading details...</div>
          ) : userDetails ? (
            <div>
              <h3>{userDetails.name}</h3>
              <p>Email: {userDetails.email}</p>
              <p>Joined: {new Date(userDetails.created_at).toLocaleDateString()}</p>
              <button onClick={() => setShowDetails(false)}>
                Close Details
              </button>
            </div>
          ) : (
            <div>Details not available</div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Loading States and Error Handling

### Advanced Loading States

```tsx
function SmartLoadingStates() {
  const { data: posts, loading, error, refetch, isFetching } = useQuery<Post>({
    from: 'posts',
    select: '*',
    order: { column: 'created_at', ascending: false }
  });

  return (
    <div>
      <div className="header">
        <h1>Posts</h1>
        <button 
          onClick={() => refetch()}
          disabled={isFetching}
          className={isFetching ? 'loading' : ''}
        >
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Initial loading */}
      {loading && !posts && (
        <div className="loading-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-title"></div>
              <div className="skeleton-content"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="error-banner">
          <p>Failed to load posts: {error.message}</p>
          <button onClick={() => refetch()}>Try Again</button>
        </div>
      )}

      {/* Data with background loading indicator */}
      {posts && (
        <div className={`posts-container ${isFetching ? 'updating' : ''}`}>
          {isFetching && !loading && (
            <div className="background-loading">Updating...</div>
          )}
          
          {posts.map(post => (
            <article key={post.id} className="post">
              <h2>{post.title}</h2>
              <p>{post.content}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Retry and Error Recovery

```tsx
function RobustDataFetching() {
  const [retryCount, setRetryCount] = useState(0);
  
  const { data, loading, error, refetch } = useQuery<User>({
    from: 'users',
    select: '*',
    
    // Retry configuration
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff
    
    // Manual retry tracking
    onError: (error) => {
      console.error(`Query failed (attempt ${retryCount + 1}):`, error);
      setRetryCount(prev => prev + 1);
    },
    
    onSuccess: () => {
      setRetryCount(0); // Reset on success
    }
  });

  const handleManualRetry = () => {
    setRetryCount(0);
    refetch();
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading users...</p>
        {retryCount > 0 && <p>Retry attempt: {retryCount}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Failed to Load Data</h3>
        <p>{error.message}</p>
        <div className="error-actions">
          <button onClick={handleManualRetry}>
            Try Again
          </button>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
        <details className="error-details">
          <summary>Technical Details</summary>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </details>
      </div>
    );
  }

  return (
    <div>
      {data?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### Query Deduplication

```tsx
function DeduplicatedQueries() {
  // These will be automatically deduped if called simultaneously
  const query1 = useQuery<User>({
    from: 'users',
    select: ['id', 'name']
  });

  const query2 = useQuery<User>({
    from: 'users', 
    select: ['id', 'name'] // Same query - will be deduped
  });

  // Only one network request will be made
  return (
    <div>
      <div>Query 1 loading: {query1.loading.toString()}</div>
      <div>Query 2 loading: {query2.loading.toString()}</div>
    </div>
  );
}
```

### Prefetching Data

```tsx
function PrefetchedData() {
  const [selectedTab, setSelectedTab] = useState<'users' | 'posts'>('users');

  // Always fetch users (current tab)
  const { data: users, loading: usersLoading } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email'],
    enabled: selectedTab === 'users'
  });

  // Prefetch posts when not selected
  const { data: posts, loading: postsLoading } = useQuery<Post>({
    from: 'posts',
    select: ['id', 'title', 'content'],
    enabled: selectedTab === 'posts',
    staleTime: 60000 // Keep fresh for 1 minute
  });

  const handleTabChange = (tab: 'users' | 'posts') => {
    setSelectedTab(tab);
    
    // Prefetch the other tab's data
    if (tab === 'users') {
      // Prefetch posts for faster switching
    } else {
      // Prefetch users for faster switching  
    }
  };

  return (
    <div>
      <div className="tabs">
        <button 
          className={selectedTab === 'users' ? 'active' : ''}
          onClick={() => handleTabChange('users')}
        >
          Users {usersLoading && '⟳'}
        </button>
        <button 
          className={selectedTab === 'posts' ? 'active' : ''}
          onClick={() => handleTabChange('posts')}
        >
          Posts {postsLoading && '⟳'}
        </button>
      </div>

      <div className="tab-content">
        {selectedTab === 'users' && (
          <div>
            {users?.map(user => (
              <div key={user.id}>{user.name}</div>
            ))}
          </div>
        )}
        
        {selectedTab === 'posts' && (
          <div>
            {posts?.map(post => (
              <div key={post.id}>{post.title}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Background Updates

```tsx
function BackgroundRefresh() {
  const { data: notifications, refetch } = useQuery({
    from: 'notifications',
    select: ['id', 'message', 'read', 'created_at'],
    filter: { user_id: 'current-user-id', read: false },
    
    // Background refresh configuration
    refetchInterval: 30000, // Every 30 seconds
    refetchOnWindowFocus: true, // When user returns to tab
    refetchOnReconnect: true, // When network reconnects
    
    // Keep previous data while refetching
    keepPreviousData: true,
    
    // Update in background without showing loading
    notifyOnChangeProps: ['data', 'error'] // Don't notify about loading changes
  });

  // Manual refresh
  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="notifications">
      <div className="header">
        <h3>Notifications</h3>
        <button onClick={handleRefresh} className="refresh-btn">
          ⟳ Refresh
        </button>
      </div>
      
      {notifications?.length ? (
        <ul>
          {notifications.map(notification => (
            <li key={notification.id} className="notification-item">
              <p>{notification.message}</p>
              <time>{new Date(notification.created_at).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p>No new notifications</p>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Query Key Stability

```tsx
// Good: Stable query configuration
function StableQuery({ userId }: { userId: string }) {
  const queryConfig = useMemo(() => ({
    from: 'users',
    select: ['id', 'name', 'email'],
    filter: { id: userId },
    enabled: !!userId
  }), [userId]);

  const { data } = useQuery<User>(queryConfig);
  
  return <div>{data?.name}</div>;
}

// Avoid: Inline objects that create new references
function UnstableQuery({ userId }: { userId: string }) {
  // This creates a new object on every render, causing unnecessary refetches
  const { data } = useQuery<User>({
    from: 'users',
    select: ['id', 'name', 'email'], // New array reference each time
    filter: { id: userId }, // New object reference each time
    enabled: !!userId
  });
  
  return <div>{data?.name}</div>;
}
```

### 2. Error Boundary Integration

```tsx
function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="query-error">
          <h3>Data Loading Error</h3>
          <p>{error.message}</p>
          <button onClick={resetError}>Try Again</button>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('Query error:', error, errorInfo);
        // Report to error tracking service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### 3. Suspense Integration

```tsx
function SuspensefulQuery() {
  const { data: users } = useQuery<User>({
    from: 'users',
    select: '*',
    suspense: true // Use Suspense for loading
  });

  // This component will suspend until data is loaded
  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}

// Wrap with Suspense boundary
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuspensefulQuery />
    </Suspense>
  );
}
```

## Summary

PGRestify's React data fetching capabilities provide:

- **Declarative API**: Simple, React-friendly hook interface
- **Smart Caching**: Automatic deduplication and background updates  
- **Error Recovery**: Built-in retry logic and error boundaries
- **Performance**: Optimized queries with prefetching and background refresh
- **Type Safety**: Full TypeScript support with schema inference
- **Flexibility**: Support for simple queries to complex joins and filtering

These patterns enable building robust, performant React applications with efficient data fetching and excellent user experiences.