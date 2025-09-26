/**
 * useInfiniteQuery Hook
 * Infinite query hook for PGRestify with automatic pagination
 * Supports multiple API styles for maximum flexibility
 */

import { useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import { usePGRestifyClient } from '../provider';
import { 
  extractDataArray 
} from './types';
import type {
  QueryKey,
  QueryFunction,
  InfiniteQueryOptions,
  InfiniteQueryObserverResult,
  InfiniteData,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  QueryFunctionContext,
  PGRestifyClient,
} from '../../core/types';
import { QueryBuilder } from '@/core/query-builder';

// PGRestify infinite query options interface
export interface UsePGRestifyInfiniteQueryOptions<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
> {
  // Brand property to help TypeScript distinguish this interface
  readonly __brand?: 'pgrestify-infinite-query-options';
  
  // Table name (required)
  from: string; // The table to query from
  
  // Query configuration
  select?: string | string[]; // Supports arrays with aliases like ['id', 'name AS display_name']
  relations?: string[]; // PostgREST embed syntax like ['author', 'category']
  filters?: Partial<TData> | Record<string, unknown>; // Filter conditions
  order?: { column: string; ascending?: boolean } | { column: string; ascending?: boolean }[]; // Single or multiple sort orders
  
  // Pagination configuration
  limit?: number; // Alias for pageSize
  pageSize?: number; // Number of items per page
  paginationType?: 'offset' | 'range';
  
  // Advanced PostgREST options
  range?: [number, number]; // Range-based pagination
  offset?: number; // Offset-based pagination
  count?: 'exact' | 'planned' | 'estimated'; // Count method
  
  // Custom query builder (optional)
  queryBuilder?: (builder: QueryBuilder<TData>, pageParam?: unknown) => QueryBuilder<TData>;
  
  // Query options
  queryKey?: QueryKey;
  getNextPageParam?: (lastPage: TData[], allPages: TData[][], lastPageParam?: unknown, allPageParams?: unknown[]) => unknown;
  getPreviousPageParam?: (firstPage: TData[], allPages: TData[][], firstPageParam?: unknown, allPageParams?: unknown[]) => unknown;
  initialPageParam?: unknown;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number;
  
  // React-specific options
  suspense?: boolean;
  throwOnError?: boolean | ((error: TError) => boolean);
}

// Legacy table-based infinite query options (for backward compatibility)
export interface UseTableInfiniteQueryOptions<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
> {
  // Query configuration
  select?: string | string[];
  filters?: Partial<TData>;
  orderBy?: { column: keyof TData; ascending?: boolean }[];
  
  // Pagination configuration
  pageSize?: number;
  paginationType?: 'offset' | 'range';
  
  // Custom query builder (optional)
  queryBuilder?: (builder: QueryBuilder<TData>, pageParam?: unknown) => QueryBuilder<TData>;
  
  // Query options
  queryKey?: QueryKey;
  getNextPageParam?: (lastPage: TData[], allPages: TData[][], lastPageParam?: unknown, allPageParams?: unknown[]) => unknown;
  getPreviousPageParam?: (firstPage: TData[], allPages: TData[][], firstPageParam?: unknown, allPageParams?: unknown[]) => unknown;
  initialPageParam?: unknown;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number;
  
  // React-specific options
  suspense?: boolean;
  throwOnError?: boolean | ((error: TError) => boolean);
}

// Standard infinite query options
export interface UseStandardInfiniteQueryOptions<
  TData = unknown,
  TError = Error,
  TSelect = InfiniteData<TData>
> extends InfiniteQueryOptions<TData, TError, TSelect> {
  // React-specific options
  suspense?: boolean;
  throwOnError?: boolean | ((error: TError) => boolean);
}

// Hook result type
export interface UseInfiniteQueryResult<TData = unknown, TError = Error>
  extends InfiniteQueryObserverResult<TData, TError> {
  // Additional convenience methods
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<InfiniteQueryObserverResult<TData, TError>>;
  fetchPreviousPage: (options?: FetchPreviousPageOptions) => Promise<InfiniteQueryObserverResult<TData, TError>>;
}

/**
 * Helper function to build select with relations for infinite queries
 */
function buildSelectWithRelations(
  select?: string | string[],
  relations?: string[]
): string | undefined {
  const selectParts: string[] = [];
  
  // Handle select columns
  if (select) {
    const selectColumns = Array.isArray(select) ? select : [select];
    
    // Process each column, handling aliases (convert 'column AS alias' to 'alias:column')
    const processedColumns = selectColumns.map(col => {
      if (typeof col === 'string' && col.includes(' AS ')) {
        const [column, alias] = col.split(' AS ').map(s => s.trim());
        return `${alias}:${column}`;
      }
      return col;
    });
    
    selectParts.push(...processedColumns);
  } else {
    selectParts.push('*');
  }
  
  // Add relations using PostgREST embed syntax
  if (relations && relations.length > 0) {
    const relationParts = relations.map(relation => {
      if (!relation || typeof relation !== 'string') return '';
      
      // Simple relation: 'author' -> 'author:users(*)'
      // Complex relation: 'author.profile' -> 'author:users(profile:profiles(*))'
      if (relation.includes('.')) {
        // Handle nested relations
        const parts = relation.split('.');
        let result = parts[0] || '';
        for (let i = 1; i < parts.length; i++) {
          result += `:${parts[i] || ''}s(${parts[i + 1] ? '' : '*'}`;
        }
        result += '*' + ')'.repeat(parts.length - 1);
        return result;
      } else {
        // Simple relation - assume foreign table follows naming convention
        return `${relation}:${relation}s(*)`;
      }
    }).filter(Boolean); // Remove empty strings
    
    selectParts.push(...relationParts);
  }
  
  return selectParts.join(', ');
}

/**
 * Helper function to create PGRestify infinite query options
 */
function createPGRestifyInfiniteQueryOptions<TData extends Record<string, unknown>, TError = Error>(
  client: PGRestifyClient,
  options: UsePGRestifyInfiniteQueryOptions<TData, TError>
): UseStandardInfiniteQueryOptions<TData[], TError> {
  const tableName = options.from; // Get table name from options
  const pageSize = options.limit || options.pageSize || 20;
  const paginationType = options.paginationType || 'offset';

  // Build select with relations
  const selectQuery = buildSelectWithRelations(options.select, options.relations);

  // Generate query key
  const queryKey = options.queryKey || [
    tableName,
    'infinite',
    {
      filters: options.filters,
      select: options.select,
      relations: options.relations,
      order: options.order,
      limit: pageSize,
      paginationType,
    }
  ];

  // Create query function
  const queryFn: QueryFunction<TData[]> = async ({ pageParam = options.initialPageParam ?? (0) }) => {
    let query = client.from<TData>(tableName);

    // Apply custom query builder first
    if (options.queryBuilder) {
      query = options.queryBuilder(query, pageParam);
    } else {
      // Apply standard options
      if (selectQuery) {
        query = query.select(selectQuery) as QueryBuilder<TData>;
      }

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key as keyof TData, value);
          }
        });
      }

      // Apply ordering
      if (options.order) {
        const orders = Array.isArray(options.order) ? options.order : [options.order];
        orders.forEach(({ column, ascending = true }) => {
          query = query.order(column as keyof TData, { ascending });
        });
      }

      // Apply pagination based on type
      if (paginationType === 'offset') {
        const offset = typeof pageParam === 'number' ? pageParam * pageSize : 0;
        query = query.limit(pageSize).offset(offset);
      } else if (paginationType === 'range') {
        const from = typeof pageParam === 'number' ? pageParam * pageSize : 0;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      } else {
        query = query.limit(pageSize);
      }

      // Apply manual range if provided
      if (options.range) {
        query = query.range(options.range[0], options.range[1]);
      }

      // Apply manual offset if provided
      if (options.offset && paginationType !== 'offset') {
        query = query.offset(options.offset);
      }

      // Apply count method if provided
      if (options.count) {
        // Note: This would need to be implemented in the query builder
        // query = query.count(options.count);
      }
    }

    const result = await query.execute();
    return extractDataArray<TData>(result);
  };

  // Default getNextPageParam function
  const getNextPageParam = options.getNextPageParam || ((lastPage: TData[], allPages: TData[][]) => {
    if (!lastPage || lastPage.length < pageSize) {
      return undefined; // No more pages
    }

    if (paginationType === 'offset') {
      return allPages.length; // Page number for next offset
    } else if (paginationType === 'range') {
      return allPages.length; // Page number for next range
    }

    return undefined;
  });

  return {
    queryKey,
    queryFn,
    getNextPageParam,
    getPreviousPageParam: options.getPreviousPageParam,
    initialPageParam: options.initialPageParam ?? (0),
    enabled: options.enabled,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    refetchInterval: options.refetchInterval,
    suspense: options.suspense || false,
    throwOnError: options.throwOnError || false,
  } as UseStandardInfiniteQueryOptions<TData[], TError>;
}

