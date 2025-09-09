# Advanced Queries

PGRestify's TanStack Query integration provides advanced querying capabilities including column selection with aliases, complex relationships, pagination patterns, and performance optimization techniques for sophisticated PostgREST applications.

## Overview

Advanced query features include:

- **Column Selection with Aliases**: Select specific columns and rename them
- **Relationship Loading**: Deep relationship queries with PostgREST joins
- **Complex Filtering**: Advanced PostgREST operators and conditions
- **Pagination Patterns**: Infinite scroll and cursor-based pagination
- **Query Composition**: Combining multiple query strategies
- **Performance Optimization**: Selective loading and query deduplication

## Column Selection and Aliases

### Basic Column Selection

Select only the columns you need to reduce payload size:

```tsx
import { useQuery } from '@tanstack/react-query';
import { createPostgRESTQueries } from 'pgrestify/tanstack-query';

const userQueries = createPostgRESTQueries<User>(client, 'users');

function UserSummaryList() {
  const { data: users } = useQuery({
    ...userQueries.listWithOptions({
      selectColumns: ['id', 'name', 'email', 'active']  // Only essential fields
    })
  });

  return (
    <div>
      {users?.data?.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>{user.email} - {user.active ? 'Active' : 'Inactive'}</p>
        </div>
      ))}
    </div>
  );
}
```

### Column Aliases

Rename columns to match your frontend data structures:

```tsx
function UserProfileCard({ userId }: { userId: string }) {
  const { data: user } = useQuery({
    ...userQueries.detailWithOptions(userId, {
      selectColumns: [
        'id',
        'first_name AS firstName',
        'last_name AS lastName',
        'email_address AS email',
        'phone_number AS phone',
        'created_at AS joinDate',
        'last_login AS lastActive'
      ]
    })
  });

  // Now user.data has renamed properties
  return (
    <div className="profile-card">
      <h2>{user?.data?.firstName} {user?.data?.lastName}</h2>
      <p>Email: {user?.data?.email}</p>
      <p>Phone: {user?.data?.phone}</p>
      <small>
        Joined: {new Date(user?.data?.joinDate).toLocaleDateString()}
        Last Active: {new Date(user?.data?.lastActive).toLocaleDateString()}
      </small>
    </div>
  );
}
```

### Computed Columns

Include computed fields in your selection:

```tsx
function UserAnalytics() {
  const { data: users } = useQuery({
    ...userQueries.listWithOptions({
      selectColumns: [
        'id',
        'name',
        'email',
        'created_at',
        // Computed columns
        'EXTRACT(year FROM created_at) AS joinYear',
        'CASE WHEN last_login > NOW() - INTERVAL \'30 days\' THEN true ELSE false END AS recentlyActive',
        'LENGTH(bio) AS bioLength'
      ]
    })
  });

  return (
    <div>
      {users?.data?.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>Joined: {user.joinYear}</p>
          <p>Recently Active: {user.recentlyActive ? 'Yes' : 'No'}</p>
          <p>Bio Length: {user.bioLength || 0} characters</p>
        </div>
      ))}
    </div>
  );
}
```

## Relationship Loading

### One-to-Many Relationships

Load related records using PostgREST's embedded resource syntax:

```tsx
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author?: User;
  comments?: Comment[];
  tags?: Tag[];
}

function PostWithRelationships({ postId }: { postId: string }) {
  const { data: post } = useQuery({
    ...postQueries.detailWithOptions(postId, {
      selectColumns: [
        'id',
        'title',
        'content',
        'created_at AS publishedDate',
        // One-to-one: Author information
        'author:users!author_id(id, name, email, avatar_url)',
        // One-to-many: Comments with author info
        'comments:comments!post_id(id, content, created_at, author:users!author_id(name))',
        // Many-to-many: Tags through junction table
        'post_tags:post_tags!post_id(tag:tags!tag_id(id, name, color))'
      ]
    })
  });

  return (
    <article>
      <h1>{post?.data?.title}</h1>
      
      {/* Author info */}
      <div className="author">
        <img src={post?.data?.author?.avatar_url} alt={post?.data?.author?.name} />
        <span>By {post?.data?.author?.name}</span>
      </div>
      
      <div>{post?.data?.content}</div>
      
      {/* Tags */}
      <div className="tags">
        {post?.data?.post_tags?.map(pt => (
          <span key={pt.tag.id} style={{ color: pt.tag.color }}>
            #{pt.tag.name}
          </span>
        ))}
      </div>
      
      {/* Comments */}
      <div className="comments">
        <h3>Comments ({post?.data?.comments?.length || 0})</h3>
        {post?.data?.comments?.map(comment => (
          <div key={comment.id}>
            <strong>{comment.author.name}:</strong>
            <p>{comment.content}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
```

