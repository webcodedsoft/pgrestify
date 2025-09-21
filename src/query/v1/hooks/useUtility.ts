/**
 * Utility Hooks
 * Additional hooks for React Query-compatible functionality
 */

import { useSyncExternalStore, useCallback } from 'react';
import { usePGRestifyClient } from '../../react/provider';
import type { QueryKey, MutationKey } from '../../core/types';

/**
 * Hook to check if any queries are fetching
 */
export function useIsFetching(filters?: {
  queryKey?: QueryKey;
  exact?: boolean;
  stale?: boolean;
}): number {
  const client = usePGRestifyClient();
  
  return useSyncExternalStore(
    (callback) => {
      // Subscribe to query cache changes
      return client.getQueryCache().subscribe(callback);
    },
    () => {
      // Get current fetching count
      return client.isFetching(filters);
    },
    () => {
      // SSR snapshot
      return 0;
    }
  );
}

/**
 * Hook to check if any mutations are loading
 */
export function useIsMutating(filters?: {
  mutationKey?: MutationKey;
  exact?: boolean;
}): number {
  const client = usePGRestifyClient();
  
  return useSyncExternalStore(
    (callback) => {
      // Subscribe to mutation cache changes
      return client.getMutationCache().subscribe(callback);
    },
    () => {
      // Get current mutating count
      return client.isMutating(filters);
    },
    () => {
      // SSR snapshot
      return 0;
    }
  );
}

/**
 * Hook to check if a specific query is fetching
 */
export function useIsQueryFetching(
  queryKey: QueryKey,
  options?: {
    exact?: boolean;
  }
): boolean {
  const client = usePGRestifyClient();
  
  return useSyncExternalStore(
    (callback) => {
      return client.getQueryCache().subscribe(callback);
    },
    () => {
      const query = client.getQueryCache().find({ queryKey, exact: options?.exact || false });
      return query ? query.state.status === 'loading' : false;
    },
    () => false
  );
}

/**
 * Hook to invalidate queries
 */
export function useInvalidateQueries() {
  const client = usePGRestifyClient();
  
  return useCallback(
    async (filters?: { 
      queryKey?: QueryKey;
      exact?: boolean;
      refetchType?: 'active' | 'inactive' | 'all';
    }) => {
      return client.invalidateQueries(filters);
    },
    [client]
  );
}

/**
 * Hook to refetch queries
 */
export function useRefetchQueries() {
  const client = usePGRestifyClient();
  
  return useCallback(
    async (filters?: { 
      queryKey?: QueryKey;
      exact?: boolean;
      stale?: boolean;
    }) => {
      return client.refetchQueries(filters);
    },
    [client]
  );
}

/**
 * Hook to reset queries
 */
export function useResetQueries() {
  const client = usePGRestifyClient();
  
  return useCallback(
    async (filters?: { 
      queryKey?: QueryKey;
      exact?: boolean;
    }) => {
      return client.resetQueries(filters);
    },
    [client]
  );
}

/**
 * Hook to cancel queries
 */
export function useCancelQueries() {
  const client = usePGRestifyClient();
  
  return useCallback(
    async (filters?: { 
      queryKey?: QueryKey;
      exact?: boolean;
    }) => {
      return client.cancelQueries(filters);
    },
    [client]
  );
}

/**
 * Hook to get query data
 */
export function useQueryData<TData = unknown>(queryKey: QueryKey): TData | undefined {
  const client = usePGRestifyClient();
  
  return useSyncExternalStore(
    (callback) => {
      return client.getQueryCache().subscribe(callback);
    },
    () => {
      return client.getQueryData<TData>(queryKey);
    },
    () => undefined
  );
}

/**
 * Hook to set query data
 */
export function useSetQueryData<TData = unknown>() {
  const client = usePGRestifyClient();
  
  return useCallback(
    (
      queryKey: QueryKey, 
      data: TData | ((oldData?: TData) => TData)
    ) => {
      return client.setQueryData(queryKey, data);
    },
    [client]
  );
}

/**
 * Hook to get queries
 */
export function useQueries<TData = unknown>(
  queries: Array<{
    queryKey: QueryKey;
    queryFn: () => Promise<TData>;
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }>
) {
  const client = usePGRestifyClient();
  
  // This is a simplified implementation
  // In a full implementation, this would manage multiple queries efficiently
  return useSyncExternalStore(
    (callback) => {
      const unsubscribes = queries.map(() => 
        client.getQueryCache().subscribe(callback)
      );
      
      return () => {
        unsubscribes.forEach(unsub => unsub());
      };
    },
    () => {
      return queries.map(query => ({
        data: client.getQueryData(query.queryKey),
        isLoading: client.isFetching({ queryKey: query.queryKey }) > 0,
        error: null, // Simplified
      }));
    },
    () => {
      return queries.map(() => ({
        data: undefined,
        isLoading: false,
        error: null,
      }));
    }
  );
}

/**
 * PostgREST-specific utility hooks
 */

/**
 * Hook to track real-time subscriptions
 */
export function useSubscription<TData = unknown>(
  channelName: string,
  options?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    schema?: string;
    table?: string;
    filter?: string;
    onData?: (payload: TData) => void;
    onError?: (error: Error) => void;
  }
) {
  const client = usePGRestifyClient();
  
  return useSyncExternalStore(
    (callback) => {
      // Subscribe to real-time updates  
      const subscription = (client as any).channel?.(channelName)
        .on(options?.event || '*', 
          {
            event: options?.event,
            schema: options?.schema,
            table: options?.table,
            filter: options?.filter,
          },
          (payload: TData) => {
            if (options?.onData) {
              options.onData(payload);
            }
            callback();
          }
        )
        .on('postgres_changes', callback)
        .subscribe();

      return () => {
        subscription?.unsubscribe?.();
      };
    },
    () => {
      // Return subscription state
      return {
        status: 'connected', // Simplified
        error: null,
      };
    },
    () => ({
      status: 'disconnected',
      error: null,
    })
  );
}

/**
 * Hook for database schema information
 */
export function useSchema(tableName?: string) {
  const client = usePGRestifyClient();
  
  return useSyncExternalStore(
    () => () => {}, // No real subscription for schema data
    () => {
      // Return cached schema info if available
      return (client as any).getSchema?.(tableName) || null;
    },
    () => null
  );
}

// All hooks are already individually exported above