/**
 * Helper function to create table-based infinite query options (legacy)
 */
function createTableInfiniteQueryOptions<TData extends Record<string, unknown>, TError = Error>(
  client: PGRestifyClient,
  tableName: string,
  options: UseTableInfiniteQueryOptions<TData, TError>
): UseStandardInfiniteQueryOptions<TData[], TError> {
  const pageSize = options.pageSize || 20;
  const paginationType = options.paginationType || 'offset';

  // Generate query key
  const queryKey = options.queryKey || [
    tableName,
    'infinite',
    {
      filters: options.filters,
      select: options.select,
      orderBy: options.orderBy,
      pageSize,
      paginationType,
    }
  ];

  // Create query function
  const queryFn: QueryFunction<TData[]> = async ({ pageParam = options.initialPageParam ?? (0) }) => {
    let query = client.from<TData>(tableName);

    // Apply custom query builder first
    if (options.queryBuilder) {
      query = options.queryBuilder(query, pageParam);
    } else {
      // Apply standard options
      if (options.select) {
        const selectStr = Array.isArray(options.select) 
          ? options.select.join(', ')
          : options.select;
        query = query.select(selectStr) as QueryBuilder<TData>;
      }

      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined) {
            query = query.eq(key as keyof TData, value);
          }
        });
      }

      if (options.orderBy) {
        options.orderBy.forEach(({ column, ascending = true }) => {
          query = query.order(column, { ascending });
        });
      }

      // Apply pagination based on type
      if (paginationType === 'offset') {
        const offset = typeof pageParam === 'number' ? pageParam * pageSize : 0;
        query = query.limit(pageSize).offset(offset);
      } else if (paginationType === 'range') {
        const from = typeof pageParam === 'number' ? pageParam * pageSize : 0;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      } else {
        query = query.limit(pageSize);
      }
    }

    const result = await query.execute();
    return extractDataArray<TData>(result);
  };

  // Default getNextPageParam function
  const getNextPageParam = options.getNextPageParam || ((lastPage: TData[], allPages: TData[][]) => {
    if (!lastPage || lastPage.length < pageSize) {
      return undefined; // No more pages
    }

    if (paginationType === 'offset') {
      return allPages.length; // Page number for next offset
    } else if (paginationType === 'range') {
      return allPages.length; // Page number for next range
    }

    return undefined;
  });

  return {
    queryKey,
    queryFn,
    getNextPageParam,
    getPreviousPageParam: options.getPreviousPageParam,
    initialPageParam: options.initialPageParam ?? (0),
    enabled: options.enabled,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    refetchInterval: options.refetchInterval,
    suspense: options.suspense || false,
    throwOnError: options.throwOnError || false,
  } as UseStandardInfiniteQueryOptions<TData[], TError>;
}

