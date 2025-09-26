# React Integration Examples

Comprehensive guide to integrating PGRestify with React applications using both PostgREST syntax and repository patterns.

## Installation & Setup

```bash
npm install @webcoded/pgrestify
```

### Basic Setup

```tsx
import React from 'react';
import { createClient } from '@webcoded/pgrestify';
import { PGRestifyProvider } from '@webcoded/pgrestify/react';

// Create PGRestify client
const client = createClient({
  url: 'http://localhost:3000',
  auth: {
    persistSession: true
  }
});

// App component with PGRestify provider
function App() {
  return (
    <PGRestifyProvider client={client}>
      <UserManagementApp />
    </PGRestifyProvider>
  );
}

export default App;
```

### Type Definitions

```tsx
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  role: 'user' | 'admin' | 'moderator';
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_id: number;
  published: boolean;
  created_at: string;
  author?: User;
}
```

## Data Fetching with Hooks

### Using Built-in React Hooks

PGRestify provides powerful React hooks for data fetching with automatic caching, isLoading states, and error handling.

::: code-group

```tsx [PostgREST Syntax]
import { useQuery } from '@webcoded/pgrestify/react';

function UserList() {
  const { 
    data: users, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['users'],
    queryFn: async ({ client }) => {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true })
        .execute();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {users?.map(user => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```tsx [Repository Pattern]
import { useRepository } from '@webcoded/pgrestify/react';

