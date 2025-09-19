# Optimistic Updates

Optimistic updates provide instant UI feedback by immediately updating the interface before server confirmation. PGRestify makes it easy to implement optimistic updates with automatic rollback on failure, conflict resolution, and sophisticated error handling.

## Overview

Optimistic updates enhance user experience by:

- **Immediate Feedback**: UI updates instantly without waiting for server response
- **Perceived Performance**: Applications feel faster and more responsive
- **Automatic Rollback**: Changes revert automatically if operations fail
- **Conflict Resolution**: Smart handling of concurrent modifications
- **Error Recovery**: Graceful degradation when optimistic updates fail

## Basic Optimistic Updates

### Simple Optimistic Mutation

```typescript
import { useMutation, useQueryClient } from '@webcoded/pgrestify/react';

function useOptimisticPostUpdate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updatedPost: Partial<Post>) =>
      client.from('posts').update(updatedPost).eq('id', updatedPost.id).select().single(),
    
    // The onMutate callback runs before the mutation
    onMutate: async (updatedPost) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries(['posts']);
      await queryClient.cancelQueries(['post', updatedPost.id]);
      
      // Snapshot the previous values
      const previousPosts = queryClient.getQueryData(['posts']);
      const previousPost = queryClient.getQueryData(['post', updatedPost.id]);
      
      // Optimistically update the cache
      queryClient.setQueryData(['posts'], (old: Post[] = []) =>
        old.map(post => 
          post.id === updatedPost.id 
            ? { ...post, ...updatedPost, updated_at: new Date().toISOString() }
            : post
        )
      );
      
      queryClient.setQueryData(['post', updatedPost.id], (old: Post) =>
        old ? { ...old, ...updatedPost, updated_at: new Date().toISOString() } : old
      );
      
      // Return context with previous values for potential rollback
      return { previousPosts, previousPost };
    },
    
    // If mutation fails, rollback the optimistic update
    onError: (err, updatedPost, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['post', updatedPost.id], context.previousPost);
      }
      
      // Show error notification
      showErrorNotification('Failed to update post. Changes have been reverted.');
    },
    
    // Always runs after success or error
    onSettled: (data, error, updatedPost) => {
      // Refetch to ensure cache consistency with server
      queryClient.invalidateQueries(['posts']);
      queryClient.invalidateQueries(['post', updatedPost.id]);
    }
  });
}

function PostEditor({ post }: { post: Post }) {
  const updatePost = useOptimisticPostUpdate();
  
  const handleSave = (formData: Partial<Post>) => {
    updatePost.mutate({
      id: post.id,
      ...formData
    });
  };
  
  return (
    <div>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSave({ title: 'Updated Title' });
      }}>
        <input defaultValue={post.title} />
        <button type="submit" disabled={updatePost.isLoading}>
          {updatePost.isLoading ? 'Saving...' : 'Save'}
        </button>
      </form>
      
      {updatePost.isError && (
        <div className="error">
          Update failed: {updatePost.error.message}
        </div>
      )}
    </div>
  );
}
```

### Optimistic List Operations

Handle adding, updating, and removing items optimistically:

```typescript
function useOptimisticPostOperations() {
  const queryClient = useQueryClient();
  
  // Optimistic create
  const createPost = useMutation({
    mutationFn: (newPost: Omit<Post, 'id' | 'created_at' | 'updated_at'>) =>
      client.from('posts').insert(newPost).select().single(),
    
    onMutate: async (newPost) => {
      await queryClient.cancelQueries(['posts']);
      
      const previousPosts = queryClient.getQueryData(['posts']);
      
      // Create optimistic post with temporary ID
      const optimisticPost: Post = {
        ...newPost,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _optimistic: true // Mark as optimistic
      };
      
      queryClient.setQueryData(['posts'], (old: Post[] = []) => [
        optimisticPost,
        ...old
      ]);
      
      return { previousPosts, optimisticPost };
    },
    
    onSuccess: (actualPost, variables, context) => {
      // Replace optimistic post with real post from server
      queryClient.setQueryData(['posts'], (old: Post[] = []) =>
        old.map(post => 
          post.id === context?.optimisticPost.id ? actualPost : post
        )
      );
    },
    
    onError: (err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
    }
  });
  
  // Optimistic delete
  const deletePost = useMutation({
    mutationFn: (postId: string) =>
      client.from('posts').delete().eq('id', postId),
    
    onMutate: async (postId) => {
      await queryClient.cancelQueries(['posts']);
      
      const previousPosts = queryClient.getQueryData(['posts']);
      
      // Remove post optimistically
      queryClient.setQueryData(['posts'], (old: Post[] = []) =>
        old.map(post => 
          post.id === postId 
            ? { ...post, _deleting: true } // Mark as being deleted
            : post
        )
      );
      
      // Set timeout to remove from UI after animation
      setTimeout(() => {
        queryClient.setQueryData(['posts'], (old: Post[] = []) =>
          old.filter(post => post.id !== postId)
        );
      }, 300); // Match CSS transition duration
      
      return { previousPosts };
    },
    
    onError: (err, postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
    }
  });
  
  return { createPost, deletePost };
}

function PostList() {
  const { data: posts = [] } = useQuery(['posts'], (client) =>
    client.from('posts').select('*').order('created_at', { ascending: false })
  );
  
  const { deletePost } = useOptimisticPostOperations();
  
  return (
    <div>
      {posts.map(post => (
        <div 
          key={post.id}
          className={`post-item ${post._deleting ? 'deleting' : ''} ${post._optimistic ? 'optimistic' : ''}`}
        >
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <button 
            onClick={() => deletePost.mutate(post.id)}
            disabled={deletePost.isLoading}
          >
            {post._deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Advanced Optimistic Patterns

### Batch Optimistic Updates

Handle multiple related updates optimistically:

```typescript
function useOptimisticBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (operations: Array<{
      type: 'create' | 'update' | 'delete';
      table: string;
      data: any;
      id?: string;
    }>) => {
      // Execute all operations in a transaction
      const results = [];
      for (const op of operations) {
        let result;
        switch (op.type) {
          case 'create':
            result = await client.from(op.table).insert(op.data).select().single();
            break;
          case 'update':
            result = await client.from(op.table).update(op.data).eq('id', op.id).select().single();
            break;
          case 'delete':
            result = await client.from(op.table).delete().eq('id', op.id);
            break;
        }
        results.push(result);
      }
      return results;
    },
    
    onMutate: async (operations) => {
      const snapshots = new Map();
      
      for (const op of operations) {
        const queryKey = [op.table];
        await queryClient.cancelQueries(queryKey);
        
        const previous = queryClient.getQueryData(queryKey);
        snapshots.set(queryKey, previous);
        
        // Apply optimistic update based on operation type
        queryClient.setQueryData(queryKey, (old: any[] = []) => {
          switch (op.type) {
            case 'create':
              return [{
                ...op.data,
                id: `temp-${Date.now()}-${Math.random()}`,
                created_at: new Date().toISOString(),
                _optimistic: true
              }, ...old];
              
            case 'update':
              return old.map(item =>
                item.id === op.id ? { ...item, ...op.data } : item
              );
              
            case 'delete':
              return old.filter(item => item.id !== op.id);
              
            default:
              return old;
          }
        });
      }
      
      return { snapshots };
    },
    
    onError: (err, operations, context) => {
      // Rollback all operations
      if (context?.snapshots) {
        for (const [queryKey, previous] of context.snapshots) {
          queryClient.setQueryData(queryKey, previous);
        }
      }
    },
    
    onSettled: (data, error, operations) => {
      // Refetch all affected queries
      const queryKeys = [...new Set(operations.map(op => [op.table]))];
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries(queryKey);
      });
    }
  });
}
```

### Smart Conflict Resolution

Handle optimistic update conflicts intelligently:

```typescript
function useOptimisticWithConflictResolution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updatedPost: Partial<Post>) => {
      try {
        return await client.from('posts')
          .update(updatedPost)
          .eq('id', updatedPost.id)
          .select()
          .single();
      } catch (error) {
        // Check if it's a conflict (version mismatch, concurrent update, etc.)
        if (error.code === 'PGRST116' || error.message.includes('conflict')) {
          // Fetch current server state
          const serverPost = await client.from('posts')
            .select('*')
            .eq('id', updatedPost.id)
            .single();
            
          throw new ConflictError('Post was modified by another user', {
            serverData: serverPost,
            clientData: updatedPost
          });
        }
        throw error;
      }
    },
    
    onMutate: async (updatedPost) => {
      await queryClient.cancelQueries(['post', updatedPost.id]);
      
      const previousPost = queryClient.getQueryData(['post', updatedPost.id]);
      
      queryClient.setQueryData(['post', updatedPost.id], (old: Post) => ({
        ...old,
        ...updatedPost,
        _optimistic: true,
        _version: (old._version || 0) + 1
      }));
      
      return { previousPost };
    },
    
    onError: (error: ConflictError, updatedPost, context) => {
      if (error instanceof ConflictError) {
        // Show conflict resolution dialog
        queryClient.setQueryData(['conflict-dialog'], {
          show: true,
          clientData: error.details.clientData,
          serverData: error.details.serverData,
          onResolve: (resolvedData: Post) => {
            // Apply resolved data
            queryClient.setQueryData(['post', updatedPost.id], resolvedData);
            queryClient.invalidateQueries(['posts']);
          }
        });
      } else {
        // Regular error - rollback
        if (context?.previousPost) {
          queryClient.setQueryData(['post', updatedPost.id], context.previousPost);
        }
      }
    }
  });
}

