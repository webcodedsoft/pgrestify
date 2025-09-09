/**
 * Context-aware React hooks for PGRestify
 * These hooks automatically use the client from context
 */

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { QueryBuilder } from '../../types';
import { usePGRestifyClient } from './provider';
import { 
  useRawQuery as useRawQueryBase,
  useRawMutation as useRawMutationBase,
  useQueryBuilder as useQueryBuilderBase,
} from './hooks';

/**
 * Pagination type options
 */
export type PaginationType = 'offset' | 'range';

/**
 * Available mutation operations for PostgREST
 */
export enum MutationOperation {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE', 
  DELETE = 'DELETE',
  UPSERT = 'UPSERT',
}

/**
 * Type-safe mutation operation type
 */
export type MutationOperationType = keyof typeof MutationOperation;


import {
  useQuery as useQueryBase,
  useSingleQuery as useSingleQueryBase,
  useMutation as useMutationBase,
  useInsert as useInsertBase,
  useUpdate as useUpdateBase,
  useDelete as useDeleteBase,
  useUpsert as useUpsertBase,
  useAuth as useAuthBase,
  useRealtimeSubscription as useRealtimeSubscriptionBase,
  useClient as useClientBase,
  UseQueryOptions,
  UseQueryResult,
  UseSingleQueryResult,
  UseMutationOptions,
  UseMutationResult,
} from './hooks';

/**
 * Query configuration for the modern useQuery hook
 */
export interface QueryConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Table name to query */
  from: string;
  /** Columns to select - supports array with SQL aliases like ['id', 'name', 'price AS cost'] */
  select?: string | string[];
  /** Filter conditions */
  filter?: Partial<T> | Record<string, unknown>;
  /** Order configuration */
  order?: {
    column: string;
    ascending?: boolean;
  } | {
    column: string;
    ascending?: boolean;
  }[];
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Range for pagination */
  range?: [number, number];
  /** 
   * Relations to include using PostgREST embed syntax:
   * - Array: ['author', 'category', 'author.profile'] 
   * - Object: { author: true, category: true, comments: false }
   */
  relations?: string[] | Record<string, boolean>;
  /** Joins configuration (PostgREST-style) for detailed control */
  joins?: import('../../types').JoinConfig<any>[];
  /** 
   * Transform column names between camelCase (JS) and snake_case (DB)
   * Overrides the global transformColumns setting from ClientConfig
   */
  transformColumns?: boolean;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
  /** Retry on error */
  retry?: boolean | number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Cache time in milliseconds */
  cacheTime?: number;
  /** Stale time in milliseconds */
  staleTime?: number;
}

/**
 * Modern useQuery hook with object configuration (uses client from context)
 */
