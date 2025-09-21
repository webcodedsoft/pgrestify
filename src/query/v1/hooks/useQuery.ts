/**
 * useQuery Hook
 * Query hook for PGRestify with caching and automatic refetching
 */

import { useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import { QueryObserver } from '../../core/query-observer';
import { usePGRestifyClient } from '../../react/provider';
import { 
  normalizeQueryOptions, 
  extractData, 
  extractDataArray,
  type TypeSafeQueryFunction 
} from './types';
import type {
  QueryKey,
  QueryFunction,
  QueryObserverOptions,
  QueryObserverResult,
} from '../../core/types';
import { QueryBuilder } from '@/core/query-builder';

/**
 * Helper function to create QueryOptions from PGRestify API
 */
function createPGRestifyQueryOptions<TData extends Record<string, unknown>, TError = Error>(
  client: any,
  tableName: string,
  options: UsePGRestifyQueryOptions<TData, TError>
): UseQueryOptions<TData[], TError> {
  // Generate query key
  const queryKey = options.queryKey || [
    tableName,
    'pgrestify',
    {
      select: options.select,
      relations: options.relations,
      where: options.where,
      filters: options.filters,
      order: options.order,
      limit: options.limit,
      offset: options.offset,
    }
  ];

  // Create query function
  const queryFn: QueryFunction<TData[]> = async () => {
    let query = client.from(tableName as string);

    // Handle select with relations and aliases
    if (options.select || options.relations) {
      const selectColumns = buildSelectWithRelations(options.select, options.relations);
      if (selectColumns) {
        query = query.select(selectColumns);
      }
    }

    // Apply filters
    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key as keyof TData, value);
        }
      });
    }

    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key as keyof TData, value);
        }
      });
    }

    // Apply ordering
    if (options.order) {
      if (Array.isArray(options.order)) {
        options.order.forEach(({ column, ascending = true }) => {
          query = query.order(column, { ascending });
        });
      } else {
        query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
      }
    }

    if (options.orderBy) {
      const orderClauses = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      orderClauses.forEach(clause => {
        const [column, direction] = clause.split(':');
        query = query.order(column as keyof TData, { ascending: direction !== 'desc' });
      });
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    if (options.page && options.pageSize) {
      const offset = (options.page - 1) * options.pageSize;
      query = query.limit(options.pageSize).offset(offset);
    }

    // Apply advanced options
    if (options.groupBy) {
      options.groupBy.forEach(column => {
        query = query.groupBy(column);
      });
    }

    if (options.distinct) {
      query = query.distinct();
    }

    if (options.single) {
      query = query.single();
    }

    if (options.maybeSingle) {
      query = query.maybeSingle();
    }

    if (options.count) {
      query = query.count(options.count);
    }

    const result = await query.execute();
    return extractDataArray<TData>(result);
  };

  return {
    queryKey,
    queryFn,
    enabled: options.enabled,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    refetchInterval: options.refetchInterval,
    suspense: options.suspense,
    throwOnError: options.throwOnError,
  } as UseQueryOptions<TData[], TError>;
}

/**
 * Helper function to build select clause with relations and aliases
 */
function buildSelectWithRelations(
  select?: string[],
  relations?: string[]
): string | undefined {
  const selectParts: string[] = [];

  // Add main table columns
  if (select) {
    select.forEach(column => {
      // Handle aliases: 'column AS alias' -> 'alias:column'
      const aliasMatch = column.match(/^(.+?)\s+AS\s+(.+?)$/i);
      if (aliasMatch && aliasMatch[1] && aliasMatch[2]) {
        const originalColumn = aliasMatch[1];
        const alias = aliasMatch[2];
        selectParts.push(`${alias.trim()}:${originalColumn.trim()}`);
      } else {
        selectParts.push(column);
      }
    });
  }

  // Add relations (will expand to include related table columns)
  if (relations) {
    relations.forEach(relation => {
      // For now, include all columns from related tables
      // Later we can make this more sophisticated
      selectParts.push(`${relation}(*)`);
    });
  }

  if (selectParts.length === 0 && !select && !relations) {
    return undefined; // Use default select (*)
  }

  return selectParts.join(', ');
}

