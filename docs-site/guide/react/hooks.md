# React Hooks Overview

PGRestify provides comprehensive React hooks for seamless integration with React applications. These hooks offer type-safe data fetching, mutations, and real-time updates with built-in state management, caching, and error handling.

## Setup and Configuration

### Installation

Install the React adapter with your preferred package manager:

```bash
npm install @webcoded/pgrestify react
# or
pnpm add @webcoded/pgrestify react
# or
yarn add @webcoded/pgrestify react
```

### Provider Setup

Wrap your app with the PGRestifyProvider:

```tsx
import React from 'react';
import { createClient } from '@webcoded/pgrestify';
import { PGRestifyProvider } from '@webcoded/pgrestify/react';
import App from './App';

// Create the client instance
const client = createClient({ 
  url: 'http://localhost:3000',
  // Optional configuration
  schema: 'public'
});

function Root() {
  return (
    <PGRestifyProvider client={client}>
      <App />
    </PGRestifyProvider>
  );
}

export default Root;
```

### TypeScript Support

PGRestify hooks are fully type-safe. Define your database interfaces:

```tsx
interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  bio?: string;
  avatar_url?: string;
  website?: string;
}
```

## Available Hooks

### Data Fetching Hooks

#### useQuery
Modern query hook with object configuration:

```tsx
import { useQuery } from '@webcoded/pgrestify/react';

function UserList() {
  const { 
    data: users, 
    isLoading, 
    isFetching,
    isError,
    isSuccess,
    error, 
    refetch 
  } = useQuery<User>({
    queryKey: ['users', 'active'],
    from: 'users',
    select: ['id', 'name', 'email'],
    filter: { active: true },
    order: { column: 'name', ascending: true },
    limit: 10,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchInterval: 30000     // 30 seconds
  });

  if (isLoading) return <div>Loading users...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

#### Query States

The `useQuery` hook provides several state indicators:

```tsx
function QueryStatesExample() {
  const {
    data,
    isLoading,    // Initial load
    isFetching,   // Background refetch
    isError,      // Error occurred
    isSuccess,    // Query succeeded
    isPending,    // Query in progress
    isRefetching, // Manual refetch
    isStale,      // Data is stale
    error
  } = useQuery({
    queryKey: ['users'],
    from: 'users',
    select: '*'
  });

  if (isPending) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;
  if (isSuccess && isFetching) return <div>Updating... {data?.length} users</div>;
  
  return <div>{data?.length} users loaded</div>;
}
```

#### Query Options

```tsx
function QueryOptionsExample() {
  const { data } = useQuery({
    queryKey: ['users'],
    from: 'users',
    select: '*',
    
    // Caching options
    staleTime: 5 * 60 * 1000,     // Fresh for 5 minutes
    gcTime: 10 * 60 * 1000,       // Cache for 10 minutes
    
    // Refetch options
    refetchInterval: 30000,        // Auto-refetch every 30s
    refetchOnWindowFocus: true,    // Refetch on focus
    
    // Error handling
    retry: 3,                      // Retry 3 times
    throwOnError: false,           // Don't throw errors
    
    // Suspense mode
    suspense: true                 // Use with React Suspense
  });
}
```

**Advanced Query Features with Relations, Aliases, and Multiple Sorting:**

```tsx
// Relations - Join with related tables
function UsersWithProfiles() {
  const { data: users } = useQuery<User>({
    queryKey: ['users', 'profiles'],
    from: 'users',
    select: [
      'id',
      'name AS user_name',
      'email AS contact_email',
      'profile.bio AS user_bio',
      'profile.avatar_url AS profile_image'
    ],
    relations: ['profile'],
    filter: { active: true },
    order: [
      { column: 'name', ascending: true },           // Primary sort: alphabetical
      { column: 'profile.created_at', ascending: false } // Secondary sort: newest profiles first
    ]
  });

  return (
    <div>
      {users?.map(user => (
        <div key={user.id} className="user-card">
          <img src={user.profile_image} alt="Avatar" />
          <div>
            <h3>{user.user_name}</h3>
            <p>{user.contact_email}</p>
            <p>{user.user_bio}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Multiple relations with complex sorting
function BlogPostsWithAuthors() {
  const { data: posts } = useQuery<Post>({
    queryKey: ['posts', 'authors', 'categories'],
    from: 'posts',
    select: [
      'id AS post_id',
      'title AS post_title',
      'created_at AS published_date',
      'author.name AS author_name',
      'author.email AS author_contact',
      'category.name AS category_name'
    ],
    relations: ['author', 'category'],
    filter: { published: true },
    order: [
      { column: 'category.name', ascending: true },      // Group by category
      { column: 'created_at', ascending: false },        // Latest posts first
      { column: 'author.name', ascending: true }         // Alphabetical by author
    ],
    limit: 20
  });

  return (
    <div>
      {posts?.map(post => (
        <article key={post.post_id}>
          <h2>{post.post_title}</h2>
          <p>By {post.author_name} in {post.category_name}</p>
          <time>{new Date(post.published_date).toLocaleDateString()}</time>
        </article>
      ))}
    </div>
  );
}
```

#### useSingleQuery
Query for a single record:

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useSingleQuery<User>({
    queryKey: ['user', userId],
    from: 'users',
    select: '*',
    filter: { id: userId }
  });

  if (isLoading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>Joined: {new Date(user.created_at).toLocaleDateString()}</p>
    </div>
  );
}
```

#### useInfiniteQuery
For infinite scrolling and pagination:

```tsx
function InfinitePostList() {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<Post>({
    queryKey: ['posts', 'infinite'],
    from: 'posts',
    select: ['id', 'title', 'content', 'created_at'],
    order: { column: 'created_at', ascending: false },
    limit: 10,
    
    // Pagination configuration
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 10 ? allPages.length : undefined;
    },
    getPreviousPageParam: (firstPage, allPages) => {
      return allPages.length > 1 ? allPages.length - 2 : undefined;
    },
    
    // Caching options
    staleTime: 5 * 60 * 1000,      // 5 minutes fresh
    gcTime: 10 * 60 * 1000,        // 10 minutes in cache
    
    // Auto-refetch options
    refetchInterval: 60000,         // Refetch every minute
    
    // Error handling
    suspense: false,                // Disable suspense mode
    throwOnError: false             // Handle errors gracefully
  });

  const allPosts = data?.pages.flatMap(page => page) ?? [];

  return (
    <div>
      {allPosts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content.substring(0, 150)}...</p>
          <time>{new Date(post.created_at).toLocaleDateString()}</time>
        </article>
      ))}
      
      {hasNextPage && (
        <button 
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
      
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

**Infinite Query with Relations and Aliases:**

```tsx
// E-commerce product listing with infinite scroll
function InfiniteProductCatalog() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<Product>({
    queryKey: ['products', 'catalog'],
    from: 'products',
    select: [
      'id AS product_id',
      'name AS product_name',
      'price AS current_price',
      'category.name AS category_name',
      'category.slug AS category_slug',
      'reviews.rating AS avg_rating',
      'reviews.count AS review_count'
    ],
    relations: ['category', 'reviews'],
    filter: { active: true },
    order: [
      { column: 'category.sort_order', ascending: true },    // Category priority
      { column: 'reviews.rating', ascending: false },       // Best rated first
      { column: 'price', ascending: true }                  // Cheapest first within rating
    ],
    limit: 20
  });

  const allProducts = data?.pages.flatMap(page => page) ?? [];

  return (
    <div className="product-grid">
      {allProducts.map(product => (
        <div key={product.product_id} className="product-card">
          <h3>{product.product_name}</h3>
          <p className="price">${product.current_price}</p>
          <p className="category">{product.category_name}</p>
          <div className="rating">
            ⭐ {product.avg_rating} ({product.review_count} reviews)
          </div>
        </div>
      ))}
      
      {hasNextPage && (
        <button 
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="load-more-btn"
        >
          {isFetchingNextPage ? 'Loading more products...' : 'Load More Products'}
        </button>
      )}
    </div>
  );
}

// Social media feed with complex relations
function InfiniteSocialFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage
  } = useInfiniteQuery<Post>({
    queryKey: ['posts', 'social-feed'],
    from: 'posts',
    select: [
      'id AS post_id',
      'content AS post_content',
      'created_at AS posted_at',
      'author.name AS author_name',
      'author.avatar_url AS author_avatar',
      'author.verified AS is_verified',
      'likes.count AS like_count',
      'comments.count AS comment_count'
    ],
    relations: ['author', 'likes', 'comments'],
    filter: { published: true },
    order: [
      { column: 'created_at', ascending: false },           // Latest first
      { column: 'likes.count', ascending: false },          // Popular posts prioritized
      { column: 'author.follower_count', ascending: false } // Influential authors first
    ],
    limit: 15
  });

  const allPosts = data?.pages.flatMap(page => page) ?? [];

  return (
    <div className="social-feed">
      {allPosts.map(post => (
        <div key={post.post_id} className="post-card">
          <div className="post-header">
            <img src={post.author_avatar} alt="Avatar" />
            <div>
              <span className="author-name">{post.author_name}</span>
              {post.is_verified && <span className="verified">✓</span>}
            </div>
            <time>{new Date(post.posted_at).toLocaleDateString()}</time>
          </div>
          <p className="post-content">{post.post_content}</p>
          <div className="post-stats">
            <span>❤️ {post.like_count}</span>
            <span>💬 {post.comment_count}</span>
          </div>
        </div>
      ))}
      
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>
          Load More Posts
        </button>
      )}
    </div>
  );
}
```

### Mutation Hooks

#### useMutation
Generic mutation hook with operation specification:

```tsx
import { useMutation, MutationOperation } from '@webcoded/pgrestify/react';