export function useQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  config: QueryConfig<T>
): UseQueryResult<T> {
  const client = usePGRestifyClient();
  
  const { 
    from: tableName, 
    enabled, 
    refetchInterval, 
    retry, 
    retryDelay, 
    cacheTime, 
    staleTime,
    transformColumns,
    select,
    relations,
    filter,
    order,
    limit,
    offset,
    range
  } = config;
  
  // Create stable references for objects to prevent infinite re-renders
  const stableFilter = useMemo(() => filter, [JSON.stringify(filter)]);
  const stableOrder = useMemo(() => order, [JSON.stringify(order)]);
  const stableRange = useMemo(() => range, [JSON.stringify(range)]);
  const stableSelect = useMemo(() => select, [JSON.stringify(select)]);
  const stableRelations = useMemo(() => relations, [JSON.stringify(relations)]);

  // Helper function to build select clause with relations and aliases
  const buildEnhancedSelect = useCallback((selectColumns?: string | string[], relationsList?: string[] | Record<string, boolean>) => {
    const selectParts: string[] = [];
    const relationFields = new Map<string, string[]>(); // relation -> [fields]
    const standaloneRelations = new Set<string>();
    
    // Handle select columns with alias support
    if (selectColumns) {
      const columns = Array.isArray(selectColumns) ? selectColumns : [selectColumns];
      
      columns.forEach(col => {
        if (typeof col === 'string') {
          // Handle relation field selections like 'course_category.course_id'
          if (col.includes('.') && !col.includes(' AS ')) {
            const [relationName, fieldName] = col.split('.', 2);
            if (relationName && fieldName) {
              if (!relationFields.has(relationName)) {
                relationFields.set(relationName, []);
              }
              relationFields.get(relationName)!.push(fieldName);
              return; // Don't add to regular columns
            }
          }
          
          // Handle relation field selections with aliases like 'course_category.course_id AS category_id'
          if (col.includes('.') && col.includes(' AS ')) {
            const parts = col.split(' AS ').map(s => s.trim());
            const relationPath = parts[0];
            const alias = parts[1];
            
            if (relationPath && alias) {
              const [relationName, fieldName] = relationPath.split('.', 2);
              if (relationName && fieldName) {
                if (!relationFields.has(relationName)) {
                  relationFields.set(relationName, []);
                }
                relationFields.get(relationName)!.push(`${alias}:${fieldName}`);
                return; // Don't add to regular columns
              }
            }
          }
          
          // Handle regular column aliases: 'column AS alias' -> 'alias:column'
          if (col.includes(' AS ')) {
            const [originalColumn, alias] = col.split(' AS ').map(s => s.trim());
            selectParts.push(`${alias}:${originalColumn}`);
          } else {
            selectParts.push(col);
          }
        }
      });
    } else {
      selectParts.push('*');
    }
    
    // Process relations array to identify which need full data vs specific fields
    if (relationsList && Array.isArray(relationsList)) {
      relationsList.forEach(relation => {
        if (relation && typeof relation === 'string') {
          if (!relationFields.has(relation)) {
            standaloneRelations.add(relation);
          }
        }
      });
    } else if (relationsList && typeof relationsList === 'object') {
      Object.entries(relationsList).forEach(([relation, include]) => {
        if (include && relation && !relationFields.has(relation)) {
          standaloneRelations.add(relation);
        }
      });
    }
    
    // Add relations with specific fields: relation:relation_table(field1,field2)
    relationFields.forEach((fields, relation) => {
      if (fields.length > 0) {
        selectParts.push(`${relation}:${relation}(${fields.join(',')})`);
      }
    });
    
    // Add standalone relations: relation:relation_table(*)
    standaloneRelations.forEach(relation => {
      selectParts.push(`${relation}:${relation}(*)`);
    });
    
    return selectParts.join(', ');
  }, []);

  const queryFn = useCallback((builder: QueryBuilder<T>) => {
    let query: QueryBuilder<any> = builder;
    
    // Apply enhanced select with relations and aliases
    if (stableSelect || stableRelations) {
      const enhancedSelect = buildEnhancedSelect(stableSelect, stableRelations);
      if (enhancedSelect) {
        query = query.select(enhancedSelect);
      }
    } else if (stableSelect) {
      // Fallback to simple select if no relations
      if (Array.isArray(stableSelect)) {
        query = query.select(stableSelect.join(', '));
      } else {
        query = query.select(stableSelect);
      }
    }
    
    // Apply filters
    if (stableFilter) {
      Object.entries(stableFilter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
      });
    }
    
    // Apply ordering
    if (stableOrder) {
      const orders = Array.isArray(stableOrder) ? stableOrder : [stableOrder];
      orders.forEach(({ column, ascending = true }) => {
        query = query.order(column, { ascending });
      });
    }
    
    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }
    
    // Apply offset
    if (offset) {
      query = query.offset(offset);
    }
    
    // Apply range
    if (stableRange) {
      query = query.range(stableRange[0], stableRange[1]);
    }
    
    return query;
  }, [stableSelect, stableRelations, stableFilter, stableOrder, limit, offset, stableRange, buildEnhancedSelect]);
  
  const options: UseQueryOptions = useMemo(() => ({
    ...(enabled !== undefined && { enabled }),
    ...(refetchInterval !== undefined && { refetchInterval }),
    ...(retry !== undefined && { retry }),
    ...(retryDelay !== undefined && { retryDelay }),
    ...(cacheTime !== undefined && { cacheTime }),
    ...(staleTime !== undefined && { staleTime }),
  }), [enabled, refetchInterval, retry, retryDelay, cacheTime, staleTime]);
  
  // Create QueryBuilder with transformColumns option - memoized to prevent re-renders
  const queryOptions = useMemo(() => 
    transformColumns !== undefined ? { transformColumns } : undefined,
    [transformColumns]
  );
  
  return useQueryBase(client, tableName, queryFn, options, queryOptions);
}