// PGRestify API options (new comprehensive interface)
export interface UsePGRestifyQueryOptions<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
> {
  // Brand property to help TypeScript distinguish this interface
  readonly __brand?: 'pgrestify-query-options';
  
  // Core query configuration
  select?: string[];  // ['id', 'name', 'email', 'profile.bio', 'category.name AS category_name']
  relations?: string[];  // ['profile', 'posts', 'category']
  
  // Filtering and conditions
  where?: Partial<TData>;
  filters?: Record<string, unknown>;  // More complex filters
  
  // Ordering and pagination
  order?: { column: keyof TData | string; ascending?: boolean } | Array<{ column: keyof TData | string; ascending?: boolean }>;
  orderBy?: string | string[];  // Alternative syntax
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  
  // Advanced querying
  groupBy?: string[];
  having?: Record<string, unknown>;
  distinct?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
  
  // Query options
  queryKey?: QueryKey;
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
  
  // Advanced PostgREST options
  single?: boolean;  // .single()
  maybeSingle?: boolean;  // .maybeSingle()
  csvFormat?: boolean;  // Return CSV
  explain?: boolean;  // EXPLAIN query
  rollback?: boolean;  // Dry run
}

// Original hook options (for backward compatibility)
export interface UseQueryOptions<
  TData = unknown,
  TError = Error,
  TSelect = TData
> extends QueryObserverOptions<TData, TError, TSelect> {
  // React-specific options
  suspense?: boolean;
  throwOnError?: boolean | ((error: TError) => boolean);
  
  // PostgREST specific options
  tableName?: string;
  queryBuilder?: (builder: QueryBuilder<TData>) => QueryBuilder<TData>;
}

// Hook result type
export interface UseQueryResult<TData = unknown, TError = Error>
  extends QueryObserverResult<TData, TError> {
  // Additional React-specific properties can be added here
}

/**
 * Primary useQuery hook with function overloads for flexibility
 */

// Overload 1: PGRestify-like API (NEW - tableName + options object)
export function useQuery<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string,
  options: UsePGRestifyQueryOptions<TData, TError>
): UseQueryResult<TData[], TError>;

// Overload 2: PGRestify-like API (tableName only, no options)
export function useQuery<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string
): UseQueryResult<TData[], TError>;

// Overload 3: Object-style (original, PGRestify v5 style)
export function useQuery<
  TData = unknown,
  TError = Error,
  TSelect = TData
>(
  options: UseQueryOptions<TData, TError, TSelect>
): UseQueryResult<TSelect, TError>;

// Overload 4: Separate parameters (PGRestify v4 style)
export function useQuery<
  TData = unknown,
  TError = Error,
  TSelect = TData