/**
 * Simple infinite query observer for React
 */
class InfiniteQueryObserver<TData = unknown, TError = Error> {
  private options: UseStandardInfiniteQueryOptions<TData, TError>;
  private listeners = new Set<(result: UseInfiniteQueryResult<TData, TError>) => void>();
  private currentResult: UseInfiniteQueryResult<TData, TError>;
  private pages: TData[] = [];
  private pageParams: unknown[] = [];
  private isLoading = false;
  private isFetchingNextPage = false;
  private isFetchingPreviousPage = false;
  private error: TError | null = null;

  constructor(_client: PGRestifyClient, options: UseStandardInfiniteQueryOptions<TData, TError>) {
    this.options = options;
    this.currentResult = this.createInitialResult();
  }

  private createInitialResult(): UseInfiniteQueryResult<TData, TError> {
    const infiniteData: InfiniteData<TData> = {
      pages: this.pages,
      pageParams: this.pageParams,
    };

    return {
      data: infiniteData,
      dataUpdatedAt: 0,
      error: this.error,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: this.error,
      fetchStatus: 'idle',
      isError: !!this.error,
      isFetched: this.pages.length > 0,
      isFetchedAfterMount: false,
      isFetching: this.isLoading || this.isFetchingNextPage || this.isFetchingPreviousPage,
      isInitialLoading: this.isLoading && this.pages.length === 0,
      isLoading: this.isLoading,
      isLoadingError: !!this.error && this.pages.length === 0,
      isPaused: false,
      isPending: this.isLoading && this.pages.length === 0,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: !!this.error && this.pages.length > 0,
      isRefetching: this.isLoading && this.pages.length > 0,
      isStale: false,
      isSuccess: !this.error && this.pages.length > 0,
      status: this.error ? 'error' : this.pages.length > 0 ? 'success' : this.isLoading ? 'loading' : 'idle',
      
      // Infinite query specific
      hasNextPage: this.hasNextPage(),
      hasPreviousPage: this.hasPreviousPage(),
      isFetchingNextPage: this.isFetchingNextPage,
      isFetchingPreviousPage: this.isFetchingPreviousPage,
      fetchNextPage: this.fetchNextPage.bind(this),
      fetchPreviousPage: this.fetchPreviousPage.bind(this),
      
      // Standard methods
      refetch: async () => { await this.refetch(); return this.getCurrentResult(); },
      remove: this.remove.bind(this),
    };
  }