/**
 * Legacy useQuery hook for backward compatibility (uses client from context)
 */
export function useQueryLegacy<T extends Record<string, unknown>>(
  tableName: string,
  queryFn?: (builder: QueryBuilder<T>) => QueryBuilder<T>,
  options?: UseQueryOptions
): UseQueryResult<T> {
  const client = usePGRestifyClient();
  return useQueryBase(client, tableName, queryFn, options);
}

/**
 * Hook for querying a single record (uses client from context)
 */
export function useSingleQuery<T extends Record<string, unknown>>(
  tableName: string,
  queryFn?: (builder: QueryBuilder<T>) => QueryBuilder<T>,
  options?: UseQueryOptions
): UseSingleQueryResult<T> {
  const client = usePGRestifyClient();
  return useSingleQueryBase(client, tableName, queryFn, options);
}

/**
 * Hook for mutations (uses client from context)
 * Supports both custom mutation functions and typed operations
 */
export function useMutation<T extends Record<string, unknown>, TVariables = Partial<T>>(
  tableName: string,
  mutationFnOrOptions?: 
    | ((variables: TVariables, builder: QueryBuilder<T>) => Promise<any>)
    | (UseMutationOptions<T> & { operation?: MutationOperationType }),
  options?: UseMutationOptions<T>
): UseMutationResult<T, TVariables> {
  const client = usePGRestifyClient();
  
  // Check if first parameter is options with operation (new typed API)
  if (typeof mutationFnOrOptions === 'object' && mutationFnOrOptions && 'operation' in mutationFnOrOptions) {
    const { operation, ...mutationOptions } = mutationFnOrOptions;
    
    // Use the appropriate specific hook based on operation
    switch (operation) {
      case MutationOperation.INSERT:
        return useInsert<T>(tableName, mutationOptions) as UseMutationResult<T, TVariables>;
      case MutationOperation.UPDATE:
        return useUpdate<T>(tableName, mutationOptions) as UseMutationResult<T, TVariables>;
      case MutationOperation.DELETE:
        return useDelete<T>(tableName, mutationOptions) as UseMutationResult<T, TVariables>;
      case MutationOperation.UPSERT:
        return useUpsert<T>(tableName, mutationOptions) as UseMutationResult<T, TVariables>;
      default:
        throw new Error(`Unknown mutation operation: ${operation}`);
    }
  }
  
  // Original API - custom mutation function
  if (typeof mutationFnOrOptions === 'function') {
    return useMutationBase(client, tableName, mutationFnOrOptions, options);
  }
  
  // If no mutation function provided, throw error
  throw new Error('useMutation requires either a mutation function or an operation type');
}

/**
 * Hook for insert mutations (uses client from context)
 */