function UserList() {
  const userRepo = useRepository<User>('users');
  
  const { 
    data: users, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: async () => {
      return await userRepo
        .createQueryBuilder()
        .where('active = :active', { active: true })
        .orderBy('name', 'ASC')
        .getMany();
    }
  });

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {users?.map(user => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

:::

## Advanced Features: Relations, Aliases, and Multiple Sorting

### React Hooks with Relations Array Syntax

```tsx
import { useQuery } from '@webcoded/pgrestify/react';

interface UserWithProfile extends User {
  profile?: {
    bio: string;
    avatar_url: string;
    website?: string;
  };
  posts?: Post[];
}

// Using relations array syntax with aliases and multiple sorting
function UserProfileDashboard() {
  const { data: users, isLoading, error } = useQuery<UserWithProfile>({
    queryKey: ['users-with-profiles'],
    queryFn: async ({ client }) => {
      const { data, error } = await client
        .from('users')
        .select([
          'id AS user_id',
          'name AS full_name',
          'email AS contact_email',
          'created_at AS join_date',
          'profile.bio AS user_bio',
          'profile.avatar_url AS profile_image',
          'profile.website AS personal_website',
          'posts.title AS post_titles',
          'posts.created_at AS post_dates'
        ])
        .relations(['profile', 'posts'])
        .eq('active', true)
        .order('profile.created_at', { ascending: false })  // Latest profiles first
        .order('name', { ascending: true })                 // Alphabetical names
        .order('posts.created_at', { ascending: false })    // Latest posts first
        .execute();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div>Loading user profiles...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="user-dashboard">
      {users?.map(user => (
        <div key={user.user_id} className="user-card">
          <div className="profile-header">
            <img src={user.profile_image} alt="Profile" />
            <div className="user-info">
              <h3>{user.full_name}</h3>
              <p>{user.contact_email}</p>
              <p>{user.user_bio}</p>
              {user.personal_website && (
                <a href={user.personal_website} target="_blank" rel="noopener">
                  {user.personal_website}
                </a>
              )}
            </div>
          </div>
          <div className="posts-preview">
            <h4>Recent Posts</h4>
            {user.post_titles?.slice(0, 3).map((title, index) => (
              <div key={index} className="post-item">
                <span>{title}</span>
                <time>{new Date(user.post_dates[index]).toLocaleDateString()}</time>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// E-commerce product catalog with complex relations
function ProductCatalogWithRelations() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-catalog'],
    queryFn: async ({ client }) => {
      const { data, error } = await client
        .from('products')
        .select([
          'id AS product_id',
          'name AS product_name',
          'price AS current_price',
          'description AS product_description',
          'category.name AS category_name',
          'category.slug AS category_path',
          'brand.name AS brand_name',
          'brand.logo_url AS brand_logo',
          'reviews.rating AS avg_rating',
          'reviews.count AS review_count',
          'inventory.stock AS available_stock'
        ])
        .relations(['category', 'brand', 'reviews', 'inventory'])
        .eq('active', true)
        .gte('inventory.stock', 1)  // Only in-stock items
        .order('category.sort_order', { ascending: true })     // Category priority
        .order('reviews.rating', { ascending: false })        // Best rated first
        .order('brand.popularity', { ascending: false })      // Popular brands
        .order('price', { ascending: true })                  // Cheapest first
        .limit(50)
        .execute();
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="product-catalog">
      {products?.map(product => (
        <div key={product.product_id} className="product-card">
          <div className="product-header">
            <img src={product.brand_logo} alt={product.brand_name} className="brand-logo" />
            <span className="category-badge">{product.category_name}</span>
          </div>
          
          <div className="product-details">
            <h3>{product.product_name}</h3>
            <p className="description">{product.product_description}</p>
            
            <div className="pricing-info">
              <span className="price">${product.current_price}</span>
              <div className="rating">
                ⭐ {product.avg_rating} ({product.review_count} reviews)
              </div>
            </div>
            
            <div className="inventory-info">
              <span className="stock">{product.available_stock} in stock</span>
              <span className="brand">by {product.brand_name}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Blog platform with authors and categories
function BlogPostsWithAuthors() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async ({ client }) => {
      const { data, error } = await client
        .from('posts')
        .select([
          'id AS post_id',
          'title AS post_title',
          'content AS post_content',
          'excerpt AS post_excerpt',
          'published_at AS publication_date',
          'author.name AS author_name',
          'author.bio AS author_bio',
          'author.avatar_url AS author_avatar',
          'category.name AS category_name',
          'category.color AS category_color',
          'tags.name AS tag_names',
          'comments.count AS comment_count',
          'likes.count AS like_count'
        ])
        .relations(['author', 'category', 'tags', 'comments', 'likes'])
        .eq('published', true)
        .eq('author.active', true)
        .order('category.priority', { ascending: true })       // Featured categories first
        .order('published_at', { ascending: false })          // Latest posts first
        .order('likes.count', { ascending: false })           // Popular posts
        .order('author.reputation', { ascending: false })     // Reputable authors
        .limit(30)
        .execute();
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="blog-posts">
      {posts?.map(post => (
        <article key={post.post_id} className="blog-post">
          <header className="post-header">
            <div 
              className="category-badge" 
              style={{ backgroundColor: post.category_color }}
            >
              {post.category_name}
            </div>
            <h2>{post.post_title}</h2>
            <p className="excerpt">{post.post_excerpt}</p>
          </header>
          
          <div className="author-section">
            <img src={post.author_avatar} alt={post.author_name} />
            <div className="author-info">
              <h4>{post.author_name}</h4>
              <p>{post.author_bio}</p>
            </div>
          </div>
          
          <div className="post-meta">
            <time>{new Date(post.publication_date).toLocaleDateString()}</time>
            <div className="engagement">
              <span>❤️ {post.like_count}</span>
              <span>💬 {post.comment_count}</span>
            </div>
          </div>
          
          <div className="tags">
            {post.tag_names?.map((tag, index) => (
              <span key={index} className="tag">{tag}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

```

### Repository Pattern with Advanced Features

```tsx
import { useRepository } from '@webcoded/pgrestify/react';

// Team management dashboard using repository pattern
function TeamManagementDashboard() {
  const userRepo = useRepository<User>('users');
  
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      return await userRepo
        .createQueryBuilder()
        .select([
          'id AS employee_id',
          'first_name AS firstName',
          'last_name AS lastName', 
          'email AS workEmail',
          'department.name AS dept_name',
          'manager.first_name AS manager_firstName',
          'manager.last_name AS manager_lastName',
          'role.name AS job_title',
          'role.level AS experience_level'
        ])
        .relations(['department', 'manager', 'role'])
        .where('active = :active', { active: true })
        .orderBy('department.name', 'ASC')             // Group by department
        .addOrderBy('manager.last_name', 'ASC')        // Then by manager
        .addOrderBy('role.level', 'DESC')              // Senior roles first
        .addOrderBy('last_name', 'ASC')                // Alphabetical by surname
        .addOrderBy('first_name', 'ASC')               // Then by first name
        .getMany();
    }
  });

  return (
    <div className="team-directory">
      <h2>Team Directory</h2>
      {teamMembers?.map(member => (
        <div key={member.employee_id} className="team-member">
          <div className="member-info">
            <h3>{member.firstName} {member.lastName}</h3>
            <p className="title">{member.job_title}</p>
            <p className="email">{member.workEmail}</p>
          </div>
          <div className="org-info">
            <p className="department">{member.dept_name}</p>
            <p className="manager">
              Reports to: {member.manager_firstName} {member.manager_lastName}
            </p>
            <span className="level">Level {member.experience_level}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Analytics dashboard with complex aggregations
function AnalyticsDashboardWithRelations() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async ({ client }) => {
      const { data, error } = await client
        .from('analytics')
        .select([
          'date AS report_date',
          'metrics.page_views AS daily_page_views',
          'metrics.unique_visitors AS daily_visitors',
          'metrics.bounce_rate AS visitor_bounce_rate',
          'content.posts_published AS new_posts',
          'content.comments_count AS total_comments',
          'sales.revenue AS daily_revenue',
          'sales.orders AS daily_orders',
          'sales.conversion_rate AS sales_conversion'
        ])
        .relations(['metrics', 'content', 'sales'])
        .gte('date', '2024-01-01')
        .lte('date', '2024-12-31')
        .order('date', { ascending: false })               // Latest first
        .order('metrics.page_views', { ascending: false }) // High traffic days
        .order('sales.revenue', { ascending: false })      // High revenue days
        .limit(90)  // Last 90 days
        .execute();
        
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div>Loading analytics...</div>;

  return (
    <div className="analytics-dashboard">
      <div className="metrics-grid">
        {analytics?.map(day => (
          <div key={day.report_date} className="day-card">
            <h4>{new Date(day.report_date).toLocaleDateString()}</h4>
            
            <div className="traffic-metrics">
              <div className="metric">
                <span className="value">{day.daily_page_views}</span>
                <span className="label">Page Views</span>
              </div>
              <div className="metric">
                <span className="value">{day.daily_visitors}</span>
                <span className="label">Visitors</span>
              </div>
              <div className="metric">
                <span className="value">{day.visitor_bounce_rate}%</span>
                <span className="label">Bounce Rate</span>
              </div>
            </div>
            
            <div className="content-metrics">
              <div className="metric">
                <span className="value">{day.new_posts}</span>
                <span className="label">New Posts</span>
              </div>
              <div className="metric">
                <span className="value">{day.total_comments}</span>
                <span className="label">Comments</span>
              </div>
            </div>
            
            <div className="sales-metrics">
              <div className="metric">
                <span className="value">${day.daily_revenue}</span>
                <span className="label">Revenue</span>
              </div>
              <div className="metric">
                <span className="value">{day.daily_orders}</span>
                <span className="label">Orders</span>
              </div>
              <div className="metric">
                <span className="value">{day.sales_conversion}%</span>
                <span className="label">Conversion</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Mutation Hook

```tsx
import { useMutation } from '@webcoded/pgrestify/react';

function CreateUserForm() {
  const { 
    mutate: createUser, 
    isLoading, 
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
      {isLoading && <div>Submitting...</div>}
      {error && <div>Error: {error.message}</div>}
      <button type="submit">Create User</button>
    </form>
  );
}
```

## Pagination Hook

```tsx
import { usePaginatedQuery } from '@webcoded/pgrestify/react';

function PaginatedUserList() {
  const { 
    data: users, 
    isLoading, 
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
import { useRealtimeSubscription } from '@webcoded/pgrestify/react';

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
    isLoading, 
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
    isLoading, 
    error,
    retry 
  } = useQuery<User>('users', query => 
    query.select('*')
  );

  if (error) {
    return (
      <div>
        <p>Error isLoading users: {error.message}</p>
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
import { useAuth } from '@webcoded/pgrestify/react';

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
- Handle isLoading and error states
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