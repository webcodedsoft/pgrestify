# Infinite Queries

Infinite queries enable seamless pagination and infinite scrolling by automatically fetching additional data as users scroll or request more content. PGRestify provides powerful infinite query capabilities with intelligent caching, optimistic updates, and performance optimization.

## Overview

Infinite queries in PGRestify handle:

- **Automatic Pagination**: Fetch more data as needed
- **Infinite Scrolling**: Load content continuously as users scroll  
- **Bidirectional Loading**: Load both older and newer content
- **Intelligent Caching**: Efficiently cache and manage large datasets
- **Optimistic Updates**: Update infinite lists optimistically
- **Performance Optimization**: Virtual scrolling and smart loading

## Basic Infinite Query

### Simple Infinite Scrolling

```typescript
import { useInfiniteQuery } from 'pgrestify/react';

function InfinitePostsList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam = 0 }) =>
      client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1),
    getNextPageParam: (lastPage, allPages) => {
      // Return next page number if there are more results
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single array
  const posts = data?.pages.flat() ?? [];

  if (isLoading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>{new Date(post.created_at).toLocaleDateString()}</small>
        </div>
      ))}
      
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="load-more-btn"
        >
          {isFetchingNextPage ? 'Loading more...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Automatic Infinite Scrolling

Add automatic loading when scrolling near the bottom:

```typescript
import { useInfiniteQuery } from 'pgrestify/react';
import { useIntersection } from './hooks/useIntersection'; // Custom hook for intersection observer

function AutoInfinitePostsList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam = 0 }) =>
      client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length : undefined,
    initialPageParam: 0,
  });

  // Intersection observer hook for automatic loading
  const { ref: loadMoreRef } = useIntersection({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    threshold: 0.1, // Trigger when 10% of the element is visible
  });

  const posts = data?.pages.flat() ?? [];

  if (isLoading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="infinite-list">
      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>{new Date(post.created_at).toLocaleDateString()}</small>
        </div>
      ))}
      
      {/* Loading trigger element */}
      <div ref={loadMoreRef} className="load-trigger">
        {isFetchingNextPage && (
          <div className="loading-spinner">Loading more posts...</div>
        )}
        {!hasNextPage && posts.length > 0 && (
          <div className="end-message">No more posts to load</div>
        )}
      </div>
    </div>
  );
}