export function useInsert<T extends Record<string, unknown>>(
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, Partial<T> | Partial<T>[]> {
  const client = usePGRestifyClient();
  return useInsertBase(client, tableName, options);
}

/**
 * Hook for update mutations (uses client from context)
 */
export function useUpdate<T extends Record<string, unknown>>(
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, { values: Partial<T>; where: Partial<T> }> {
  const client = usePGRestifyClient();
  return useUpdateBase(client, tableName, options);
}

/**
 * Hook for delete mutations (uses client from context)
 */
export function useDelete<T extends Record<string, unknown>>(
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, Partial<T>> {
  const client = usePGRestifyClient();
  return useDeleteBase(client, tableName, options);
}

/**
 * Hook for upsert mutations (uses client from context)
 */
export function useUpsert<T extends Record<string, unknown>>(
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, Partial<T> | Partial<T>[]> {
  const client = usePGRestifyClient();
  return useUpsertBase(client, tableName, options);
}


/**
 * Context-aware infinite query configuration interface
 */
export interface InfiniteQueryConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  // Query configuration (same as useQuery)
  select?: string | string[];
  relations?: string[] | Record<string, boolean>;
  filter?: Partial<T> | Record<string, unknown>;
  order?: {
    column: string;
    ascending?: boolean;
  } | {
    column: string;
    ascending?: boolean;
  }[];
  
  // Pagination configuration
  limit?: number;
  pageSize?: number;
  paginationType?: PaginationType;
  
  /** 
   * Transform column names between camelCase (JS) and snake_case (DB)
   * Overrides the global transformColumns setting from ClientConfig
   */
  transformColumns?: boolean;
  
  // TanStack Query options
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number;
  
  // Infinite Query specific options
  getNextPageParam?: (lastPage: T[], allPages: T[][], lastPageParam?: unknown, allPageParams?: unknown[]) => unknown;
  getPreviousPageParam?: (firstPage: T[], allPages: T[][], firstPageParam?: unknown, allPageParams?: unknown[]) => unknown;
  initialPageParam?: unknown;
}

/**
 * Context-aware infinite query hook for pagination (uses client from context)
 * This provides proper infinite query functionality with pagination
 */
export function useInfiniteQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string,
  config?: InfiniteQueryConfig<T>
) {
  const client = usePGRestifyClient();
  
  // Memoize configuration to prevent re-renders
  const memoizedConfig = useMemo(() => config || {}, [config]);
  
  const { 
    filter,
    select,
    relations,
    order,
    limit,
    pageSize,
    transformColumns,
    enabled = true,
    paginationType = 'offset',
    getNextPageParam,
    getPreviousPageParam,
    initialPageParam,
  } = memoizedConfig;
  
  // Note: staleTime and gcTime are not used in this implementation
  // They would be used in a full TanStack Query integration

  // Use pageSize if provided, otherwise use limit, otherwise default to 20
  const actualPageSize = useMemo(() => pageSize || limit || 20, [pageSize, limit]);
  
  // Smart default for initialPageParam based on pagination type
  const actualInitialPageParam = useMemo(() => {
    if (initialPageParam !== undefined) {
      return initialPageParam;
    }
    
    // Default values for offset and range pagination
    return 0; // Both offset and range start at 0
  }, [initialPageParam]);
  
  // State management for infinite query
  const [pages, setPages] = useState<T[][]>([]);
  const [pageParams, setPageParams] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isFetchingPreviousPage, setIsFetchingPreviousPage] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialized = useRef(false);
  
  // Build enhanced select with relations
  const buildEnhancedSelect = useMemo(() => {
    return (selectColumns?: string | string[], relationsList?: string[] | Record<string, boolean>) => {
      const selectParts: string[] = [];
      const relationFields = new Map<string, string[]>();
      const standaloneRelations = new Set<string>();
      
      // Handle select columns with relation field support
      if (selectColumns) {
        const columns = Array.isArray(selectColumns) ? selectColumns : [selectColumns];
        
        columns.forEach(col => {
          if (typeof col === 'string') {
            // Handle relation field selections like 'course_category.course_id'
            if (col.includes('.') && !col.includes(' AS ')) {
              const [relationName, fieldName] = col.split('.', 2);
              if (relationName && fieldName) {
                if (!relationFields.has(relationName)) {
                  relationFields.set(relationName, []);
                }
                relationFields.get(relationName)!.push(fieldName);
                return;
              }
            }
            
            // Handle relation field selections with aliases
            if (col.includes('.') && col.includes(' AS ')) {
              const parts = col.split(' AS ').map(s => s.trim());
              const relationPath = parts[0];
              const alias = parts[1];
              
              if (relationPath && alias) {
                const [relationName, fieldName] = relationPath.split('.', 2);
                if (relationName && fieldName) {
                  if (!relationFields.has(relationName)) {
                    relationFields.set(relationName, []);
                  }
                  relationFields.get(relationName)!.push(`${alias}:${fieldName}`);
                  return;
                }
              }
            }
            
            // Handle regular column aliases
            if (col.includes(' AS ')) {
              const [originalColumn, alias] = col.split(' AS ').map(s => s.trim());
              selectParts.push(`${alias}:${originalColumn}`);
            } else {
              selectParts.push(col);
            }
          }
        });
      } else {
        selectParts.push('*');
      }
      
      // Process relations array
      if (relationsList && Array.isArray(relationsList)) {
        relationsList.forEach(relation => {
          if (relation && typeof relation === 'string') {
            if (!relationFields.has(relation)) {
              standaloneRelations.add(relation);
            }
          }
        });
      } else if (relationsList && typeof relationsList === 'object') {
        Object.entries(relationsList).forEach(([relation, include]) => {
          if (include && relation && !relationFields.has(relation)) {
            standaloneRelations.add(relation);
          }
        });
      }
      
      // Add relations with specific fields
      relationFields.forEach((fields, relation) => {
        if (fields.length > 0) {
          selectParts.push(`${relation}:${relation}(${fields.join(',')})`);
        }
      });
      
      // Add standalone relations
      standaloneRelations.forEach(relation => {
        selectParts.push(`${relation}:${relation}(*)`);
      });
      
      return selectParts.join(', ');
    };
  }, []);

  // Memoize queryOptions to prevent re-renders
  const queryOptions = useMemo(() => 
    transformColumns !== undefined ? { transformColumns } : undefined,
    [transformColumns]
  );

  // Fetch function
  const fetchPage = useCallback(async (pageParam: unknown = initialPageParam): Promise<T[]> => {
    let query = client.from<T>(tableName, queryOptions);

    // Apply enhanced select with relations
    if (select || relations) {
      const enhancedSelect = buildEnhancedSelect(select, relations);
      if (enhancedSelect) {
        query = query.select(enhancedSelect) as any;
      }
    }

    // Apply filters
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
      });
    }

    // Apply ordering
    if (order) {
      const orders = Array.isArray(order) ? order : [order];
      orders.forEach(({ column, ascending = true }) => {
        query = query.order(column, { ascending });
      });
    }

    // Apply pagination based on type
    if (paginationType === 'offset') {
      const offset = typeof pageParam === 'number' ? pageParam * actualPageSize : 0;
      query = query.limit(actualPageSize).offset(offset);
    } else if (paginationType === 'range') {
      const from = typeof pageParam === 'number' ? pageParam * actualPageSize : 0;
      const to = from + actualPageSize - 1;
      query = query.range(from, to);
    } else {
      // Default to offset pagination
      const offset = typeof pageParam === 'number' ? pageParam * actualPageSize : 0;
      query = query.limit(actualPageSize).offset(offset);
    }

    const result = await query.execute();
    return Array.isArray(result.data) ? result.data : [];
  }, [
    client,
    tableName,
    select,
    relations,
    filter,
    order,
    actualPageSize,
    paginationType,
    actualInitialPageParam,
    queryOptions,
    buildEnhancedSelect
  ]);

  // Auto-calculated getNextPageParam function based on pageSize
  const autoGetNextPageParam = useCallback((lastPage: T[], allPages: T[][]) => {
    // If last page has fewer items than pageSize, we've reached the end
    if (!lastPage || lastPage.length < actualPageSize) {
      return undefined; // No more pages
    }

    if (paginationType === 'offset') {
      // For offset pagination: next page = current page count (0-based indexing)
      return allPages.length;
    } else if (paginationType === 'range') {
      // For range pagination: calculate next range start
      const totalItems = allPages.flat().length;
      return totalItems; // Next range starts at total items count
    } else {
      // Default to offset pagination logic
      return allPages.length;
    }
  }, [actualPageSize, paginationType]);

  // Initial fetch
  const initialFetch = useCallback(async () => {
    if (!enabled || hasInitialized.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const firstPage = await fetchPage(actualInitialPageParam);
      setPages([firstPage]);
      setPageParams([actualInitialPageParam]);
      hasInitialized.current = true;
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fetchPage, actualInitialPageParam]);

  // Fetch next page
  const fetchNextPage = useCallback(async () => {
    if (isFetchingNextPage || pages.length === 0) return;
    
    const lastPage = pages[pages.length - 1];
    const lastPageParam = pageParams[pageParams.length - 1];
    
    if (!lastPage) return;
    
    let nextPageParam;
    if (getNextPageParam) {
      // Use user-provided getNextPageParam if specified
      nextPageParam = getNextPageParam(lastPage, pages, lastPageParam, pageParams);
    } else {
      // Use our auto-calculated getNextPageParam based on pageSize
      nextPageParam = autoGetNextPageParam(lastPage, pages);
    }
    
    if (nextPageParam === undefined || nextPageParam === null) return;
    
    setIsFetchingNextPage(true);
    setError(null);
    
    try {
      const newPage = await fetchPage(nextPageParam);
      setPages(prev => [...prev, newPage]);
      setPageParams(prev => [...prev, nextPageParam]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [
    isFetchingNextPage,
    pages,
    pageParams,
    getNextPageParam,
    autoGetNextPageParam,
    fetchPage
  ]);

  // Fetch previous page
  const fetchPreviousPage = useCallback(async () => {
    if (isFetchingPreviousPage || pages.length <= 1) return;
    
    // If user provides custom getPreviousPageParam, use it to fetch a new page
    if (getPreviousPageParam) {
      const firstPage = pages[0];
      const firstPageParam = pageParams[0];
      
      if (!firstPage) return;
      
      const previousPageParam = getPreviousPageParam(firstPage, pages, firstPageParam, pageParams);
      
      if (previousPageParam === undefined || previousPageParam === null) return;
      
      setIsFetchingPreviousPage(true);
      setError(null);
      
      try {
        const newPage = await fetchPage(previousPageParam);
        setPages(prev => [newPage, ...prev]);
        setPageParams(prev => [previousPageParam, ...prev]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsFetchingPreviousPage(false);
      }
    } else {
      // Default behavior: remove the last page (go back in the infinite scroll)
      setPages(prev => prev.slice(0, -1));
      setPageParams(prev => prev.slice(0, -1));
    }
  }, [
    isFetchingPreviousPage,
    pages,
    pageParams,
    getPreviousPageParam,
    fetchPage
  ]);

  // Refetch
  const refetch = useCallback(async () => {
    setPages([]);
    setPageParams([]);
    hasInitialized.current = false;
    await initialFetch();
  }, [initialFetch]);

  // Run initial fetch
  useEffect(() => {
    initialFetch();
  }, [initialFetch]);

  // Compute derived state
  const hasNextPage = useMemo(() => {
    if (pages.length === 0) return true;
    
    const lastPage = pages[pages.length - 1];
    const lastPageParam = pageParams[pageParams.length - 1];
    
    if (!lastPage) return false;
    
    let nextPageParam;
    if (getNextPageParam) {
      // Use user-provided getNextPageParam if specified
      nextPageParam = getNextPageParam(lastPage, pages, lastPageParam, pageParams);
    } else {
      // Use our auto-calculated getNextPageParam based on pageSize
      nextPageParam = autoGetNextPageParam(lastPage, pages);
    }
    
    return nextPageParam !== undefined && nextPageParam !== null;
  }, [pages, pageParams, getNextPageParam, autoGetNextPageParam]);

  const hasPreviousPage = useMemo(() => {
    // For infinite queries, there's a previous page if we've loaded more than the first page
    if (pages.length <= 1) return false;
    
    // If user provides custom getPreviousPageParam, use it
    if (getPreviousPageParam) {
      const firstPage = pages[0];
      const firstPageParam = pageParams[0];
      
      if (!firstPage) return false;
      
      const previousPageParam = getPreviousPageParam(firstPage, pages, firstPageParam, pageParams);
      return previousPageParam !== undefined && previousPageParam !== null;
    }
    
    // Default: if we have more than 1 page loaded, we can go back
    return true;
  }, [pages, pageParams, getPreviousPageParam]);

  const data = useMemo(() => {
    if (pages.length === 0) return undefined;
    return {
      pages,
      pageParams
    };
  }, [pages, pageParams]);

  // Comprehensive pagination metadata
  const meta = useMemo(() => {
    const currentPage = pages.length > 0 ? pages.length : 0;
    const totalItemCount = pages.reduce((total, page) => total + page.length, 0);
    const itemsPerPage = actualPageSize;
    const lastPage = pages.length > 0 ? pages[pages.length - 1] : null;
    const isLastPagePartial = lastPage ? lastPage.length < actualPageSize : false;
    const estimatedTotalPages = hasNextPage 
      ? currentPage + 1 // At least one more page
      : currentPage; // This is the last page
    
    const currentPageItems = lastPage ? lastPage.length : 0;
    const firstItemIndex = Math.max(0, (currentPage - 1) * actualPageSize + 1);
    const lastItemIndex = totalItemCount;
    
    return {
      // Basic pagination info
      limit: itemsPerPage,
      pageSize: itemsPerPage,
      page: currentPage,
      currentPage,
      totalPages: estimatedTotalPages,
      estimatedTotalPages,
      
      // Item counts
      totalItemCount,
      itemsPerPage,
      currentPageItems,
      itemsInCurrentPage: currentPageItems,
      
      // Range info
      firstItemIndex,
      lastItemIndex,
      itemRange: totalItemCount > 0 ? `${firstItemIndex}-${lastItemIndex}` : '0-0',
      
      // Page state flags
      hasNextPage,
      hasPreviousPage,
      isFirstPage: currentPage <= 1,
      isLastPage: !hasNextPage,
      isLastPagePartial,
      isEmpty: totalItemCount === 0,
      
      // Loading states
      isLoading,
      isFetchingNextPage,
      isFetchingPreviousPage,
      isInitialLoading: isLoading && pages.length === 0,
      
      // Actions
      fetchNextPage,
      fetchPreviousPage,
      refetch,
      
      // Pagination type info
      paginationType,
      
      // Current page param
      currentPageParam: pageParams.length > 0 ? pageParams[pageParams.length - 1] : actualInitialPageParam,
      
      // All page params (useful for debugging)
      allPageParams: pageParams,
    };
  }, [
    pages,
    pageParams,
    actualPageSize,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    refetch,
    paginationType,
    actualInitialPageParam
  ]);

  return {
    data,
    isLoading,
    isError: !!error,
    error,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    refetch,
    // Additional TanStack Query compatible properties
    isInitialLoading: isLoading && pages.length === 0,
    isSuccess: !error && pages.length > 0,
    status: error ? 'error' : pages.length > 0 ? 'success' : isLoading ? 'loading' : 'idle',
    // Comprehensive pagination metadata
    meta,
  };
}

/**
 * Hook for authentication state (uses client from context)
 */
export function useAuth() {
  const client = usePGRestifyClient();
  return useAuthBase(client);
}

/**
 * Hook for real-time subscriptions (uses client from context)
 */
export function useRealtimeSubscription(
  tableName: string,
  callback: (payload: any) => void,
  eventType: import('../../types').RealtimeEvent | 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*'
) {
  const client = usePGRestifyClient();
  return useRealtimeSubscriptionBase(client, tableName, callback, eventType);
}

/**
 * Hook for client utilities (uses client from context)
 */
export function useClient() {
  const client = usePGRestifyClient();
  return useClientBase(client);
}

/**
 * Hook for repository pattern (uses client from context)
 */
export function useRepository(tableName: string) {
  const client = usePGRestifyClient();
  
  return {
    repository: client.getRepository(tableName),
    client,
  };
}

/**
 * Hook for executing raw PostgREST queries (uses client from context)
 */
export function useRawQuery<T = unknown>(
  path: string,
  options?: import('../../types').RawQueryOptions & import('./hooks').UseQueryOptions
) {
  const client = usePGRestifyClient();
  return useRawQueryBase<T>(client, path, options);
}

/**
 * Hook for executing raw mutations (uses client from context)
 */
export function useRawMutation<TData = unknown, TVariables = unknown>(
  path: string,
  options?: import('../../types').RawQueryOptions
) {
  const client = usePGRestifyClient();
  return useRawMutationBase<TData, TVariables>(client, path, options);
}

/**
 * Hook for executing a pre-built QueryBuilder (uses client from context)
 * This hook accepts a QueryBuilder instance directly, perfect for complex queries
 * built using the QueryBuilder API with method chaining.
 * 
 * @example
 * ```tsx
 * const query = client
 *   .from<Course>('course')
 *   .where('published', 'eq', true)
 *   .rawSelect('id,title,final_price,course_category(name)')
 *   .limit(5);
 * 
 * const { data, error, isLoading } = useQueryBuilder(query);
 * ```
 */
export function useQueryBuilder<T extends Record<string, unknown>>(
  queryBuilder: QueryBuilder<T>,
  options?: UseQueryOptions
) {
  return useQueryBuilderBase<T>(queryBuilder, options);
}