# Server State Sync

PGRestify provides powerful server state synchronization capabilities that keep your React application in sync with your PostgreSQL database. This guide covers automatic synchronization, real-time updates, cache management, and conflict resolution.

## Overview

Server state synchronization in PGRestify ensures that your client-side state remains consistent with your database, handling:

- **Automatic Cache Updates**: Query results stay fresh automatically
- **Real-time Synchronization**: Live updates from database changes
- **Optimistic Updates**: Immediate UI feedback with rollback capabilities
- **Conflict Resolution**: Handling concurrent modifications gracefully
- **Background Synchronization**: Keep data fresh without user intervention

## Automatic Query Synchronization

### Basic Query Sync

PGRestify automatically manages query synchronization:

```typescript
import { useQuery, useQueryClient } from 'pgrestify/react';

function PostsList() {
  // Query automatically syncs with server state
  const { data: posts, isLoading, error } = useQuery(
    ['posts'], 
    (client) => client.from('posts').select('*').order('created_at', { ascending: false })
  );
  
  // Automatic background refetch based on stale time
  const postsWithRefresh = useQuery(
    ['posts-fresh'], 
    (client) => client.from('posts').select('*'),
    {
      staleTime: 30000, // Data is fresh for 30 seconds
      refetchInterval: 60000, // Refetch every minute
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when connection restored
    }
  );

  if (isLoading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {posts?.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>Updated: {new Date(post.updated_at).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
```

### Query Invalidation

Manually trigger synchronization when needed:

```typescript
import { useMutation, useQueryClient } from 'pgrestify/react';

function CreatePostForm() {
  const queryClient = useQueryClient();
  
  const createPost = useMutation({
    mutationFn: (postData) => 
      client.from('posts').insert(postData).select().single(),
    onSuccess: () => {
      // Invalidate and refetch posts query
      queryClient.invalidateQueries(['posts']);
      
      // Or invalidate specific patterns
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'posts'
      });
    }
  });

  const handleSubmit = (formData) => {
    createPost.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={createPost.isLoading}>
        Create Post
      </button>
    </form>
  );
}
```

### Smart Cache Updates

Update cache directly for immediate synchronization:

```typescript
function useOptimizedPostMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (postData) => 
      client.from('posts').insert(postData).select().single(),
    onMutate: async (newPost) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['posts']);
      
      // Snapshot current state
      const previousPosts = queryClient.getQueryData(['posts']);
      
      // Optimistically update cache
      queryClient.setQueryData(['posts'], (old: Post[] = []) => [
        { ...newPost, id: 'temp-' + Date.now(), created_at: new Date().toISOString() },
        ...old
      ]);
      
      return { previousPosts };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
    },
    onSettled: () => {
      // Refetch to ensure server sync
      queryClient.invalidateQueries(['posts']);
    }
  });
}
```

## Real-time Server State Sync

### PostgreSQL Change Events

Listen to database changes with real-time subscriptions:

```typescript
import { useQuery, useQueryClient } from 'pgrestify/react';
import { useRealtime } from 'pgrestify/react';

function useRealtimePosts() {
  const queryClient = useQueryClient();
  
  // Initial query
  const query = useQuery(['posts'], (client) => 
    client.from('posts').select('*').order('created_at', { ascending: false })
  );
  
  // Real-time subscription for live updates
  useRealtime('posts-changes', {
    event: '*', // Listen to all events: INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    queryClient.setQueryData(['posts'], (oldPosts: Post[] = []) => {
      switch (eventType) {
        case 'INSERT':
          // Add new post to beginning of list
          return [newRecord as Post, ...oldPosts];
          
        case 'UPDATE':
          // Update existing post
          return oldPosts.map(post => 
            post.id === newRecord.id ? { ...post, ...newRecord } as Post : post
          );
          
        case 'DELETE':
          // Remove deleted post
          return oldPosts.filter(post => post.id !== oldRecord.id);
          
        default:
          return oldPosts;
      }
    });
    
    // Also invalidate related queries
    queryClient.invalidateQueries(['post', newRecord?.id]);
    queryClient.invalidateQueries(['post-analytics']);
  });
  
  return query;
}

function RealtimePostsList() {
  const { data: posts, isLoading, error } = useRealtimePosts();
  
  if (isLoading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h2>Live Posts Feed</h2>
      {posts?.map(post => (
        <div key={post.id} className="post-item">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>Last updated: {new Date(post.updated_at).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
```

