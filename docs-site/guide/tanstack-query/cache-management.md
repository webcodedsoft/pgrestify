# Cache Management

PGRestify's TanStack Query integration provides advanced cache management utilities that help you optimize data freshness, minimize unnecessary network requests, and provide smooth user experiences. These utilities handle cache invalidation, updates, and optimization strategies specifically designed for PostgREST APIs.

## Overview

Cache management in PGRestify includes:

- **Query Key Management**: Consistent, structured cache keys for predictable cache behavior
- **Cache Invalidation**: Targeted invalidation strategies for different data types
- **Optimistic Updates**: Update cache immediately for better user experience
- **Cache Synchronization**: Keep related data in sync across components
- **Performance Optimization**: Reduce unnecessary network requests through smart caching

## Query Key Structure

### Consistent Key Patterns

PGRestify uses a hierarchical cache key structure:

```tsx
import { createQueryKeys } from '@webcoded/pgrestify/tanstack-query';

const keys = createQueryKeys();

// Key hierarchy:
keys.all()                                    // ['pgrestify']
keys.tables()                                 // ['pgrestify', 'tables']
keys.table('users')                          // ['pgrestify', 'tables', 'users']
keys.tableData('users', { active: true })   // ['pgrestify', 'tables', 'users', 'data', { active: true }]
keys.tableItem('users', 'user-id')          // ['pgrestify', 'tables', 'users', 'item', 'user-id']
keys.rpc('get_stats', { period: 'month' })  // ['pgrestify', 'rpc', 'get_stats', { period: 'month' }]
```

### Custom Base Keys

Create query keys with custom base keys for multi-tenant applications:

```tsx
// Tenant-specific cache keys
const tenantKeys = createQueryKeys('tenant-123');

// Generated keys:
tenantKeys.table('users')  // ['tenant-123', 'tables', 'users']
tenantKeys.all()           // ['tenant-123']
```

## Cache Invalidation

### Table-Level Invalidation

Use invalidation helpers for targeted cache clearing:

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { createInvalidationHelpers } from '@webcoded/pgrestify/tanstack-query';

function UserManagement() {
  const queryClient = useQueryClient();
  const userInvalidation = createInvalidationHelpers('users');
  
  const refreshAllUserData = () => {
    // Invalidate all user-related queries
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateTable() 
    });
  };
  
  const refreshUserList = () => {
    // Invalidate only user list queries
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateList() 
    });
  };
  
  const refreshSpecificUser = (userId: string) => {
    // Invalidate specific user detail queries
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateItem(userId) 
    });
  };
  
  const refreshEverything = () => {
    // Nuclear option: invalidate all PGRestify queries
    queryClient.invalidateQueries({ 
      queryKey: userInvalidation.invalidateAll() 
    });
  };

  return (
    <div>
      <button onClick={refreshAllUserData}>Refresh User Data</button>
      <button onClick={refreshUserList}>Refresh User List</button>
      <button onClick={refreshEverything}>Refresh All Data</button>
    </div>
  );
}
```

### Mutation-Triggered Invalidation

Automatically invalidate related caches after mutations:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPostgRESTMutations, createInvalidationHelpers } from '@webcoded/pgrestify/tanstack-query';

function UserForm() {
  const queryClient = useQueryClient();
  const userMutations = createPostgRESTMutations<User>(client, 'users');
  const userInvalidation = createInvalidationHelpers('users');
  
  const createUser = useMutation({
    ...userMutations.insert({
      onSuccess: (data) => {
        // Invalidate user list to show new user
        queryClient.invalidateQueries({ 
          queryKey: userInvalidation.invalidateList() 
        });
        
        // Invalidate related data that might be affected
        queryClient.invalidateQueries({ 
          queryKey: createQueryKeys().table('user_stats') 
        });
        
        console.log('User created:', data.data);
      }
    })
  });
  
  const updateUser = useMutation({
    ...userMutations.update({
      onSuccess: (data, variables) => {
        // Invalidate specific user detail
        queryClient.invalidateQueries({ 
          queryKey: userInvalidation.invalidateItem(variables.where.id) 
        });
        
        // Invalidate user lists that might contain this user
        queryClient.invalidateQueries({ 
          queryKey: userInvalidation.invalidateList() 
        });
      }
    })
  });

  const deleteUser = useMutation({
    ...userMutations.delete({
      onSuccess: (_, variables) => {
        // Remove from all user-related caches
        queryClient.invalidateQueries({ 
          queryKey: userInvalidation.invalidateTable() 
        });
        
        // Also remove from detail cache
        queryClient.removeQueries({ 
          queryKey: userInvalidation.invalidateItem(variables.id) 
        });
      }
    })
  });

  // ... form implementation
}
```