// Conflict resolution dialog component
function ConflictResolutionDialog() {
  const { data: conflict } = useQuery(['conflict-dialog'], () => null);
  
  if (!conflict?.show) return null;
  
  const handleResolve = (resolution: 'client' | 'server' | 'merge') => {
    let resolvedData;
    
    switch (resolution) {
      case 'client':
        resolvedData = { ...conflict.serverData, ...conflict.clientData };
        break;
      case 'server':
        resolvedData = conflict.serverData;
        break;
      case 'merge':
        // Implement smart merge logic
        resolvedData = mergeConflictedData(conflict.clientData, conflict.serverData);
        break;
    }
    
    conflict.onResolve(resolvedData);
    queryClient.setQueryData(['conflict-dialog'], { show: false });
  };
  
  return (
    <div className="conflict-dialog">
      <h3>Conflict Detected</h3>
      <p>This post was modified by another user. How would you like to resolve the conflict?</p>
      
      <div className="conflict-options">
        <button onClick={() => handleResolve('client')}>
          Keep My Changes
        </button>
        <button onClick={() => handleResolve('server')}>
          Use Server Version
        </button>
        <button onClick={() => handleResolve('merge')}>
          Merge Changes
        </button>
      </div>
      
      <div className="conflict-preview">
        <div className="version">
          <h4>Your Version</h4>
          <pre>{JSON.stringify(conflict.clientData, null, 2)}</pre>
        </div>
        <div className="version">
          <h4>Server Version</h4>
          <pre>{JSON.stringify(conflict.serverData, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

class ConflictError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'ConflictError';
  }
}
```

### Queue-based Optimistic Updates

Handle multiple pending updates with a queue:

```typescript
function useOptimisticQueue<T extends { id: string }>() {
  const queryClient = useQueryClient();
  const [pendingOperations, setPendingOperations] = useState<Array<{
    id: string;
    type: 'create' | 'update' | 'delete';
    data: T;
    timestamp: number;
    status: 'pending' | 'success' | 'error';
  }>>([]);
  
  const addOperation = useCallback((operation: {
    type: 'create' | 'update' | 'delete';
    data: T;
  }) => {
    const id = `op-${Date.now()}-${Math.random()}`;
    const queuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      status: 'pending' as const
    };
    
    setPendingOperations(prev => [...prev, queuedOperation]);
    
    // Apply optimistic update immediately
    applyOptimisticUpdate(queuedOperation);
    
    // Process operation
    processOperation(queuedOperation);
    
    return id;
  }, []);
  
  const applyOptimisticUpdate = useCallback((operation: any) => {
    const queryKey = ['posts']; // Adjust based on your data structure
    
    queryClient.setQueryData(queryKey, (old: T[] = []) => {
      switch (operation.type) {
        case 'create':
          return [{ ...operation.data, _optimistic: true }, ...old];
        case 'update':
          return old.map(item =>
            item.id === operation.data.id
              ? { ...item, ...operation.data, _optimistic: true }
              : item
          );
        case 'delete':
          return old.filter(item => item.id !== operation.data.id);
        default:
          return old;
      }
    });
  }, [queryClient]);
  
  const processOperation = useCallback(async (operation: any) => {
    try {
      let result;
      
      switch (operation.type) {
        case 'create':
          result = await client.from('posts').insert(operation.data).select().single();
          break;
        case 'update':
          result = await client.from('posts')
            .update(operation.data)
            .eq('id', operation.data.id)
            .select()
            .single();
          break;
        case 'delete':
          result = await client.from('posts').delete().eq('id', operation.data.id);
          break;
      }
      
      // Mark operation as successful
      setPendingOperations(prev =>
        prev.map(op =>
          op.id === operation.id ? { ...op, status: 'success' } : op
        )
      );
      
      // Update cache with server result
      if (result) {
        const queryKey = ['posts'];
        queryClient.setQueryData(queryKey, (old: T[] = []) => {
          if (operation.type === 'create' || operation.type === 'update') {
            return old.map(item =>
              item._optimistic && item.id === operation.data.id
                ? { ...result, _optimistic: false }
                : item
            );
          }
          return old;
        });
      }
      
    } catch (error) {
      // Mark operation as failed
      setPendingOperations(prev =>
        prev.map(op =>
          op.id === operation.id ? { ...op, status: 'error' } : op
        )
      );
      
      // Rollback optimistic update
      rollbackOperation(operation);
    }
  }, [queryClient]);
  
  const rollbackOperation = useCallback((operation: any) => {
    const queryKey = ['posts'];
    
    queryClient.setQueryData(queryKey, (old: T[] = []) => {
      switch (operation.type) {
        case 'create':
          return old.filter(item => !item._optimistic || item.id !== operation.data.id);
        case 'update':
          // This would require storing previous state - simplified for example
          return old;
        case 'delete':
          // Restore deleted item - would need previous state
          return old;
        default:
          return old;
      }
    });
  }, [queryClient]);
  
  return {
    addOperation,
    pendingOperations: pendingOperations.filter(op => op.status === 'pending'),
    failedOperations: pendingOperations.filter(op => op.status === 'error'),
    retryFailedOperations: () => {
      pendingOperations
        .filter(op => op.status === 'error')
        .forEach(op => processOperation(op));
    }
  };
}

// Usage
function PostWithQueue() {
  const { addOperation, pendingOperations, failedOperations } = useOptimisticQueue<Post>();
  
  const handleCreatePost = (postData: Omit<Post, 'id'>) => {
    addOperation({
      type: 'create',
      data: postData as Post // Add temporary ID
    });
  };
  
  return (
    <div>
      {pendingOperations.length > 0 && (
        <div className="pending-operations">
          {pendingOperations.length} operation(s) pending...
        </div>
      )}
      
      {failedOperations.length > 0 && (
        <div className="failed-operations">
          {failedOperations.length} operation(s) failed
          <button onClick={() => retryFailedOperations()}>Retry</button>
        </div>
      )}
      
      <button onClick={() => handleCreatePost({ title: 'New Post', content: 'Content' })}>
        Create Post
      </button>
    </div>
  );
}
```

## Real-time Optimistic Updates

### Optimistic Updates with Real-time Sync

Combine optimistic updates with real-time synchronization:

```typescript
function useOptimisticWithRealtime() {
  const queryClient = useQueryClient();
  const [optimisticOperations, setOptimisticOperations] = useState(new Set<string>());
  
  // Real-time subscription to handle conflicts
  useRealtime('posts-realtime', {
    event: '*',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Check if this change conflicts with any optimistic updates
    const hasOptimisticUpdate = optimisticOperations.has(newRecord?.id || oldRecord?.id);
    
    if (hasOptimisticUpdate) {
      // Conflict detected - resolve optimistically
      resolveOptimisticConflict(eventType, newRecord, oldRecord);
    } else {
      // Normal real-time update
      applyRealtimeUpdate(eventType, newRecord, oldRecord);
    }
  });
  
  const createOptimisticUpdate = useMutation({
    mutationFn: (postData: Partial<Post>) =>
      client.from('posts').insert(postData).select().single(),
    
    onMutate: async (postData) => {
      const tempId = `temp-${Date.now()}`;
      setOptimisticOperations(prev => new Set([...prev, tempId]));
      
      await queryClient.cancelQueries(['posts']);
      const previousPosts = queryClient.getQueryData(['posts']);
      
      queryClient.setQueryData(['posts'], (old: Post[] = []) => [
        { ...postData, id: tempId, _optimistic: true } as Post,
        ...old
      ]);
      
      return { previousPosts, tempId };
    },
    
    onSuccess: (result, variables, context) => {
      // Remove from optimistic operations
      if (context?.tempId) {
        setOptimisticOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(context.tempId);
          return newSet;
        });
      }
      
      // Replace optimistic post with real one
      queryClient.setQueryData(['posts'], (old: Post[] = []) =>
        old.map(post =>
          post.id === context?.tempId ? result : post
        )
      );
    },
    
    onError: (error, variables, context) => {
      // Remove from optimistic operations and rollback
      if (context?.tempId) {
        setOptimisticOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(context.tempId);
          return newSet;
        });
      }
      
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
    }
  });
  
  const resolveOptimisticConflict = (eventType: string, newRecord: any, oldRecord: any) => {
    // Implement conflict resolution logic
    if (eventType === 'UPDATE') {
      // Server update conflicts with optimistic update
      queryClient.setQueryData(['posts'], (old: Post[] = []) =>
        old.map(post => {
          if (post.id === newRecord.id && post._optimistic) {
            // Merge server changes with optimistic changes
            return {
              ...newRecord,
              ...post, // Keep optimistic changes
              _conflicted: true // Mark as conflicted
            };
          }
          return post.id === newRecord.id ? newRecord : post;
        })
      );
    }
  };
  
  const applyRealtimeUpdate = (eventType: string, newRecord: any, oldRecord: any) => {
    queryClient.setQueryData(['posts'], (old: Post[] = []) => {
      switch (eventType) {
        case 'INSERT':
          return [newRecord as Post, ...old];
        case 'UPDATE':
          return old.map(post => 
            post.id === newRecord.id ? newRecord as Post : post
          );
        case 'DELETE':
          return old.filter(post => post.id !== oldRecord.id);
        default:
          return old;
      }
    });
  };
  
  return { createOptimisticUpdate };
}
```

## Performance Optimization

### Debounced Optimistic Updates

Prevent excessive optimistic updates for rapid changes:

```typescript
function useDebouncedOptimisticUpdate(delay: number = 300) {
  const queryClient = useQueryClient();
  const debouncedUpdates = useRef(new Map<string, NodeJS.Timeout>());
  
  const debouncedUpdate = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Post> }) =>
      client.from('posts').update(data.updates).eq('id', data.id).select().single(),
    
    onMutate: async ({ id, updates }) => {
      // Clear any existing debounced update for this item
      if (debouncedUpdates.current.has(id)) {
        clearTimeout(debouncedUpdates.current.get(id));
      }
      
      // Apply optimistic update immediately
      queryClient.setQueryData(['post', id], (old: Post) =>
        old ? { ...old, ...updates, _optimistic: true } : old
      );
      
      // Debounce the actual server update
      const timeoutId = setTimeout(() => {
        // The actual mutation will run after the debounce delay
        debouncedUpdates.current.delete(id);
      }, delay);
      
      debouncedUpdates.current.set(id, timeoutId);
    }
  });
  
  return debouncedUpdate;
}