### Selective Real-time Updates

Listen to specific changes that matter to your UI:

```typescript
function useUserPostsRealtime(userId: string) {
  const queryClient = useQueryClient();
  
  // Listen only to posts by this user
  useRealtime('user-posts', {
    event: '*',
    schema: 'public', 
    table: 'posts',
    filter: `author_id=eq.${userId}` // Only this user's posts
  }, (payload) => {
    // Update user-specific posts cache
    queryClient.setQueryData(['user-posts', userId], (oldPosts: Post[] = []) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT':
          return [...oldPosts, newRecord as Post];
        case 'UPDATE':
          return oldPosts.map(post => 
            post.id === newRecord.id ? newRecord as Post : post
          );
        case 'DELETE':
          return oldPosts.filter(post => post.id !== oldRecord.id);
        default:
          return oldPosts;
      }
    });
    
    // Also update the general posts cache
    queryClient.invalidateQueries(['posts']);
  });
  
  return useQuery(
    ['user-posts', userId],
    (client) => client.from('posts').select('*').eq('author_id', userId)
  );
}
```

### Real-time Presence

Track who's currently online or viewing content:

```typescript
function useRealtimePresence(roomId: string) {
  const [presenceState, setPresenceState] = useState<Record<string, any>>({});
  const queryClient = useQueryClient();
  
  useRealtime('presence', {
    event: 'presence',
    schema: 'realtime',
    room: roomId
  }, (payload) => {
    const { event, payload: presencePayload } = payload;
    
    switch (event) {
      case 'join':
        setPresenceState(prev => ({
          ...prev,
          [presencePayload.user_id]: {
            ...presencePayload,
            online_at: new Date().toISOString()
          }
        }));
        break;
        
      case 'leave':
        setPresenceState(prev => {
          const { [presencePayload.user_id]: removed, ...rest } = prev;
          return rest;
        });
        break;
        
      case 'sync':
        setPresenceState(presencePayload.state || {});
        break;
    }
  });
  
  // Join the room on mount
  useEffect(() => {
    const channel = client.channel(roomId);
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setPresenceState(state);
    });
    
    channel.subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [roomId]);
  
  return {
    presenceState,
    onlineUsers: Object.values(presenceState),
    onlineCount: Object.keys(presenceState).length
  };
}

function CollaborativeEditor({ documentId }: { documentId: string }) {
  const { onlineUsers, onlineCount } = useRealtimePresence(`document-${documentId}`);
  
  return (
    <div>
      <div className="presence-indicator">
        {onlineCount} user{onlineCount !== 1 ? 's' : ''} online
        <div className="user-avatars">
          {onlineUsers.slice(0, 5).map(user => (
            <img 
              key={user.user_id} 
              src={user.avatar} 
              alt={user.name}
              title={user.name}
              className="avatar"
            />
          ))}
        </div>
      </div>
      
      {/* Editor component */}
    </div>
  );
}
```

## Background Synchronization

### Periodic Sync

Keep data fresh with background updates:

```typescript
function useBackgroundSync() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const syncInterval = setInterval(() => {
      // Sync critical data in background
      queryClient.refetchQueries({
        predicate: (query) => {
          const [key] = query.queryKey;
          return ['user-profile', 'notifications', 'settings'].includes(key as string);
        }
      });
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(syncInterval);
  }, [queryClient]);
  
  // Sync on app focus
  useEffect(() => {
    const handleFocus = () => {
      queryClient.refetchQueries({
        predicate: (query) => query.state.isStale
      });
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient]);
}

// Use in your app root
function App() {
  useBackgroundSync();
  
  return (
    <div>
      {/* Your app components */}
    </div>
  );
}
```

### Connection-aware Sync

Sync intelligently based on connection status:

```typescript
function useConnectionAwareSync() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      
      // Sync all stale queries when coming back online
      queryClient.refetchQueries({
        predicate: (query) => {
          const timeSinceLastFetch = Date.now() - (query.state.dataUpdatedAt || 0);
          return timeSinceLastFetch > 30000; // 30 seconds
        }
      });
      
      setLastSyncTime(new Date());
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);
  
  return { isOnline, lastSyncTime };
}

function SyncStatus() {
  const { isOnline, lastSyncTime } = useConnectionAwareSync();
  
  return (
    <div className={`sync-status ${isOnline ? 'online' : 'offline'}`}>
      <span className="status-dot"></span>
      {isOnline ? 'Connected' : 'Offline'}
      {lastSyncTime && (
        <small>Last sync: {lastSyncTime.toLocaleTimeString()}</small>
      )}
    </div>
  );
}
```