## Optimistic Updates

### Cache Helpers for Optimistic Updates

Use cache helpers to update the cache immediately for better UX:

```tsx
import { createCacheHelpers } from '@webcoded/pgrestify/tanstack-query';

function UserList() {
  const queryClient = useQueryClient();
  const cacheHelpers = createCacheHelpers<User>('users');
  
  const createUser = useMutation({
    ...userMutations.insert({
      // Optimistic update: add user to cache immediately
      onMutate: async (newUser) => {
        await queryClient.cancelQueries({ queryKey: ['pgrestify', 'tables', 'users'] });
        
        // Add optimistic user to cache
        const optimisticUser = {
          ...newUser,
          id: `temp-${Date.now()}`, // Temporary ID
          created_at: new Date().toISOString()
        };
        
        cacheHelpers.addToListCache(queryClient, optimisticUser);
        
        return { optimisticUser };
      },
      
      onError: (err, newUser, context) => {
        // Remove optimistic update on error
        if (context?.optimisticUser) {
          cacheHelpers.removeFromListCache(queryClient, context.optimisticUser.id);
        }
      },
      
      onSuccess: (data, variables, context) => {
        // Replace optimistic update with real data
        if (context?.optimisticUser) {
          cacheHelpers.removeFromListCache(queryClient, context.optimisticUser.id);
          cacheHelpers.addToListCache(queryClient, data.data[0]);
        }
      }
    })
  });
  
  const updateUser = useMutation({
    ...userMutations.update({
      onMutate: async ({ where, values }) => {
        await queryClient.cancelQueries({ 
          queryKey: ['pgrestify', 'tables', 'users', 'item', where.id] 
        });
        
        // Optimistically update user in cache
        cacheHelpers.updateInListCache(queryClient, where.id, values);
        
        return { previousUser: values };
      },
      
      onError: (err, { where, values }, context) => {
        // Revert optimistic update on error
        if (context?.previousUser) {
          cacheHelpers.updateInListCache(queryClient, where.id, context.previousUser);
        }
      }
    })
  });

  // ... component implementation
}
```

### Advanced Optimistic Updates

Handle complex optimistic updates with relationships:

```tsx
function PostForm({ authorId }: { authorId: string }) {
  const queryClient = useQueryClient();
  const postCacheHelpers = createCacheHelpers<Post>('posts');
  const userCacheHelpers = createCacheHelpers<User>('users');
  
  const createPost = useMutation({
    ...postMutations.insert({
      onMutate: async (newPost) => {
        // Cancel outgoing queries
        await queryClient.cancelQueries({ queryKey: ['pgrestify', 'tables', 'posts'] });
        await queryClient.cancelQueries({ queryKey: ['pgrestify', 'tables', 'users'] });
        
        const optimisticPost = {
          ...newPost,
          id: `temp-${Date.now()}`,
          created_at: new Date().toISOString(),
          author_id: authorId
        };
        
        // Add post to cache
        postCacheHelpers.addToListCache(queryClient, optimisticPost);
        
        // Update user's post count optimistically
        userCacheHelpers.updateInListCache(queryClient, authorId, {
          post_count: (user) => (user.post_count || 0) + 1
        });
        
        return { optimisticPost };
      },
      
      onError: (err, newPost, context) => {
        // Revert all optimistic updates
        if (context?.optimisticPost) {
          postCacheHelpers.removeFromListCache(queryClient, context.optimisticPost.id);
          userCacheHelpers.updateInListCache(queryClient, authorId, {
            post_count: (user) => Math.max((user.post_count || 1) - 1, 0)
          });
        }
      },
      
      onSuccess: (data, variables, context) => {
        // Replace optimistic data with real data
        if (context?.optimisticPost) {
          postCacheHelpers.removeFromListCache(queryClient, context.optimisticPost.id);
          postCacheHelpers.addToListCache(queryClient, data.data[0]);
        }
        
        // Refresh user data to get accurate counts
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users', 'item', authorId] 
        });
      }
    })
  });

  // ... form implementation
}
```

## Cache Synchronization

### Cross-Component Cache Sync

Keep data synchronized across different components:

```tsx
// hooks/useUserSync.ts
import { useQueryClient } from '@tanstack/react-query';
import { createCacheHelpers } from '@webcoded/pgrestify/tanstack-query';

export function useUserSync() {
  const queryClient = useQueryClient();
  const cacheHelpers = createCacheHelpers<User>('users');
  
  const syncUserUpdate = (userId: string, updates: Partial<User>) => {
    // Update user in all relevant caches
    cacheHelpers.updateInListCache(queryClient, userId, updates);
    
    // Update user detail cache
    queryClient.setQueryData(
      ['pgrestify', 'tables', 'users', 'item', userId],
      (oldData: SingleQueryResponse<User> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: { ...oldData.data, ...updates }
        };
      }
    );
  };
  
  const syncUserDelete = (userId: string) => {
    // Remove from list caches
    cacheHelpers.removeFromListCache(queryClient, userId);
    
    // Remove detail cache
    queryClient.removeQueries({ 
      queryKey: ['pgrestify', 'tables', 'users', 'item', userId] 
    });
  };
  
  return { syncUserUpdate, syncUserDelete };
}

// Usage in components
function UserProfile({ userId }: { userId: string }) {
  const { syncUserUpdate } = useUserSync();
  
  const updateUser = useMutation({
    ...userMutations.update({
      onSuccess: (data, variables) => {
        // Sync update across all components
        syncUserUpdate(variables.where.id, variables.values);
      }
    })
  });

  // ... component implementation
}
```

## Performance Optimization

### Cache Configuration

Configure optimal cache settings for different data types:

```tsx
// utils/cacheConfig.ts
export const getCacheConfig = {
  // Frequently changing data - short cache time
  realtimeData: {
    staleTime: 30 * 1000,        // 30 seconds
    cacheTime: 2 * 60 * 1000,    // 2 minutes
    refetchInterval: 60 * 1000,   // Refetch every minute
  },
  
  // User data - moderate cache time
  userData: {
    staleTime: 5 * 60 * 1000,     // 5 minutes
    cacheTime: 15 * 60 * 1000,    // 15 minutes
    refetchOnWindowFocus: false,
  },
  
  // Static/reference data - long cache time
  referenceData: {
    staleTime: 60 * 60 * 1000,    // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
  
  // Profile data - very long cache time
  profileData: {
    staleTime: 15 * 60 * 1000,    // 15 minutes
    cacheTime: 60 * 60 * 1000,    // 1 hour
    refetchOnWindowFocus: true,   // Refresh when user returns
  }
};

// Usage with query factories
function useOptimizedQueries() {
  // Fast-changing notifications
  const { data: notifications } = useQuery({
    ...notificationQueries.list({ read: false }),
    ...getCacheConfig.realtimeData
  });
  
  // User profile data
  const { data: profile } = useQuery({
    ...userQueries.detail(userId),
    ...getCacheConfig.profileData
  });
  
  // Static categories
  const { data: categories } = useQuery({
    ...categoryQueries.list(),
    ...getCacheConfig.referenceData
  });
  
  return { notifications, profile, categories };
}
```

### Selective Cache Invalidation

Implement smart invalidation strategies:

```tsx
function useSmartInvalidation() {
  const queryClient = useQueryClient();
  
  const invalidateUserRelatedData = (userId: string) => {
    // Only invalidate data that could be affected by user changes
    queryClient.invalidateQueries({ 
      queryKey: ['pgrestify', 'tables', 'users', 'item', userId] 
    });
    
    queryClient.invalidateQueries({ 
      queryKey: ['pgrestify', 'tables', 'posts'],
      predicate: (query) => {
        // Only invalidate post queries that include this user
        return query.queryKey.some(key => 
          typeof key === 'object' && key?.author_id === userId
        );
      }
    });
  };
  
  const invalidateByDataType = (dataType: 'user' | 'post' | 'comment', affectedIds: string[]) => {
    switch (dataType) {
      case 'user':
        affectedIds.forEach(id => {
          queryClient.invalidateQueries({ 
            queryKey: ['pgrestify', 'tables', 'users', 'item', id] 
          });
        });
        break;
        
      case 'post':
        // Invalidate posts and related comments
        affectedIds.forEach(id => {
          queryClient.invalidateQueries({ 
            queryKey: ['pgrestify', 'tables', 'posts', 'item', id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['pgrestify', 'tables', 'comments'],
            predicate: (query) => {
              return query.queryKey.some(key => 
                typeof key === 'object' && key?.post_id === id
              );
            }
          });
        });
        break;
        
      case 'comment':
        // Only invalidate comment-related queries
        affectedIds.forEach(id => {
          queryClient.invalidateQueries({ 
            queryKey: ['pgrestify', 'tables', 'comments', 'item', id] 
          });
        });
        break;
    }
  };
  
  return { invalidateUserRelatedData, invalidateByDataType };
}
```