### Nested Relationships

Load deeply nested relationships:

```tsx
function UserWithNestedData({ userId }: { userId: string }) {
  const { data: user } = useQuery({
    ...userQueries.detailWithOptions(userId, {
      selectColumns: [
        'id',
        'name',
        'email',
        // User's posts with their comments and tags
        `posts:posts!author_id(
          id,
          title,
          created_at,
          comments:comments!post_id(
            id,
            content,
            author:users!author_id(name)
          ),
          post_tags:post_tags!post_id(
            tag:tags!tag_id(name, color)
          )
        )`
      ]
    })
  });

  return (
    <div>
      <h1>{user?.data?.name}'s Posts</h1>
      {user?.data?.posts?.map(post => (
        <div key={post.id} className="post">
          <h2>{post.title}</h2>
          <p>{post.comments?.length || 0} comments</p>
          <div className="tags">
            {post.post_tags?.map(pt => (
              <span key={pt.tag.name} style={{ color: pt.tag.color }}>
                #{pt.tag.name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Conditional Relationship Loading

Load relationships based on conditions:

```tsx
function ConditionalRelationships() {
  const [includeComments, setIncludeComments] = useState(false);
  
  const { data: posts } = useQuery({
    ...postQueries.listWithOptions({
      selectColumns: [
        'id',
        'title',
        'content',
        'author:users!author_id(name)',
        // Conditionally include comments
        ...(includeComments ? [
          'comments:comments!post_id(id, content, created_at)'
        ] : [])
      ],
      filters: { published: true },
      // Different cache key based on inclusion
      keyExtension: includeComments ? ['with-comments'] : ['no-comments']
    })
  });

  return (
    <div>
      <label>
        <input 
          type="checkbox" 
          checked={includeComments}
          onChange={(e) => setIncludeComments(e.target.checked)}
        />
        Include Comments
      </label>
      
      {posts?.data?.map(post => (
        <div key={post.id}>
          <h3>{post.title} by {post.author.name}</h3>
          {includeComments && (
            <p>{post.comments?.length || 0} comments</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Complex Filtering

### Advanced Filter Combinations

Use enhanced queries with complex filtering logic:

```tsx
function AdvancedUserFilter() {
  const [filters, setFilters] = useState({
    active: true,
    minJoinDate: '2023-01-01',
    roles: ['admin', 'editor']
  });

  const { data: users } = useQuery({
    ...userQueries.customWithOptions({
      selectColumns: [
        'id', 'name', 'email', 'role', 'created_at', 'last_login'
      ],
      filters: { active: filters.active }  // Base filters
    }, 
    // Additional complex filtering
    (query) => {
      let filteredQuery = query;
      
      // Date range filtering
      if (filters.minJoinDate) {
        filteredQuery = filteredQuery.gte('created_at', filters.minJoinDate);
      }
      
      // Array filtering (IN clause)
      if (filters.roles.length > 0) {
        filteredQuery = filteredQuery.in('role', filters.roles);
      }
      
      return filteredQuery.order('last_login', { ascending: false });
    },
    ['advanced-filter', JSON.stringify(filters)]
    )
  });

  return (
    <div>
      <div className="filters">
        <label>
          <input 
            type="checkbox"
            checked={filters.active}
            onChange={(e) => setFilters(f => ({ ...f, active: e.target.checked }))}
          />
          Active Only
        </label>
        
        <input 
          type="date"
          value={filters.minJoinDate}
          onChange={(e) => setFilters(f => ({ ...f, minJoinDate: e.target.value }))}
        />
        
        <select 
          multiple
          value={filters.roles}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            roles: Array.from(e.target.selectedOptions, opt => opt.value)
          }))}
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="user">User</option>
        </select>
      </div>

      <div>
        Found {users?.data?.length || 0} users
        {users?.data?.map(user => (
          <div key={user.id}>
            {user.name} ({user.role}) - Last login: {user.last_login}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Text Search with Ranking

Implement full-text search with relevance ranking:

```tsx
function TextSearchWithRanking() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: results, isFetching } = useQuery({
    ...postQueries.customWithOptions({
      selectColumns: [
        'id',
        'title',
        'content',
        'author:users!author_id(name)',
        // Full-text search ranking
        'ts_rank(to_tsvector(title || \' \' || content), plainto_tsquery($1)) AS rank'
      ]
    },
    (query) => {
      if (!searchQuery) return query.limit(0); // No results if no search
      
      return query
        // Full-text search condition
        .textSearch('title,content', searchQuery)
        // Order by relevance
        .order('rank', { ascending: false })
        .limit(20);
    },
    ['text-search', searchQuery]
    ),
    enabled: searchQuery.length > 2  // Only search with 3+ characters
  });

  return (
    <div>
      <input 
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search posts..."
      />
      
      {isFetching && <div>Searching...</div>}
      
      {results?.data?.map(post => (
        <div key={post.id} className="search-result">
          <h3>{post.title}</h3>
          <p>By {post.author.name} - Relevance: {post.rank.toFixed(3)}</p>
          <p>{post.content.substring(0, 150)}...</p>
        </div>
      ))}
    </div>
  );
}
```

## Pagination Patterns

### Infinite Scroll

Implement infinite scrolling with cursor-based pagination:

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['posts', 'infinite'],
    queryFn: async ({ pageParam = null }) => {
      let query = client.from('posts')
        .select('id, title, content, created_at, author:users!author_id(name)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Cursor-based pagination
      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }
      
      const result = await query.execute();
      if (result.error) throw new Error(result.error.message);
      
      return result.data || [];
    },
    getNextPageParam: (lastPage) => {
      // Use the last item's created_at as cursor for next page
      if (lastPage.length < 10) return undefined; // No more pages
      return lastPage[lastPage.length - 1].created_at;
    },
    staleTime: 5 * 60 * 1000
  });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.map(post => (
            <article key={post.id}>
              <h3>{post.title}</h3>
              <p>By {post.author.name}</p>
              <div>{post.content}</div>
            </article>
          ))}
        </div>
      ))}
      
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : 
         hasNextPage ? 'Load More' : 'No more posts'}
      </button>
    </div>
  );
}
```

### Virtualized Pagination

Implement pagination with virtual scrolling:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualizedUserList() {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const { data: users } = useQuery({
    ...userQueries.listWithOptions({
      selectColumns: ['id', 'name', 'email', 'avatar_url'],
      orderBy: [{ column: 'name', ascending: true }],
      limit: 1000  // Load many items
    })
  });

  const virtualizer = useVirtualizer({
    count: users?.data?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {users?.data?.[virtualItem.index] && (
              <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                <img 
                  src={users.data[virtualItem.index].avatar_url} 
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 10 }}
                />
                <strong>{users.data[virtualItem.index].name}</strong>
                <br />
                <small>{users.data[virtualItem.index].email}</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Query Composition

### Dependent Queries

Create queries that depend on other query results:

```tsx
function UserPostsAndStats({ userId }: { userId: string }) {
  // First query: Get user details
  const { data: user } = useQuery({
    ...userQueries.detail(userId)
  });

  // Second query: Get user's posts (depends on user existing)
  const { data: posts } = useQuery({
    ...postQueries.listWithOptions({
      selectColumns: ['id', 'title', 'views', 'likes', 'created_at'],
      filters: { author_id: userId },
      orderBy: [{ column: 'created_at', ascending: false }]
    }),
    enabled: !!user?.data  // Only run if user query succeeded
  });

  // Third query: Get aggregated stats (depends on posts)
  const { data: stats } = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: async () => {
      if (!posts?.data) return null;
      
      const totalViews = posts.data.reduce((sum, post) => sum + post.views, 0);
      const totalLikes = posts.data.reduce((sum, post) => sum + post.likes, 0);
      const avgViewsPerPost = posts.data.length > 0 ? totalViews / posts.data.length : 0;
      
      return {
        totalPosts: posts.data.length,
        totalViews,
        totalLikes,
        avgViewsPerPost
      };
    },
    enabled: !!posts?.data  // Only run if posts query succeeded
  });

  return (
    <div>
      <h1>{user?.data?.name}'s Dashboard</h1>
      
      {stats && (
        <div className="stats">
          <div>Total Posts: {stats.totalPosts}</div>
          <div>Total Views: {stats.totalViews}</div>
          <div>Total Likes: {stats.totalLikes}</div>
          <div>Avg Views per Post: {stats.avgViewsPerPost.toFixed(1)}</div>
        </div>
      )}
      
      <div className="posts">
        {posts?.data?.map(post => (
          <div key={post.id}>
            <h3>{post.title}</h3>
            <p>{post.views} views, {post.likes} likes</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Parallel Queries

Execute multiple independent queries in parallel:

```tsx
function DashboardWithParallelQueries() {
  // All queries run in parallel
  const { data: users } = useQuery({
    ...userQueries.listWithOptions({
      selectColumns: ['id', 'name'],
      limit: 5
    })
  });

  const { data: posts } = useQuery({
    ...postQueries.listWithOptions({
      selectColumns: ['id', 'title', 'created_at'],
      orderBy: [{ column: 'created_at', ascending: false }],
      limit: 5
    })
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Could be an RPC call or aggregation
      const [userCount, postCount] = await Promise.all([
        client.from('users').select('*', { count: 'exact', head: true }).execute(),
        client.from('posts').select('*', { count: 'exact', head: true }).execute()
      ]);
      
      return {
        totalUsers: userCount.count || 0,
        totalPosts: postCount.count || 0
      };
    }
  });

  return (
    <div className="dashboard">
      <div className="stats-cards">
        <div>Total Users: {stats?.totalUsers || '...'}</div>
        <div>Total Posts: {stats?.totalPosts || '...'}</div>
      </div>
      
      <div className="recent-activity">
        <div>
          <h3>Recent Users</h3>
          {users?.data?.map(user => (
            <div key={user.id}>{user.name}</div>
          ))}
        </div>
        
        <div>
          <h3>Recent Posts</h3>
          {posts?.data?.map(post => (
            <div key={post.id}>{post.title}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Performance Optimization

### Query Deduplication

Leverage TanStack Query's automatic deduplication:

```tsx
// Both components will share the same query
function UserComponent1({ userId }: { userId: string }) {
  const { data } = useQuery({ ...userQueries.detail(userId) });
  return <div>Component 1: {data?.data?.name}</div>;
}

function UserComponent2({ userId }: { userId: string }) {
  const { data } = useQuery({ ...userQueries.detail(userId) });  // Deduped!
  return <div>Component 2: {data?.data?.email}</div>;
}
```

### Selective Re-rendering

Use select to transform data and prevent unnecessary re-renders:

```tsx
function OptimizedUserList() {
  // Only re-render when names change, not when other user properties change
  const userNames = useQuery({
    ...userQueries.list(),
    select: (data) => data.data?.map(user => user.name) || []
  });

  // Only re-render when user count changes
  const userCount = useQuery({
    ...userQueries.list(),
    select: (data) => data.data?.length || 0
  });

  return (
    <div>
      <p>Total users: {userCount.data}</p>
      <ul>
        {userNames.data?.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Background Data Updates

Keep data fresh with background updates:

```tsx
function RealTimeUserList() {
  const { data: users } = useQuery({
    ...userQueries.list(),
    refetchInterval: 30 * 1000,        // Refetch every 30 seconds
    refetchIntervalInBackground: true,  // Continue when tab not focused
    refetchOnWindowFocus: true,         // Refetch when user returns
    refetchOnReconnect: true            // Refetch when connection restored
  });

  return (
    <div>
      <h2>Live User List</h2>
      {users?.data?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

## Summary

PGRestify's advanced query capabilities provide powerful tools for building sophisticated data fetching patterns. From column selection and relationship loading to complex filtering and pagination, these features enable you to build performant, responsive applications that efficiently work with PostgREST APIs.