## Conflict Resolution

### Optimistic Update Conflicts

Handle conflicts when optimistic updates fail:

```typescript
function useConflictResolution<T>() {
  const queryClient = useQueryClient();
  
  const resolveConflict = useCallback((
    queryKey: string[],
    optimisticData: T,
    serverData: T,
    conflictResolver?: (optimistic: T, server: T) => T
  ) => {
    if (conflictResolver) {
      // Use custom conflict resolution
      const resolvedData = conflictResolver(optimisticData, serverData);
      queryClient.setQueryData(queryKey, resolvedData);
    } else {
      // Default: Server wins
      queryClient.setQueryData(queryKey, serverData);
    }
  }, [queryClient]);
  
  return { resolveConflict };
}

function usePostMutationWithConflictResolution() {
  const queryClient = useQueryClient();
  const { resolveConflict } = useConflictResolution<Post>();
  
  return useMutation({
    mutationFn: (postData: Partial<Post>) =>
      client.from('posts').update(postData).eq('id', postData.id).select().single(),
    onMutate: async (updatedPost) => {
      await queryClient.cancelQueries(['post', updatedPost.id]);
      
      const previousPost = queryClient.getQueryData(['post', updatedPost.id]);
      
      // Optimistic update
      queryClient.setQueryData(['post', updatedPost.id], (old: Post) => ({
        ...old,
        ...updatedPost,
        updated_at: new Date().toISOString()
      }));
      
      return { previousPost, optimisticData: updatedPost };
    },
    onError: (error, variables, context) => {
      // Check if it's a conflict error
      if (error.code === 'CONFLICT' && context?.previousPost) {
        // Get latest server data
        queryClient.refetchQueries(['post', variables.id]).then(() => {
          const serverData = queryClient.getQueryData(['post', variables.id]);
          
          // Resolve conflict (in this case, merge changes)
          resolveConflict(
            ['post', variables.id],
            context.optimisticData,
            serverData,
            (optimistic, server) => ({
              ...server,
              title: optimistic.title || server.title, // Keep optimistic title
              content: optimistic.content || server.content, // Keep optimistic content
              updated_at: server.updated_at // Use server timestamp
            })
          );
        });
      } else if (context?.previousPost) {
        // Regular rollback for other errors
        queryClient.setQueryData(['post', variables.id], context.previousPost);
      }
    }
  });
}
```

### Version-based Updates

Implement version-based conflict resolution:

```typescript
interface VersionedPost extends Post {
  version: number;
}

function useVersionedPostUpdate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postData: Partial<VersionedPost>) => {
      // Check current version before update
      const currentPost = await client
        .from('posts')
        .select('version')
        .eq('id', postData.id)
        .single();
      
      if (currentPost.version !== postData.version) {
        throw new Error('CONFLICT: Post has been updated by another user');
      }
      
      // Update with incremented version
      return client
        .from('posts')
        .update({ 
          ...postData, 
          version: currentPost.version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', postData.id)
        .eq('version', currentPost.version) // Ensure version still matches
        .select()
        .single();
    },
    onError: (error) => {
      if (error.message.includes('CONFLICT')) {
        // Show conflict resolution UI
        queryClient.setQueryData(['conflict-dialog'], {
          show: true,
          error: error.message
        });
      }
    }
  });
}
```

## Performance Optimization

### Selective Query Updates

Update only specific parts of cached data:

```typescript
function useSelectiveUpdate() {
  const queryClient = useQueryClient();
  
  const updatePostField = useCallback((postId: string, field: keyof Post, value: any) => {
    // Update specific field in posts list
    queryClient.setQueryData(['posts'], (oldPosts: Post[] = []) =>
      oldPosts.map(post => 
        post.id === postId ? { ...post, [field]: value } : post
      )
    );
    
    // Update specific field in individual post cache
    queryClient.setQueryData(['post', postId], (oldPost: Post) => 
      oldPost ? { ...oldPost, [field]: value } : oldPost
    );
    
    // Update any filtered queries that might contain this post
    queryClient.setQueriesData(
      { predicate: query => query.queryKey[0] === 'filtered-posts' },
      (oldData: Post[] = []) => 
        oldData.map(post => 
          post.id === postId ? { ...post, [field]: value } : post
        )
    );
  }, [queryClient]);
  
  return { updatePostField };
}
```