  subscribe(callback: (result: UseInfiniteQueryResult<TData, TError>) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getCurrentResult(): UseInfiniteQueryResult<TData, TError> {
    return this.currentResult;
  }

  setOptions(options: UseStandardInfiniteQueryOptions<TData, TError>) {
    const prevOptions = this.options;
    this.options = options;
    
    // If key changed, reset data
    if (JSON.stringify(prevOptions.queryKey) !== JSON.stringify(options.queryKey)) {
      this.reset();
    }
  }

  private updateResult() {
    this.currentResult = this.createInitialResult();
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentResult);
      } catch (error) {
        console.error('InfiniteQueryObserver listener error:', error);
      }
    });
  }

  private hasNextPage(): boolean {
    if (!this.options.getNextPageParam) return false;
    
    const lastPage = this.pages[this.pages.length - 1];
    const lastPageParam = this.pageParams[this.pageParams.length - 1];
    
    if (!lastPage) return true; // Can fetch first page
    
    const nextPageParam = this.options.getNextPageParam(
      lastPage,
      this.pages,
      lastPageParam,
      this.pageParams
    );
    
    return nextPageParam !== undefined && nextPageParam !== null;
  }

  private hasPreviousPage(): boolean {
    if (!this.options.getPreviousPageParam) return false;
    
    const firstPage = this.pages[0];
    const firstPageParam = this.pageParams[0];
    
    if (!firstPage) return false;
    
    const previousPageParam = this.options.getPreviousPageParam(
      firstPage,
      this.pages,
      firstPageParam,
      this.pageParams
    );
    
    return previousPageParam !== undefined && previousPageParam !== null;
  }

  async fetchNextPage(
    _options?: FetchNextPageOptions
  ): Promise<InfiniteQueryObserverResult<TData, TError>> {
    if (!this.hasNextPage() || this.isFetchingNextPage) {
      return this.currentResult;
    }

    this.isFetchingNextPage = true;
    this.updateResult();

    try {
      const lastPage = this.pages[this.pages.length - 1];
      const lastPageParam = this.pageParams[this.pageParams.length - 1];
      
      let nextPageParam = this.options.initialPageParam;
      if (this.options.getNextPageParam && lastPage) {
        nextPageParam = this.options.getNextPageParam(
          lastPage,
          this.pages,
          lastPageParam,
          this.pageParams
        );
      }

      const context: QueryFunctionContext = {
        queryKey: this.options.queryKey,
        pageParam: nextPageParam,
      };

      const newPage = await this.options.queryFn(context);
      
      this.pages.push(newPage);
      this.pageParams.push(nextPageParam);
      this.error = null;

    } catch (error) {
      this.error = error as TError;
    } finally {
      this.isFetchingNextPage = false;
      this.updateResult();
    }

    return this.currentResult;
  }

  async fetchPreviousPage(
    _options?: FetchPreviousPageOptions
  ): Promise<InfiniteQueryObserverResult<TData, TError>> {
    if (!this.hasPreviousPage() || this.isFetchingPreviousPage) {
      return this.currentResult;
    }

    this.isFetchingPreviousPage = true;
    this.updateResult();

    try {
      const firstPage = this.pages[0];
      const firstPageParam = this.pageParams[0];
      
      if (!this.options.getPreviousPageParam || !firstPage) {
        throw new Error('getPreviousPageParam is required for fetchPreviousPage');
      }

      const previousPageParam = this.options.getPreviousPageParam(
        firstPage,
        this.pages,
        firstPageParam,
        this.pageParams
      );

      const context: QueryFunctionContext = {
        queryKey: this.options.queryKey,
        pageParam: previousPageParam,
      };

      const newPage = await this.options.queryFn(context);
      
      this.pages.unshift(newPage);
      this.pageParams.unshift(previousPageParam);
      this.error = null;

    } catch (error) {
      this.error = error as TError;
    } finally {
      this.isFetchingPreviousPage = false;
      this.updateResult();
    }

    return this.currentResult;
  }

  async initialFetch() {
    if (this.pages.length > 0 || this.isLoading || this.options.enabled === false) {
      return;
    }

    await this.fetchNextPage();
  }

  async refetch() {
    this.reset();
    await this.initialFetch();
  }

  remove() {
    this.reset();
  }

  reset() {
    this.pages = [];
    this.pageParams = [];
    this.error = null;
    this.isLoading = false;
    this.isFetchingNextPage = false;
    this.isFetchingPreviousPage = false;
    this.updateResult();
  }

  destroy() {
    this.listeners.clear();
  }
}