>(
  queryKey: QueryKey,
  queryFn: QueryFunction<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TSelect>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelect, TError>;

// Implementation
export function useQuery<
  TData = unknown,
  TError = Error,
  TSelect = TData
>(
  arg1: string | UseQueryOptions<TData, TError, TSelect> | QueryKey,
  arg2?: UsePGRestifyQueryOptions<TData & Record<string, unknown>, TError> | QueryFunction<TData> | undefined,
  arg3?: Omit<UseQueryOptions<TData, TError, TSelect>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelect, TError> {
  const client = usePGRestifyClient();
  
  // Normalize arguments with type safety
  const options = useMemo(() => {
    // Case 1: PGRestify-like API (tableName, options)
    if (typeof arg1 === 'string' && (typeof arg2 === 'object' || arg2 === undefined)) {
      const tableName = arg1;
      const queryOptions = arg2 as UsePGRestifyQueryOptions<TData & Record<string, unknown>, TError> || {};
      
      return createPGRestifyQueryOptions(client, tableName, queryOptions) as unknown as UseQueryOptions<TData, TError, TSelect>;
    }
    
    // Case 2 & 3: Original API
    return normalizeQueryOptions<TData, TError>(arg1, arg2, arg3);
  }, [arg1, arg2, arg3, client]);

  // Validate required options
  if (!options.queryKey) {
    throw new Error('useQuery: queryKey is required');
  }
  if (!options.queryFn) {
    throw new Error('useQuery: queryFn is required');
  }

  // Create stable observer reference
  const observerRef = useRef<QueryObserver<TData, TError>>();
  
  if (!observerRef.current) {
    observerRef.current = new QueryObserver(client, options as QueryObserverOptions<TData, TError>);
  }

  const observer = observerRef.current;

  // Update observer options when they change
  const optionsRef = useRef(options);
  if (optionsRef.current !== options) {
    observer.setOptions(options as QueryObserverOptions<TData, TError>);
    optionsRef.current = options;
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
  ) as unknown as UseQueryResult<TSelect, TError>;

  // Handle suspense
  useEffect(() => {
    if (options.suspense && result.isLoading && !result.data) {
      // Suspend by throwing a promise
      throw observer.fetchOptimistic(options as QueryObserverOptions<TData, TError>);
    }
  }, [options.suspense, result.isLoading, result.data, observer, options]);

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
 * useQuery for PostgREST table queries (convenience wrapper)
 * Automatically creates queryFn using QueryBuilder
 */
export function useTableQuery<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error,
  TSelect = TData
>(
  tableName: string,
  options?: {
    queryKey?: QueryKey;
    queryBuilder?: (builder: QueryBuilder<TData>) => QueryBuilder<TData>;
    filters?: Partial<TData>;
    select?: string | string[];
    orderBy?: string;
    limit?: number;
    offset?: number;
  } & Omit<UseQueryOptions<TData[], TError, TSelect>, 'queryKey' | 'queryFn' | 'tableName'>
): UseQueryResult<TSelect, TError> {
  const client = usePGRestifyClient();

  const queryKey = useMemo(() => {
    if (options?.queryKey) return options.queryKey;
    
    // Create automatic query key
    const keyParts: any[] = [tableName];
    if (options?.filters) keyParts.push('filtered', options.filters);
    if (options?.select) keyParts.push('select', options.select);
    if (options?.orderBy) keyParts.push('order', options.orderBy);
    if (options?.limit) keyParts.push('limit', options.limit);
    if (options?.offset) keyParts.push('offset', options.offset);
    
    return keyParts;
  }, [tableName, options?.queryKey, options?.filters, options?.select, options?.orderBy, options?.limit, options?.offset]);

  const queryFn = useMemo(() => {
    return async () => {
      let query = client.from(tableName as string);

      // Apply custom query builder
      if (options?.queryBuilder) {
        query = options.queryBuilder(query);
      } else {
        // Apply standard options
        if (options?.select) {
          const selectStr = Array.isArray(options.select) 
            ? options.select.join(', ')
            : options.select;
          query = query.select(selectStr) as QueryBuilder<TData>;
        }

        if (options?.filters) {
          Object.entries(options.filters).forEach(([key, value]) => {
            if (value !== undefined) {
              query = query.eq(key as keyof TData, value);
            }
          });
        }

        if (options?.orderBy) {
          const [column, direction] = options.orderBy.split(':');
          query = query.orderBy(column as keyof TData, (direction as 'ASC' | 'DESC') || 'ASC');
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        if (options?.offset) {
          query = query.offset(options.offset);
        }
      }

      const result = await query.execute();
      return extractDataArray<TData>(result);
    };
  }, [client, tableName, options?.queryBuilder, options?.select, options?.filters, options?.orderBy, options?.limit, options?.offset]);

  return useQuery<TData[], TError, TSelect>({
    queryKey,
    queryFn,
    tableName,
    ...options,
  });
}

/**
 * useQuery for single record queries
 */
export function useSingleQuery<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error,
  TSelect = TData
>(
  tableName: string,
  id: unknown,
  options?: {
    idField?: keyof TData;
    queryBuilder?: (builder: QueryBuilder<TData>) => QueryBuilder<TData>;
    select?: string | string[];
  } & Omit<UseQueryOptions<TData, TError, TSelect>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelect, TError> {
  const client = usePGRestifyClient();
  const idField = options?.idField || 'id';

  const queryKey = useMemo(() => [tableName, 'single', idField, id], [tableName, idField, id]);

  const queryFn = useMemo(() => {
    return async () => {
      let query = client.from(tableName as string);

      if (options?.select) {
        const selectStr = Array.isArray(options.select) 
          ? options.select.join(', ')
          : options.select;
        query = query.select(selectStr) as QueryBuilder<TData>;
      }

      query = query.eq(idField as keyof TData, id as TData[keyof TData]).single();

      // Apply custom query builder
      if (options?.queryBuilder) {
        query = options.queryBuilder(query) as QueryBuilder<TData>;
      }

      const result = await query.execute();
      return extractData<TData>(result);
    };
  }, [client, tableName, idField, id, options?.select, options?.queryBuilder]);

  return useQuery<TData, TError, TSelect>({
    queryKey,
    queryFn: queryFn as TypeSafeQueryFunction<TData>,
    enabled: id !== undefined && id !== null,
    ...options,
  });
}

/**
 * Hook for RPC function calls
 */
export function useRPC<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TReturn = unknown,
  TError = Error,
  TSelect = TReturn
>(
  functionName: string,
  args?: TArgs,
  options?: Omit<UseQueryOptions<TReturn, TError, TSelect>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelect, TError> {
  const client = usePGRestifyClient();

  const queryKey = useMemo(() => ['rpc', functionName, args], [functionName, args]);

  const queryFn: TypeSafeQueryFunction<TReturn> = useMemo(() => {
    return async () => {
      const result = await client.rpc<TArgs, TReturn>(functionName, args).execute();
      return extractData<TReturn>(result);
    };
  }, [client, functionName, args]);

  return useQuery<TReturn, TError, TSelect>({
    queryKey,
    queryFn,
    ...options,
  });
}

// Export types
export type {
  QueryKey,
  QueryFunction,
  QueryObserverOptions,
  QueryObserverResult,
};