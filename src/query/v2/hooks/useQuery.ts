/**
 * V2 useQuery Hook - Fluent API
 * Accepts QueryBuilder instances for fully fluent query building
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { QueryBuilder } from '../../../core/query-builder';
import { QueryObserver } from '../../core/query-observer';
import { usePGRestifyClient } from '../../react/provider';
import type {
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult,
} from '../../core/types';

// Hook option types for v2
export interface UseQueryOptions<TError = Error> {
  // React Query compatibility options
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchOnMount?: boolean;
  retry?: boolean | number;
  retryDelay?: number | ((attempt: number) => number);
  
  // React-specific options
  suspense?: boolean;
  throwOnError?: boolean | ((error: TError) => boolean);
  
  // Cache invalidation options
  invalidateQueries?: QueryKey[];
  refetchQueries?: QueryKey[];
}

// Hook result type for v2
export interface UseQueryResult<TData = unknown, TError = Error>
  extends QueryObserverResult<TData, TError> {
  // Additional v2-specific properties can be added here
}

/**
 * V2 useQuery - Pure Fluent API
 * Accept QueryBuilder instances for fully fluent query building
 * 
 * @param queryKey Unique identifier for the query
 * @param queryBuilder QueryBuilder instance with chained methods
 * @param options Query options
 * @returns Query result with data, loading states, and utilities
 * 
 * @example
 * const { data, isLoading, error } = useQuery(
 *   ['products', 'search', search],
 *   query()
 *     .from('products')
 *     .select(['id', 'name', 'price'])
 *     .ilike('name', `%${search}%`)
 *     .eq('active', true)
 *     .orderBy('created_at', 'DESC')
 *     .limit(20),
 *   { staleTime: 5 * 60 * 1000 }
 * );
 */
export function useQuery<TData = unknown, TError = Error>(
  queryKey: QueryKey,
  queryBuilder: QueryBuilder<TData>,
  options: UseQueryOptions<TError> = {}
): UseQueryResult<TData, TError> {
  const client = usePGRestifyClient();
  
  // Create query function from QueryBuilder
  const queryFn = useCallback(async (): Promise<TData> => {
    const result = await queryBuilder.execute();
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    // Handle both single records and arrays
    return result.data as TData;
  }, [queryBuilder]);

  // Convert v2 options to internal QueryObserverOptions
  const observerOptions: QueryObserverOptions<TData, TError> = {
    queryKey,
    queryFn,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 0,
    gcTime: options.gcTime ?? 5 * 60 * 1000,
    refetchInterval: options.refetchInterval ?? false,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
    refetchOnReconnect: options.refetchOnReconnect ?? true,
    refetchOnMount: options.refetchOnMount ?? true,
    retry: options.retry ?? 3,
    retryDelay: options.retryDelay ?? (attempt => Math.min(1000 * 2 ** attempt, 30000)),
  };

  // Create stable observer reference
  const observerRef = useRef<QueryObserver<TData, TError>>();
  
  if (!observerRef.current) {
    observerRef.current = new QueryObserver(client, observerOptions);
  }

  const observer = observerRef.current;

  // Update observer options when they change
  const optionsRef = useRef(observerOptions);
  if (optionsRef.current !== observerOptions) {
    observer.setOptions(observerOptions);
    optionsRef.current = observerOptions;
  }

  // Subscribe to observer changes with useSyncExternalStore
  const result = useSyncExternalStore(
    // Subscribe function
    (callback) => {
      return observer.subscribe(callback);
    },
    // Get snapshot function
    () => {
      return observer.getCurrentResult();
    },
    // Get server snapshot (for SSR)
    () => {
      // Return initial loading state for SSR
      return observer.getCurrentResult();
    }
  ) as UseQueryResult<TData, TError>;

  // Handle suspense
  if (options.suspense && result.isLoading && !result.data) {
    // Suspend by throwing a promise
    throw observer.fetchOptimistic(observerOptions);
  }

  // Handle error throwing
  if (options.throwOnError && result.error) {
    const shouldThrow = typeof options.throwOnError === 'function' 
      ? options.throwOnError(result.error)
      : true;
    
    if (shouldThrow) {
      throw result.error;
    }
  }

  // Cleanup on unmount
  useCallback(() => {
    return () => {
      observer.destroy();
    };
  }, [observer]);

  return result;
}

/**
 * useInfiniteQuery for v2 fluent API
 * Handles paginated queries with QueryBuilder instances
 */
export interface UseInfiniteQueryOptions<TError = Error>
  extends Omit<UseQueryOptions<TError>, 'enabled'> {
  enabled?: boolean;
  getNextPageParam?: (lastPage: any, pages: any[]) => unknown;
  getPreviousPageParam?: (firstPage: any, pages: any[]) => unknown;
  initialPageParam?: unknown;
}

export interface UseInfiniteQueryResult<TData = unknown, TError = Error> {
  data: {
    pages: TData[];
    pageParams: unknown[];
  } | undefined;
  error: TError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<void>;
  fetchPreviousPage: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * V2 useInfiniteQuery - Fluent API for paginated queries
 * 
 * @param queryKey Unique identifier for the query
 * @param queryBuilderFn Function that returns QueryBuilder with pagination
 * @param options Infinite query options
 * @returns Infinite query result with pagination utilities
 * 
 * @example
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetching
 * } = useInfiniteQuery(
 *   ['posts', 'infinite'],
 *   ({ pageParam = 0 }) =>
 *     query()
 *       .from('posts')
 *       .select(['id', 'title', 'content'])
 *       .eq('published', true)
 *       .orderBy('created_at', 'DESC')
 *       .limit(10)
 *       .offset(pageParam * 10),
 *   {
 *     getNextPageParam: (lastPage, pages) => 
 *       lastPage.length === 10 ? pages.length : undefined
 *   }
 * );
 */
export function useInfiniteQuery<TData = unknown, TError = Error>(
  queryKey: QueryKey,
  queryBuilderFn: (context: { pageParam: unknown }) => QueryBuilder<TData>,
  options: UseInfiniteQueryOptions<TError> = {}
): UseInfiniteQueryResult<TData, TError> {
  // This is a simplified implementation - you'd need to implement full infinite query logic
  // For now, we'll delegate to a basic useQuery implementation
  
  const basicResult = useQuery(
    queryKey,
    queryBuilderFn({ pageParam: options.initialPageParam || 0 }),
    options as UseQueryOptions<TError>
  );

  // Transform basic result to infinite query result format
  const infiniteResult: UseInfiniteQueryResult<TData, TError> = {
    data: basicResult.data ? {
      pages: [basicResult.data] as TData[],
      pageParams: [options.initialPageParam || 0]
    } : undefined,
    error: basicResult.error,
    isLoading: basicResult.isLoading,
    isError: basicResult.isError,
    isSuccess: basicResult.isSuccess,
    isFetching: basicResult.isFetching,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    hasNextPage: false, // Would need proper implementation
    hasPreviousPage: false, // Would need proper implementation
    fetchNextPage: async () => {
      // Would need proper implementation
    },
    fetchPreviousPage: async () => {
      // Would need proper implementation
    },
    refetch: async () => {
      await basicResult.refetch();
    },
  };

  return infiniteResult;
}

// Export types
export type { QueryKey };