/**
 * Primary useInfiniteQuery hook with overloads
 * Supports multiple API styles for maximum flexibility
 */

// Overload 1: New PGRestify style with from inside config
export function useInfiniteQuery<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  options: UsePGRestifyInfiniteQueryOptions<TData, TError>
): UseInfiniteQueryResult<InfiniteData<TData[]>, TError>;

// Overload 2: Standard object options
export function useInfiniteQuery<
  TData = unknown,
  TError = Error,
  TSelect = InfiniteData<TData>
>(
  options: UseStandardInfiniteQueryOptions<TData, TError, TSelect>
): UseInfiniteQueryResult<TSelect, TError>;

// Overload 3: Standard separate params 
export function useInfiniteQuery<
  TData = unknown,
  TError = Error,
  TSelect = InfiniteData<TData>
>(
  queryKey: QueryKey,
  queryFn: QueryFunction<TData>,
  options?: Omit<UseStandardInfiniteQueryOptions<TData, TError, TSelect>, 'queryKey' | 'queryFn'>
): UseInfiniteQueryResult<TSelect, TError>;

// Overload 4: Legacy table-based convenience style (for backward compatibility)
export function useInfiniteQuery<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string,
  options?: UseTableInfiniteQueryOptions<TData, TError>
): UseInfiniteQueryResult<InfiniteData<TData[]>, TError>;