### Batched Updates

Batch multiple updates for better performance:

```typescript
function useBatchedUpdates() {
  const queryClient = useQueryClient();
  const updateBatchRef = useRef<Array<() => void>>([]);
  
  const batchUpdate = useCallback((updateFn: () => void) => {
    updateBatchRef.current.push(updateFn);
    
    // Debounce batch execution
    setTimeout(() => {
      queryClient.getQueryCache().batch(() => {
        updateBatchRef.current.forEach(fn => fn());
        updateBatchRef.current = [];
      });
    }, 0);
  }, [queryClient]);
  
  return { batchUpdate };
}

// Usage
function useRealtimeBatchUpdates() {
  const { batchUpdate } = useBatchedUpdates();
  
  useRealtime('posts-batch', {
    event: '*',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    // Batch real-time updates
    batchUpdate(() => {
      // Update logic here
    });
  });
}
```

## Error Recovery

### Automatic Retry with Backoff

Implement smart retry logic for failed sync operations:

```typescript
function useRetryableSync() {
  const queryClient = useQueryClient();
  
  const retryFailedQueries = useCallback(async () => {
    const queryCache = queryClient.getQueryCache();
    const failedQueries = queryCache
      .findAll({ predicate: query => query.state.status === 'error' });
    
    for (const query of failedQueries) {
      const retryCount = query.state.errorUpdateCount;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s
      
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: query.queryKey });
      }, delay);
    }
  }, [queryClient]);
  
  useEffect(() => {
    const interval = setInterval(retryFailedQueries, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [retryFailedQueries]);
  
  return { retryFailedQueries };
}
```

### Graceful Degradation

Handle sync failures gracefully:

```typescript
function useDegradedSync() {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'degraded' | 'offline'>('synced');
  const queryClient = useQueryClient();
  
  const handleSyncFailure = useCallback(() => {
    setSyncStatus('degraded');
    
    // Fallback to cached data
    queryClient.setDefaultOptions({
      queries: {
        staleTime: Infinity, // Use cached data indefinitely
        retry: false, // Stop retrying
      }
    });
    
    // Show degraded mode indicator
    queryClient.setQueryData(['app-status'], {
      syncStatus: 'degraded',
      message: 'Using cached data. Some information may be outdated.'
    });
  }, [queryClient]);
  
  return { syncStatus, handleSyncFailure };
}

function AppStatusIndicator() {
  const { data: appStatus } = useQuery(['app-status'], () => null);
  
  if (!appStatus || appStatus.syncStatus === 'synced') {
    return null;
  }
  
  return (
    <div className={`app-status-banner ${appStatus.syncStatus}`}>
      <span className="status-icon">⚠️</span>
      {appStatus.message}
    </div>
  );
}
```

## Best Practices

### Sync Strategy Selection

```typescript
// Good: Choose appropriate sync strategy based on data importance
const useUserProfile = () => useQuery(['user-profile'], fetchUser, {
  staleTime: 5 * 60 * 1000, // 5 minutes - user data changes infrequently
  refetchOnWindowFocus: true
});

const useNotifications = () => useQuery(['notifications'], fetchNotifications, {
  staleTime: 30 * 1000, // 30 seconds - notifications should be fresh
  refetchInterval: 60 * 1000 // Check every minute
});

const useChatMessages = () => {
  // Real-time for chat - needs immediate updates
  useRealtime('chat', { event: '*', table: 'messages' }, handleMessage);
  return useQuery(['messages'], fetchMessages);
};
```

### Memory Management

```typescript
// Good: Clean up subscriptions and cache
useEffect(() => {
  const cleanup = subscribeToRealtime();
  
  return () => {
    cleanup();
    queryClient.removeQueries(['temporary-data']);
  };
}, []);
```

### Sync Boundaries

```typescript
// Good: Define clear sync boundaries
function useBoundedSync(userId: string) {
  // Only sync data relevant to this user
  return useRealtime('user-data', {
    event: '*',
    table: 'user_posts',
    filter: `author_id=eq.${userId}`
  }, handleUserPostChange);
}
```

## Next Steps

- [Optimistic Updates](./optimistic.md) - Implement optimistic UI patterns
- [Infinite Queries](./infinite.md) - Handle large datasets with pagination
- [Real-time Integration](../advanced-features/realtime.md) - Deep dive into real-time features