// Usage in a form
function OptimisticForm({ post }: { post: Post }) {
  const debouncedUpdate = useDebouncedOptimisticUpdate(500);
  
  const handleFieldChange = (field: keyof Post, value: any) => {
    debouncedUpdate.mutate({
      id: post.id,
      updates: { [field]: value }
    });
  };
  
  return (
    <form>
      <input
        value={post.title}
        onChange={(e) => handleFieldChange('title', e.target.value)}
        className={post._optimistic ? 'optimistic' : ''}
      />
      <textarea
        value={post.content}
        onChange={(e) => handleFieldChange('content', e.target.value)}
        className={post._optimistic ? 'optimistic' : ''}
      />
    </form>
  );
}
```

## Error Handling and Recovery

### Retry Mechanisms

Implement sophisticated retry logic for failed optimistic updates:

```typescript
function useResilientOptimisticUpdate() {
  const queryClient = useQueryClient();
  const [retryQueue, setRetryQueue] = useState<Array<{
    id: string;
    attempt: number;
    maxAttempts: number;
    data: any;
    timestamp: number;
  }>>([]);
  
  const resilientUpdate = useMutation({
    mutationFn: (data: any) => client.from('posts').update(data.updates).eq('id', data.id).select().single(),
    
    onMutate: async (data) => {
      // Standard optimistic update
      await queryClient.cancelQueries(['posts']);
      const previousPosts = queryClient.getQueryData(['posts']);
      
      queryClient.setQueryData(['posts'], (old: Post[] = []) =>
        old.map(post =>
          post.id === data.id
            ? { ...post, ...data.updates, _optimistic: true }
            : post
        )
      );
      
      return { previousPosts };
    },
    
    onError: (error, data, context) => {
      // Add to retry queue with exponential backoff
      const retryItem = {
        id: `retry-${Date.now()}`,
        attempt: 1,
        maxAttempts: 3,
        data,
        timestamp: Date.now()
      };
      
      setRetryQueue(prev => [...prev, retryItem]);
      
      // Schedule retry
      scheduleRetry(retryItem);
    }
  });
  
  const scheduleRetry = useCallback((retryItem: any) => {
    const delay = Math.min(1000 * Math.pow(2, retryItem.attempt - 1), 10000); // Max 10s
    
    setTimeout(() => {
      if (retryItem.attempt < retryItem.maxAttempts) {
        resilientUpdate.mutate(retryItem.data);
        
        setRetryQueue(prev =>
          prev.map(item =>
            item.id === retryItem.id
              ? { ...item, attempt: item.attempt + 1 }
              : item
          )
        );
      } else {
        // Max attempts reached - remove from queue and rollback
        setRetryQueue(prev => prev.filter(item => item.id !== retryItem.id));
        
        // Show persistent error notification
        showPersistentError(`Failed to update after ${retryItem.maxAttempts} attempts`);
      }
    }, delay);
  }, [resilientUpdate]);
  
  return { resilientUpdate, retryQueue };
}
```

## Best Practices

### Visual Feedback

Provide clear visual feedback for optimistic states:

```css
.optimistic {
  opacity: 0.7;
  background: #f0f8ff;
  border-left: 3px solid #007bff;
}