// Implementation
export function useInfiniteQuery<
  TData = unknown,
  TError = Error,
  TSelect = InfiniteData<TData>
>(
  arg1: UsePGRestifyInfiniteQueryOptions<TData & Record<string, unknown>, TError> | UseStandardInfiniteQueryOptions<TData, TError, TSelect> | QueryKey | string,
  arg2?: QueryFunction<TData> | UseTableInfiniteQueryOptions<TData & Record<string, unknown>, TError>,
  arg3?: Omit<UseStandardInfiniteQueryOptions<TData, TError, TSelect>, 'queryKey' | 'queryFn'>
): UseInfiniteQueryResult<TSelect, TError> {
  const client = usePGRestifyClient();
  
  // Determine which API style is being used and normalize options
  const options = useMemo(() => {
    // Case 1: New PGRestify style with 'from' inside config
    if (typeof arg1 === 'object' && !Array.isArray(arg1) && 'from' in arg1) {
      const pgRestifyOptions = arg1 as UsePGRestifyInfiniteQueryOptions<TData & Record<string, unknown>, TError>;
      return createPGRestifyInfiniteQueryOptions<TData & Record<string, unknown>, TError>(
        client,
        pgRestifyOptions
      ) as unknown as UseStandardInfiniteQueryOptions<TData, TError, TSelect>;
    }
    
    // Case 2: Legacy table-based API with string tableName
    if (typeof arg1 === 'string' && (typeof arg2 === 'object' || arg2 === undefined)) {
      const tableName = arg1;
      const tableOptions = (arg2 as UseTableInfiniteQueryOptions<TData & Record<string, unknown>, TError>) || {};
      
      // Legacy table-based API
      return createTableInfiniteQueryOptions<TData & Record<string, unknown>, TError>(
        client, 
        tableName, 
        tableOptions
      ) as unknown as UseStandardInfiniteQueryOptions<TData, TError, TSelect>;
    }
    
    // Case 3: Standard object API (without 'from')
    if (typeof arg1 === 'object' && !Array.isArray(arg1)) {
      return arg1 as UseStandardInfiniteQueryOptions<TData, TError, TSelect>;
    }
    
    // Case 4: Standard separate params API
    if (Array.isArray(arg1) || (typeof arg1 === 'string' && typeof arg2 === 'function')) {
      return {
        queryKey: arg1 as QueryKey,
        queryFn: arg2 as QueryFunction<TData>,
        ...arg3,
      } as UseStandardInfiniteQueryOptions<TData, TError, TSelect>;
    }
    
    throw new Error('useInfiniteQuery: Invalid arguments');
  }, [arg1, arg2, arg3, client]);

  // Validate required options
  if (!options.queryKey) {
    throw new Error('useInfiniteQuery: queryKey is required');
  }
  if (!options.queryFn) {
    throw new Error('useInfiniteQuery: queryFn is required');
  }

  // Create stable observer reference
  const observerRef = useRef<InfiniteQueryObserver<TData, TError>>();
  
  if (!observerRef.current) {
    observerRef.current = new InfiniteQueryObserver(client, options as UseStandardInfiniteQueryOptions<TData, TError>);
  }

  const observer = observerRef.current;

  // Update observer options when they change
  const optionsRef = useRef(options);
  if (optionsRef.current !== options) {
    observer.setOptions(options as UseStandardInfiniteQueryOptions<TData, TError>);
    optionsRef.current = options;
  }

  // Subscribe to observer changes
  const result = useSyncExternalStore(
    (callback) => observer.subscribe(callback),
    () => observer.getCurrentResult(),
    () => observer.getCurrentResult()
  ) as unknown as UseInfiniteQueryResult<TSelect, TError>;

  // Initial fetch
  useEffect(() => {
    observer.initialFetch();
  }, [observer]);

  // Handle suspense
  useEffect(() => {
    if (options.suspense && result.isInitialLoading) {
      throw observer.fetchNextPage();
    }
  }, [options.suspense, result.isInitialLoading, observer]);

  // Handle error throwing
  useEffect(() => {
    if (options.throwOnError && result.error) {
      const shouldThrow = typeof options.throwOnError === 'function' 
        ? options.throwOnError(result.error)
        : true;
      
      if (shouldThrow) {
        throw result.error;
      }
    }
  }, [options.throwOnError, result.error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      observer.destroy();
    };
  }, [observer]);

  return result;
}