// Custom intersection observer hook
function useIntersection({ 
  onIntersect, 
  threshold = 0.1,
  rootMargin = '0px'
}: {
  onIntersect: () => void;
  threshold?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          onIntersect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [onIntersect, threshold, rootMargin]);

  return { ref };
}
```

## Advanced Infinite Query Patterns

### Bidirectional Infinite Scrolling

Load both newer and older content:

```typescript
function BidirectionalInfiniteList() {
  const {
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['posts', 'bidirectional'],
    queryFn: ({ pageParam }) => {
      const { cursor, direction } = pageParam || { cursor: null, direction: 'newer' };
      
      let query = client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (cursor) {
        if (direction === 'older') {
          query = query.lt('created_at', cursor);
        } else {
          query = query.gt('created_at', cursor);
        }
      }

      return query;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 20) return undefined;
      const lastPost = lastPage[lastPage.length - 1];
      return { cursor: lastPost.created_at, direction: 'older' };
    },
    getPreviousPageParam: (firstPage) => {
      if (firstPage.length === 0) return undefined;
      const firstPost = firstPage[0];
      return { cursor: firstPost.created_at, direction: 'newer' };
    },
    initialPageParam: { cursor: null, direction: 'newer' },
  });

  const posts = data?.pages.flat() ?? [];

  return (
    <div className="bidirectional-list">
      {/* Load newer content */}
      {hasPreviousPage && (
        <button
          onClick={() => fetchPreviousPage()}
          disabled={isFetchingPreviousPage}
          className="load-newer-btn"
        >
          {isFetchingPreviousPage ? 'Loading newer...' : 'Load Newer Posts'}
        </button>
      )}

      {/* Posts list */}
      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>{new Date(post.created_at).toLocaleString()}</small>
        </div>
      ))}

      {/* Load older content */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="load-older-btn"
        >
          {isFetchingNextPage ? 'Loading older...' : 'Load Older Posts'}
        </button>
      )}
    </div>
  );
}
```

### Filtered Infinite Queries

Implement infinite scrolling with dynamic filters:

```typescript
function FilteredInfiniteList() {
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    author: '',
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['posts', 'filtered', filters],
    queryFn: ({ pageParam = 0 }) => {
      let query = client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1);

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.search) {
        query = query.textSearch('title,content', filters.search);
      }
      
      if (filters.author) {
        query = query.eq('author_id', filters.author);
      }

      return query;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length : undefined,
    initialPageParam: 0,
    // Refetch when filters change
    enabled: true,
  });

  const posts = data?.pages.flat() ?? [];

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="filtered-infinite-list">
      {/* Filter Controls */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search posts..."
          value={filters.search}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
        />
        
        <select
          value={filters.category}
          onChange={(e) => handleFilterChange({ category: e.target.value })}
        >
          <option value="">All Categories</option>
          <option value="tech">Technology</option>
          <option value="design">Design</option>
          <option value="business">Business</option>
        </select>
        
        <button onClick={() => setFilters({ category: '', search: '', author: '' })}>
          Clear Filters
        </button>
      </div>

      {/* Results */}
      <div className="results-info">
        {posts.length > 0 ? (
          <p>{posts.length} posts found</p>
        ) : (
          !isLoading && <p>No posts match your filters</p>
        )}
      </div>

      {/* Posts List */}
      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <div className="post-meta">
            <span className="category">{post.category}</span>
            <span className="date">{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      ))}

      {/* Load More */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="load-more-btn"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Virtual Scrolling for Performance

Implement virtual scrolling for large datasets:

```typescript
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

function VirtualInfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts', 'virtual'],
    queryFn: ({ pageParam = 0 }) =>
      client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 50, (pageParam + 1) * 50 - 1), // Larger page size for virtual scrolling
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 50 ? allPages.length : undefined,
    initialPageParam: 0,
  });

  const posts = data?.pages.flat() ?? [];
  
  // Check if an item is loaded
  const isItemLoaded = (index: number) => !!posts[index];
  
  // Total number of items (including unloaded ones)
  const itemCount = hasNextPage ? posts.length + 1 : posts.length;

  // Load more items if needed
  const loadMoreItems = isFetchingNextPage ? () => {} : fetchNextPage;

  // Render individual post item
  const PostItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const post = posts[index];
    
    if (!post) {
      return (
        <div style={style} className="loading-item">
          Loading...
        </div>
      );
    }

    return (
      <div style={style} className="virtual-post-item">
        <h3>{post.title}</h3>
        <p>{post.content}</p>
        <small>{new Date(post.created_at).toLocaleDateString()}</small>
      </div>
    );
  };

  return (
    <div className="virtual-infinite-list">
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreItems}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={ref}
            height={600} // Fixed height for virtual scrolling
            itemCount={itemCount}
            itemSize={120} // Height of each item
            onItemsRendered={onItemsRendered}
            className="virtual-list"
          >
            {PostItem}
          </List>
        )}
      </InfiniteLoader>
    </div>
  );
}
```

## Optimistic Updates with Infinite Queries

### Adding Items to Infinite Lists

```typescript
function useOptimisticInfiniteUpdates() {
  const queryClient = useQueryClient();

  const addPostOptimistically = useMutation({
    mutationFn: (newPost: Omit<Post, 'id' | 'created_at' | 'updated_at'>) =>
      client.from('posts').insert(newPost).select().single(),
    
    onMutate: async (newPost) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['posts']);
      
      // Get previous data
      const previousData = queryClient.getQueryData(['posts']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['posts'], (old: any) => {
        if (!old) return old;
        
        const optimisticPost = {
          ...newPost,
          id: `temp-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _optimistic: true,
        };

        // Add to the first page
        const newPages = [...old.pages];
        newPages[0] = [optimisticPost, ...newPages[0]];
        
        return {
          ...old,
          pages: newPages,
        };
      });
      
      return { previousData };
    },
    
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['posts'], context.previousData);
      }
    },
    
    onSuccess: (actualPost, variables, context) => {
      // Replace optimistic post with real post
      queryClient.setQueryData(['posts'], (old: any) => {
        if (!old) return old;
        
        const newPages = old.pages.map((page: Post[]) =>
          page.map((post) =>
            post._optimistic ? actualPost : post
          )
        );
        
        return {
          ...old,
          pages: newPages,
        };
      });
    },
  });

  const updatePostOptimistically = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Post> }) =>
      client.from('posts').update(data.updates).eq('id', data.id).select().single(),
    
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries(['posts']);
      
      const previousData = queryClient.getQueryData(['posts']);
      
      // Update post in infinite data structure
      queryClient.setQueryData(['posts'], (old: any) => {
        if (!old) return old;
        
        const newPages = old.pages.map((page: Post[]) =>
          page.map((post) =>
            post.id === id 
              ? { ...post, ...updates, _optimistic: true }
              : post
          )
        );
        
        return {
          ...old,
          pages: newPages,
        };
      });
      
      return { previousData };
    },
    
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['posts'], context.previousData);
      }
    },
  });

  const deletePostOptimistically = useMutation({
    mutationFn: (postId: string) =>
      client.from('posts').delete().eq('id', postId),
    
    onMutate: async (postId) => {
      await queryClient.cancelQueries(['posts']);
      
      const previousData = queryClient.getQueryData(['posts']);
      
      // Remove post from infinite data structure
      queryClient.setQueryData(['posts'], (old: any) => {
        if (!old) return old;
        
        const newPages = old.pages.map((page: Post[]) =>
          page.filter((post) => post.id !== postId)
        );
        
        return {
          ...old,
          pages: newPages,
        };
      });
      
      return { previousData };
    },
    
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['posts'], context.previousData);
      }
    },
  });

  return {
    addPostOptimistically,
    updatePostOptimistically,
    deletePostOptimistically,
  };
}
```

## Real-time Integration

### Real-time Updates in Infinite Lists

Sync infinite lists with real-time database changes:

```typescript
function useRealtimeInfiniteList() {
  const queryClient = useQueryClient();

  // Set up infinite query
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['posts', 'realtime'],
    queryFn: ({ pageParam = 0 }) =>
      client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length : undefined,
    initialPageParam: 0,
  });

  // Real-time subscription
  useRealtime('posts-infinite', {
    event: '*',
    schema: 'public',
    table: 'posts',
  }, (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    queryClient.setQueryData(['posts', 'realtime'], (old: any) => {
      if (!old) return old;
      
      switch (eventType) {
        case 'INSERT':
          // Add new post to the first page
          const newPages = [...old.pages];
          newPages[0] = [newRecord as Post, ...newPages[0]];
          
          return {
            ...old,
            pages: newPages,
          };
          
        case 'UPDATE':
          // Update existing post across all pages
          return {
            ...old,
            pages: old.pages.map((page: Post[]) =>
              page.map((post) =>
                post.id === newRecord.id ? newRecord as Post : post
              )
            ),
          };
          
        case 'DELETE':
          // Remove post from all pages
          return {
            ...old,
            pages: old.pages.map((page: Post[]) =>
              page.filter((post) => post.id !== oldRecord.id)
            ),
          };
          
        default:
          return old;
      }
    });
  });

  return infiniteQuery;
}