function CreateUser() {
  const { mutate: createUser, isLoading, error } = useMutation<User>('users', {
    operation: MutationOperation.INSERT,
    onSuccess: (user) => {
      console.log('User created:', user);
      // Optionally invalidate queries to refetch data
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    }
  });

  const handleSubmit = (formData: FormData) => {
    createUser({
      name: formData.get('name') as string,
      email: formData.get('email') as string
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create User'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </form>
  );
}
```

#### useInsert
Specialized hook for inserts:

```tsx
function PostForm() {
  const { mutate: createPost, isLoading, error } = useInsert<Post>('posts', {
    onSuccess: (post) => {
      console.log('Post created:', post);
      // Navigate or show success message
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createPost({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      author_id: 'current-user-id',
      published: false
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Post Title" required />
      <textarea name="content" placeholder="Post Content" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Post'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </form>
  );
}
```

#### useUpdate
For updating existing records:

```tsx
function EditProfile({ profileId }: { profileId: string }) {
  const { mutate: updateProfile, isLoading } = useUpdate<Profile>('profiles', {
    onSuccess: () => {
      alert('Profile updated successfully!');
    }
  });

  const handleSave = (profileData: Partial<Profile>) => {
    updateProfile({
      data: profileData,
      filter: { id: profileId }
    });
  };

  return (
    <div>
      <input 
        onChange={(e) => handleSave({ bio: e.target.value })}
        placeholder="Bio"
      />
      <button 
        onClick={() => handleSave({ bio: 'Updated bio' })}
        disabled={isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}
```

#### useDelete
For deleting records:

```tsx
function DeleteButton({ userId }: { userId: string }) {
  const { mutate: deleteUser, isLoading } = useDelete('users', {
    onSuccess: () => {
      alert('User deleted successfully');
    }
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser({ id: userId });
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isLoading}
      className="danger-button"
    >
      {isLoading ? 'Deleting...' : 'Delete User'}
    </button>
  );
}
```

#### useUpsert
For insert-or-update operations:

```tsx
function UserSettings({ userId }: { userId: string }) {
  const { mutate: saveSettings, isLoading } = useUpsert<Profile>('profiles', {
    onSuccess: () => {
      console.log('Settings saved');
    }
  });

  const handleSave = (settings: Partial<Profile>) => {
    saveSettings({
      user_id: userId,
      ...settings
    });
  };

  return (
    <div>
      <textarea 
        onChange={(e) => handleSave({ bio: e.target.value })}
        placeholder="Tell us about yourself..."
      />
      <input
        onChange={(e) => handleSave({ website: e.target.value })}
        placeholder="Website URL"
      />
      <button onClick={() => handleSave({})} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
```

### Advanced Hooks

#### useAuth
Authentication state management:

```tsx
import { useAuth } from '@webcoded/pgrestify/react';

function AuthStatus() {
  const { user, isLoading, signIn, signOut, session } = useAuth();

  if (isLoading) return <div>Checking authentication...</div>;

  if (!user) {
    return (
      <div>
        <button onClick={() => signIn('email@example.com', 'password')}>
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <p>Session expires: {new Date(session.expires_at).toLocaleString()}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

#### useRealtimeSubscription
Real-time data updates:

```tsx
function RealtimePostList() {
  const { data: posts } = useQuery<Post>({
    queryKey: ['posts'],
    from: 'posts',
    select: '*',
    order: { column: 'created_at', ascending: false }
  });

  // Subscribe to real-time updates
  useRealtimeSubscription('posts', {
    event: '*', // Listen to all events
    onInsert: (post) => {
      console.log('New post:', post);
      // Optionally refetch or update local state
    },
    onUpdate: (post) => {
      console.log('Updated post:', post);
    },
    onDelete: (post) => {
      console.log('Deleted post:', post);
    }
  });

  return (
    <div>
      <h2>Live Posts</h2>
      {posts?.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  );
}
```

#### useRawQuery
For complex custom queries:

```tsx
function UserStats({ userId }: { userId: string }) {
  const { data: stats, isLoading } = useRawQuery(
    `/rpc/get_user_stats?user_id=${userId}`,
    {
      enabled: !!userId,
      refetchInterval: 30000 // Refresh every 30 seconds
    }
  );

  if (isLoading) return <div>Loading stats...</div>;

  return (
    <div>
      <h3>User Statistics</h3>
      <p>Total Posts: {stats?.total_posts}</p>
      <p>Total Comments: {stats?.total_comments}</p>
      <p>Reputation: {stats?.reputation}</p>
    </div>
  );
}
```

#### useQueryBuilder
Direct access to query builder for dynamic queries:

```tsx
function AdvancedSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  
  const { 
    data: posts, 
    isLoading, 
    isFetching,
    isError,
    error,
    refetch 
  } = useQueryBuilder<Post>({
    queryKey: ['posts', 'search', searchTerm, category],
    enabled: false, // Manual triggering
    
    // Query builder function
    queryFn: (client) => {
      let query = client.from<Post>('posts').select('*');
      
      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }
      
      if (category) {
        query = query.eq('category', category);
      }
      
      return query.order('created_at', { ascending: false });
    }
  });

  const handleSearch = () => {
    refetch();
  };

  return (
    <div>
      <input 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search posts..."
      />
      <select 
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">All Categories</option>
        <option value="tech">Technology</option>
        <option value="design">Design</option>
      </select>
      <button onClick={handleSearch} disabled={isLoading}>
        Search
      </button>
      
      {posts?.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content.substring(0, 100)}...</p>
        </div>
      ))}
    </div>
  );
}
```

## Error Boundaries

Handle errors gracefully with React Error Boundaries:

```tsx
class PGRestifyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PGRestify Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: undefined })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <PGRestifyProvider client={client}>
      <PGRestifyErrorBoundary>
        <UserList />
        <PostList />
      </PGRestifyErrorBoundary>
    </PGRestifyProvider>
  );
}
```

## Configuration Options

### Global Hook Configuration

Configure hooks globally via the provider:

```tsx
const client = createClient({ 
  url: 'http://localhost:3000',
  // Global configurations that affect hooks
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  },
  retry: {
    attempts: 3,
    delay: 1000
  }
});

function Root() {
  return (
    <PGRestifyProvider client={client}>
      <App />
    </PGRestifyProvider>
  );
}
```

### Per-Hook Configuration

Override global settings per hook:

```tsx
function CriticalData() {
  const { data } = useQuery<User>({
    queryKey: ['users', 'critical'],
    from: 'users',
    select: '*',
    // Override global settings
    staleTime: 0, // Always fresh
    cacheTime: 60000, // Cache for 1 minute
    retry: 0, // No retries
    refetchInterval: 5000 // Refetch every 5 seconds
  });

  return <div>{/* Component content */}</div>;
}
```

## Best Practices

### 1. Use TypeScript Interfaces

```tsx
// Define your database schema as TypeScript interfaces
interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Use them in hooks for type safety
const { data: users } = useQuery<DatabaseUser>({
  queryKey: ['users'],
  from: 'users',
  select: ['id', 'name', 'email']
});
```

### 2. Optimize with Proper Dependencies

```tsx
function UserPosts({ userId }: { userId: string }) {
  // Good: Only refetch when userId changes
  const { data: posts } = useQuery<Post>({
    queryKey: ['posts', 'user', userId],
    from: 'posts',
    filter: { author_id: userId },
    enabled: !!userId // Don't run if userId is empty
  });

  return <div>{/* Component content */}</div>;
}
```

### 3. Handle Loading States

```tsx
function LoadingExample() {
  const { data: users, isLoading, error } = useQuery<User>({
    queryKey: ['users'],
    from: 'users',
    select: '*'
  });

  if (isLoading) {
    return <div className="spinner">Loading users...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  if (!users?.length) {
    return <div className="empty">No users found</div>;
  }

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

### 4. Use Proper Key Management

```tsx
function PostList({ categoryId }: { categoryId: string }) {
  // The query will automatically refetch when categoryId changes
  const { data: posts } = useQuery<Post>({
    from: 'posts',
    filter: { category_id: categoryId },
    order: { column: 'created_at', ascending: false }
  });

  return (
    <div>
      {posts?.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

### 5. Implement Error Recovery

```tsx
function RobustComponent() {
  const { data, isLoading, error, refetch } = useQuery<User>({
    from: 'users',
    select: '*',
    retry: 3,
    retryDelay: 1000
  });

  if (error) {
    return (
      <div className="error-container">
        <p>Failed to load data: {error.message}</p>
        <button onClick={() => refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  return <div>{/* Normal component content */}</div>;
}
```

## Summary

PGRestify's React hooks provide:

- **Type Safety**: Full TypeScript support with database schema inference
- **Declarative API**: Clean, React-friendly hook interfaces
- **Optimistic Updates**: Built-in support for optimistic UI patterns
- **Real-time Integration**: Seamless WebSocket subscriptions
- **Error Handling**: Comprehensive error handling and recovery
- **Performance**: Built-in caching, deduplication, and optimization
- **Flexibility**: Support for both simple and complex query patterns

The hooks are designed to feel native to React while providing powerful database interaction capabilities through PostgREST.