.optimistic::after {
  content: "Saving...";
  font-size: 0.8em;
  color: #007bff;
  margin-left: 8px;
}

.deleting {
  opacity: 0.5;
  transform: scale(0.95);
  transition: all 0.3s ease;
}

.conflicted {
  border-left: 3px solid #ffc107;
  background: #fff8e1;
}

.error {
  border-left: 3px solid #dc3545;
  background: #ffeaea;
}
```

### State Management

Keep optimistic state separate and well-organized:

```typescript
interface OptimisticState {
  operations: Map<string, {
    type: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    status: 'pending' | 'success' | 'error';
  }>;
  conflicts: Map<string, {
    clientData: any;
    serverData: any;
    resolution?: 'client' | 'server' | 'merge';
  }>;
}

// Good: Centralized optimistic state management
function useOptimisticStateManager() {
  const [state, setState] = useState<OptimisticState>({
    operations: new Map(),
    conflicts: new Map()
  });
  
  const addOperation = (id: string, operation: any) => {
    setState(prev => ({
      ...prev,
      operations: new Map(prev.operations).set(id, operation)
    }));
  };
  
  return { state, addOperation };
}
```

### Error Boundaries

Implement proper error boundaries for optimistic updates:

```typescript
class OptimisticErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Optimistic update error:', error, errorInfo);
    
    // Rollback any optimistic updates
    this.props.onError?.(error);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h3>Something went wrong with the update</h3>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Next Steps

- [Infinite Queries](./infinite.md) - Handle paginated data optimistically  
- [Real-time Integration](../advanced-features/realtime.md) - Combine with real-time updates