function RealtimeInfinitePostsList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useRealtimeInfiniteList();

  const posts = data?.pages.flat() ?? [];

  return (
    <div className="realtime-infinite-list">
      <div className="header">
        <h2>Live Posts Feed</h2>
        <div className="live-indicator">
          <span className="live-dot"></span>
          Live
        </div>
      </div>
      
      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>{new Date(post.created_at).toLocaleString()}</small>
        </div>
      ))}
      
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## Performance Optimization

### Intelligent Prefetching

Prefetch next pages based on user behavior:

```typescript
function useIntelligentPrefetch() {
  const queryClient = useQueryClient();
  const scrollPositionRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['posts', 'prefetch'],
    queryFn: ({ pageParam = 0 }) =>
      client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length : undefined,
    initialPageParam: 0,
  });

  // Monitor scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentPosition = window.scrollY;
      const velocity = currentPosition - scrollPositionRef.current;
      scrollVelocityRef.current = velocity;
      scrollPositionRef.current = currentPosition;
      
      // Prefetch if scrolling fast and near bottom
      const { scrollHeight, clientHeight } = document.documentElement;
      const scrollPercentage = currentPosition / (scrollHeight - clientHeight);
      
      if (velocity > 0 && scrollPercentage > 0.7 && infiniteQuery.hasNextPage) {
        // Prefetch next page
        infiniteQuery.fetchNextPage();
      }
    };

    const debouncedScroll = debounce(handleScroll, 100);
    window.addEventListener('scroll', debouncedScroll);
    
    return () => window.removeEventListener('scroll', debouncedScroll);
  }, [infiniteQuery]);

  return infiniteQuery;
}

// Utility function for debouncing
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

### Memory Management

Implement memory-efficient infinite scrolling:

```typescript
function useMemoryEfficientInfinite(maxPages: number = 10) {
  return useInfiniteQuery({
    queryKey: ['posts', 'memory-efficient'],
    queryFn: ({ pageParam = 0 }) =>
      client
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1),
    getNextPageParam: (lastPage, allPages) => {
      // Limit the number of pages to prevent memory issues
      if (allPages.length >= maxPages) {
        return undefined;
      }
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    initialPageParam: 0,
    // Limit cache size
    cacheTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Component with memory cleanup
function MemoryEfficientInfiniteList() {
  const queryClient = useQueryClient();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMemoryEfficientInfinite(10);

  const posts = data?.pages.flat() ?? [];

  // Clean up old pages when component unmounts
  useEffect(() => {
    return () => {
      queryClient.removeQueries(['posts', 'memory-efficient']);
    };
  }, [queryClient]);

  // Implement virtual viewport to render only visible items
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const itemHeight = 120; // Average item height
      const containerHeight = window.innerHeight;
      
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.min(
        start + Math.ceil(containerHeight / itemHeight) + 5, // 5 items buffer
        posts.length
      );
      
      setVisibleRange({ start, end });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [posts.length]);

  return (
    <div className="memory-efficient-list">
      <div style={{ height: posts.length * 120 }}> {/* Total height */}
        <div 
          style={{ 
            transform: `translateY(${visibleRange.start * 120}px)`,
            position: 'relative'
          }}
        >
          {posts.slice(visibleRange.start, visibleRange.end).map((post, index) => (
            <div key={post.id} className="post-item" style={{ height: 120 }}>
              <h3>{post.title}</h3>
              <p>{post.content}</p>
              <small>{new Date(post.created_at).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      </div>
      
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## Error Handling and Recovery

### Robust Error Handling

Implement comprehensive error handling for infinite queries:

```typescript
function useResilientInfiniteQuery() {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  return useInfiniteQuery({
    queryKey: ['posts', 'resilient'],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const result = await client
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(pageParam * 20, (pageParam + 1) * 20 - 1);
        
        // Reset retry count on success
        setRetryCount(0);
        return result;
      } catch (error) {
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          throw error;
        }
        
        // After max retries, return empty array to prevent breaking
        console.error('Failed to load page after retries:', error);
        return [];
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      // Don't try to load more if last page was empty due to error
      if (lastPage.length === 0) return undefined;
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    initialPageParam: 0,
    retry: (failureCount, error) => {
      // Custom retry logic
      if (failureCount >= maxRetries) return false;
      
      // Don't retry on certain errors
      if (error.code === '401' || error.code === '403') return false;
      
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

function ResilientInfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useResilientInfiniteQuery();

  const posts = data?.pages.flat() ?? [];

  if (isError) {
    return (
      <div className="error-state">
        <h3>Failed to load posts</h3>
        <p>{error.message}</p>
        <button onClick={() => refetch()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="resilient-infinite-list">
      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      ))}
      
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## Best Practices

### Query Key Management

```typescript
// Good: Structured query keys for infinite queries
const getInfinitePostsKey = (filters?: any) => ['posts', 'infinite', filters].filter(Boolean);

// Usage
const queryKey = getInfinitePostsKey({ category: 'tech' });
```

### Page Size Optimization

```typescript
// Good: Adjust page size based on content and performance
const getOptimalPageSize = (itemType: 'text' | 'image' | 'video') => {
  switch (itemType) {
    case 'text': return 50;      // Text posts can load more per page
    case 'image': return 20;     // Images need moderate page size
    case 'video': return 10;     // Videos require smaller pages
    default: return 20;
  }
};
```

### Loading States

```typescript
// Good: Comprehensive loading state management
function LoadingStates({ isLoading, isFetchingNextPage, hasNextPage, posts }: any) {
  if (isLoading) return <div>Loading initial posts...</div>;
  
  if (posts.length === 0) return <div>No posts found</div>;
  
  return (
    <>
      {/* Content */}
      {isFetchingNextPage && <div>Loading more posts...</div>}
      {!hasNextPage && <div>You've reached the end!</div>}
    </>
  );
}
```

## Next Steps

- [Real-time Integration](../advanced-features/realtime.md) - Real-time updates with infinite queries
- [State Management](./state.md) - Managing complex state with infinite data