### Background Cache Warming

Pre-load frequently accessed data:

```tsx
function useCacheWarming() {
  const queryClient = useQueryClient();
  
  const warmUserCache = async (userId: string) => {
    // Pre-fetch user profile
    await queryClient.prefetchQuery({
      queryKey: ['pgrestify', 'tables', 'users', 'item', userId],
      queryFn: createQueryFunction(client, 'users', q => q.eq('id', userId).single()),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
    
    // Pre-fetch user's recent posts
    await queryClient.prefetchQuery({
      queryKey: ['pgrestify', 'tables', 'posts', 'data', { author_id: userId }],
      queryFn: createQueryFunction(client, 'posts', q => 
        q.eq('author_id', userId).order('created_at', { ascending: false }).limit(10)
      ),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
  
  const warmReferenceData = async () => {
    // Pre-fetch commonly used reference data
    const referenceQueries = [
      { table: 'categories', staleTime: 60 * 60 * 1000 }, // 1 hour
      { table: 'tags', staleTime: 30 * 60 * 1000 },       // 30 minutes
      { table: 'settings', staleTime: 15 * 60 * 1000 }    // 15 minutes
    ];
    
    await Promise.all(
      referenceQueries.map(({ table, staleTime }) =>
        queryClient.prefetchQuery({
          queryKey: ['pgrestify', 'tables', table, 'data'],
          queryFn: createQueryFunction(client, table),
          staleTime
        })
      )
    );
  };
  
  return { warmUserCache, warmReferenceData };
}

// Usage in app initialization
function App() {
  const { warmReferenceData } = useCacheWarming();
  
  useEffect(() => {
    // Warm cache on app start
    warmReferenceData();
  }, [warmReferenceData]);
  
  return <YourAppComponents />;
}
```

## Cache Debugging

### Cache Inspector Hook

Debug cache state in development:

```tsx
function useCacheDebugger(tableName: string) {
  const queryClient = useQueryClient();
  const keys = createQueryKeys();
  
  const inspectCache = () => {
    const cache = queryClient.getQueryCache();
    const tableQueries = cache.findAll({ queryKey: keys.table(tableName) });
    
    console.group(`Cache Inspector - ${tableName}`);
    console.log(`Found ${tableQueries.length} queries`);
    
    tableQueries.forEach(query => {
      console.log({
        queryKey: query.queryKey,
        state: query.state,
        dataUpdatedAt: new Date(query.state.dataUpdatedAt),
        isStale: query.isStale(),
        isInactive: query.isInactive()
      });
    });
    
    console.groupEnd();
  };
  
  const clearTableCache = () => {
    queryClient.removeQueries({ queryKey: keys.table(tableName) });
    console.log(`Cleared cache for table: ${tableName}`);
  };
  
  return { inspectCache, clearTableCache };
}

// Usage in development components
function DevTools() {
  const userDebugger = useCacheDebugger('users');
  const postDebugger = useCacheDebugger('posts');
  
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div style={{ position: 'fixed', top: 10, right: 10, background: 'white', padding: 10, border: '1px solid #ccc' }}>
      <h4>Cache Debugger</h4>
      <button onClick={userDebugger.inspectCache}>Inspect Users Cache</button>
      <button onClick={userDebugger.clearTableCache}>Clear Users Cache</button>
      <button onClick={postDebugger.inspectCache}>Inspect Posts Cache</button>
      <button onClick={postDebugger.clearTableCache}>Clear Posts Cache</button>
    </div>
  );
}
```

## Summary

PGRestify's cache management provides comprehensive tools for optimizing data freshness and performance in your applications. The structured query keys, targeted invalidation strategies, optimistic updates, and performance optimization utilities work together to create smooth, responsive user experiences while minimizing unnecessary network requests.

Key benefits:
- **Predictable cache behavior** through consistent key patterns
- **Optimized performance** with smart invalidation and caching strategies
- **Better user experience** through optimistic updates
- **Easy debugging** with built-in cache inspection tools
- **Flexible configuration** for different data types and usage patterns