/**
 * Convenience hooks for common infinite query patterns
 */

/**
 * useInfinitePosts - Common pattern for paginated posts
 */
export function useInfinitePosts<TPost extends Record<string, unknown> = Record<string, unknown>>(
  options?: Omit<UseTableInfiniteQueryOptions<TPost>, 'orderBy'> & {
    orderBy?: UseTableInfiniteQueryOptions<TPost>['orderBy'];
  }
) {
  return useInfiniteQuery<TPost>('posts', {
    ...options,
    orderBy: options?.orderBy || [{ column: 'created_at' as keyof TPost, ascending: false }],
    pageSize: 10,
  });
}

/**
 * useInfiniteComments - Common pattern for paginated comments
 */
export function useInfiniteComments<TComment extends Record<string, unknown> = Record<string, unknown>>(
  postId?: string | number,
  options?: UseTableInfiniteQueryOptions<TComment>
) {
  return useInfiniteQuery<TComment>('comments', {
    ...(postId ? { filters: { post_id: postId } as unknown as Partial<TComment> } : {}),
    orderBy: [{ column: 'created_at' as keyof TComment, ascending: true }],
    pageSize: 20,
    enabled: !!postId,
    ...options,
  });
}

/**
 * useInfiniteUsers - Common pattern for paginated users
 */
export function useInfiniteUsers<TUser extends Record<string, unknown> = Record<string, unknown>>(
  options?: UseTableInfiniteQueryOptions<TUser>
) {
  return useInfiniteQuery<TUser>('users', {
    select: ['id', 'name', 'email', 'created_at'],
    orderBy: [{ column: 'created_at' as keyof TUser, ascending: false }],
    pageSize: 25,
    ...options,
  });
}

/**
 * useInfiniteSearch - Generic search with infinite scrolling
 */
export function useInfiniteSearch<TData extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string,
  searchQuery?: string,
  searchColumn?: keyof TData,
  options?: UseTableInfiniteQueryOptions<TData>
) {
  return useInfiniteQuery<TData>(tableName, {
    ...(searchQuery && searchColumn 
      ? { filters: { [searchColumn]: searchQuery } as unknown as Partial<TData> }
      : {}),
    enabled: !searchQuery || (searchQuery.length >= 2), // Only search when query is at least 2 chars
    pageSize: 15,
    ...options,
  });
}

/**
 * useInfiniteFeed - Social media style feed with infinite scrolling
 */
export function useInfiniteFeed<TFeedItem extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string = 'feed',
  userId?: string | number,
  options?: UseTableInfiniteQueryOptions<TFeedItem>
) {
  return useInfiniteQuery<TFeedItem>(tableName, {
    ...(userId ? { filters: { user_id: userId } as unknown as Partial<TFeedItem> } : {}),
    orderBy: [{ column: 'created_at' as keyof TFeedItem, ascending: false }],
    pageSize: 10,
    enabled: !!userId,
    ...options,
  });
}

/**
 * Legacy support - remove the old useInfiniteTableQuery
 * @deprecated Use useInfiniteQuery with table name instead
 */
export const useInfiniteTableQuery = useInfiniteQuery;

// Re-export types for convenience
export type {
  QueryKey,
  QueryFunction,
  InfiniteQueryOptions,
  InfiniteQueryObserverResult,
  InfiniteData,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
};