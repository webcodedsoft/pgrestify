/**
 * TanStack Query integration for PGRestify
 * 
 * @example Basic usage
 * ```tsx
 * import { useQuery } from '@tanstack/react-query';
 * import { createPostgRESTQueries } from 'pgrestify/tanstack-query';
 * import { createClient } from 'pgrestify';
 * 
 * const client = createClient({ url: 'http://localhost:3000' });
 * const queries = createPostgRESTQueries(client, 'users');
 * 
 * function UserList() {
 *   const { data: users, isLoading, error } = useQuery({
 *     ...queries.list({ active: true })
 *   });
 * 
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   return (
 *     <div>
 *       {users?.data?.map(user => (
 *         <div key={user.id}>{user.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example Enhanced usage with select array and aliases
 * ```tsx
 * import { useQuery } from '@tanstack/react-query';
 * import { createPostgRESTQueries } from 'pgrestify/tanstack-query';
 * import { createClient } from 'pgrestify';
 * 
 * const client = createClient({ url: 'http://localhost:3000' });
 * const userQueries = createPostgRESTQueries(client, 'users');
 * 
 * function UserProfile({ userId }: { userId: string }) {
 *   // Using enhanced query with select array and aliases
 *   const { data: user, isLoading } = useQuery({
 *     ...userQueries.detailWithOptions(userId, {
 *       selectColumns: ['id', 'first_name AS firstName', 'last_name AS lastName', 'email'],
 *     })
 *   });
 * 
 *   const { data: users } = useQuery({
 *     ...userQueries.listWithOptions({
 *       selectColumns: ['id', 'first_name AS firstName', 'created_at AS createdAt'],
 *       filters: { active: true, role: 'admin' },
 *       orderBy: [{ column: 'created_at', ascending: false }],
 *       limit: 50
 *     })
 *   });
 * 
 *   if (isLoading) return <div>Loading...</div>;
 * 
 *   return (
 *     <div>
 *       <h1>{user?.data?.firstName} {user?.data?.lastName}</h1>
 *       <p>Email: {user?.data?.email}</p>
 *     </div>
 *   );
 * }
 * ```
 */

// Runtime check for TanStack Query availability
try {
  require('@tanstack/react-query');
} catch {
  throw new Error(
    'PGRestify TanStack Query adapter requires @tanstack/react-query to be installed. ' +
    'Please install it: npm install @tanstack/react-query'
  );
}

import type {
  QueryKey,
  UseMutationOptions as TanStackMutationOptions,
  UseQueryOptions as TanStackQueryOptions,
  MutationFunction,
  QueryFunction,
} from '@tanstack/react-query';

import type {
  PostgRESTClient,
  QueryBuilder,
  QueryResponse,
  SingleQueryResponse,
} from '../../types';

/**
 * Query key factory for consistent cache management
 */
export function createQueryKeys(baseKey: string = 'pgrestify') {
  return {
    all: () => [baseKey] as const,
    tables: () => [...createQueryKeys(baseKey).all(), 'tables'] as const,
    table: (name: string) => [...createQueryKeys(baseKey).tables(), name] as const,
    tableData: (name: string, filters?: Record<string, unknown>) => [
      ...createQueryKeys(baseKey).table(name),
      'data',
      filters,
    ] as const,
    tableItem: (name: string, id: string | number) => [
      ...createQueryKeys(baseKey).table(name),
      'item',
      id,
    ] as const,
    rpc: (name: string, args?: Record<string, unknown>) => [
      ...createQueryKeys(baseKey).all(),
      'rpc',
      name,
      args,
    ] as const,
  };
}

/**
 * Default query keys instance
 */
export const queryKeys = createQueryKeys();

/**
 * Options for enhanced queries with select support
 */
export interface QueryEnhancementOptions {
  /** Select specific columns, supports aliases like ['id', 'first_name AS firstName'] */
  selectColumns?: string | string[];
  /** Additional filters to apply */
  filters?: Record<string, unknown>;
  /** Custom ordering */
  orderBy?: { column: string; ascending?: boolean }[];
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Query function factory for PostgREST queries
 */
export function createQueryFunction<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  queryBuilder?: (builder: QueryBuilder<T>) => QueryBuilder<T>
): QueryFunction<QueryResponse<T>, QueryKey> {
  return async () => {
    let query = client.from<T>(tableName);
    
    if (queryBuilder) {
      query = queryBuilder(query);
    }
    
    const result = await query.execute();
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result;
  };
}

/**
 * Enhanced query function factory with built-in select and filtering support
 */
export function createEnhancedQueryFunction<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  options?: QueryEnhancementOptions,
  queryBuilder?: (builder: QueryBuilder<T>) => QueryBuilder<T>
): QueryFunction<QueryResponse<T>, QueryKey> {
  return async () => {
    let query = client.from<T>(tableName);
    
    // Apply select if provided
    if (options?.selectColumns) {
      if (Array.isArray(options.selectColumns)) {
        query = query.select(options.selectColumns.join(', ')) as QueryBuilder<T>;
      } else {
        query = query.select(options.selectColumns) as QueryBuilder<T>;
      }
    }
    
    // Apply filters if provided
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key as keyof T, value);
      }
    }
    
    // Apply ordering if provided
    if (options?.orderBy) {
      for (const orderConfig of options.orderBy) {
        query = query.order(orderConfig.column as keyof T, {
          ascending: orderConfig.ascending !== false
        });
      }
    }
    
    // Apply limit if provided
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    // Apply offset if provided
    if (options?.offset) {
      query = query.offset(options.offset);
    }
    
    // Apply custom query builder if provided
    if (queryBuilder) {
      query = queryBuilder(query);
    }
    
    const result = await query.execute();
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result;
  };
}

/**
 * Single query function factory
 */
export function createSingleQueryFunction<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  queryBuilder?: (builder: QueryBuilder<T>) => QueryBuilder<T>
): QueryFunction<SingleQueryResponse<T>, QueryKey> {
  return async () => {
    let query = client.from<T>(tableName);
    
    if (queryBuilder) {
      query = queryBuilder(query);
    }
    
    const result = await query.single().execute() as SingleQueryResponse<T>;
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result;
  };
}

/**
 * Enhanced single query function factory with built-in select and filtering support
 */
export function createEnhancedSingleQueryFunction<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  options?: QueryEnhancementOptions,
  queryBuilder?: (builder: QueryBuilder<T>) => QueryBuilder<T>
): QueryFunction<SingleQueryResponse<T>, QueryKey> {
  return async () => {
    let query = client.from<T>(tableName);
    
    // Apply select if provided
    if (options?.selectColumns) {
      if (Array.isArray(options.selectColumns)) {
        query = query.select(options.selectColumns.join(', ')) as QueryBuilder<T>;
      } else {
        query = query.select(options.selectColumns) as QueryBuilder<T>;
      }
    }
    
    // Apply filters if provided
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key as keyof T, value);
      }
    }
    
    // Apply ordering if provided
    if (options?.orderBy) {
      for (const orderConfig of options.orderBy) {
        query = query.order(orderConfig.column as keyof T, {
          ascending: orderConfig.ascending !== false
        });
      }
    }
    
    // Apply custom query builder if provided
    if (queryBuilder) {
      query = queryBuilder(query);
    }
    
    const result = await query.single().execute() as SingleQueryResponse<T>;
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result;
  };
}

/**
 * Mutation function factory for PostgREST mutations
 */
export function createMutationFunction<T extends Record<string, unknown>, TVariables>(
  client: PostgRESTClient,
  tableName: string,
  mutationBuilder: (variables: TVariables, builder: QueryBuilder<T>) => QueryBuilder<T>
): MutationFunction<QueryResponse<T>, TVariables> {
  return async (variables: TVariables) => {
    const query = mutationBuilder(variables, client.from<T>(tableName));
    const result = await query.execute();
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result;
  };
}

/**
 * Pre-built query options for common operations
 */
export function createPostgRESTQueries<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string
) {
  const keys = createQueryKeys();
  
  return {
    // List all records
    list: (filters?: Partial<T>): TanStackQueryOptions<QueryResponse<T>, Error> => ({
      queryKey: keys.tableData(tableName, filters),
      queryFn: createQueryFunction(client, tableName, (query) => {
        if (filters) {
          let filteredQuery = query;
          for (const [key, value] of Object.entries(filters)) {
            filteredQuery = filteredQuery.eq(key as keyof T, value);
          }
          return filteredQuery;
        }
        return query;
      }),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

    // Enhanced list with select array support and other options
    listWithOptions: (
      options?: QueryEnhancementOptions & { keyExtension?: string[] }
    ): TanStackQueryOptions<QueryResponse<T>, Error> => ({
      queryKey: [...keys.tableData(tableName, options?.filters), ...(options?.keyExtension || [])],
      queryFn: createEnhancedQueryFunction(client, tableName, options),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

    // Get single record by ID
    detail: (id: string | number): TanStackQueryOptions<SingleQueryResponse<T>, Error> => ({
      queryKey: keys.tableItem(tableName, id),
      queryFn: createSingleQueryFunction(client, tableName, (query) =>
        query.eq('id' as keyof T, id as T[keyof T])
      ),
      staleTime: 10 * 60 * 1000, // 10 minutes
    }),

    // Enhanced detail with select array support
    detailWithOptions: (
      id: string | number,
      options?: QueryEnhancementOptions
    ): TanStackQueryOptions<SingleQueryResponse<T>, Error> => ({
      queryKey: [...keys.tableItem(tableName, id), 'enhanced', options?.selectColumns],
      queryFn: createEnhancedSingleQueryFunction(client, tableName, options, (query) =>
        query.eq('id' as keyof T, id as T[keyof T])
      ),
      staleTime: 10 * 60 * 1000, // 10 minutes
    }),

    // Get single record with custom query
    single: (
      queryBuilder: (builder: QueryBuilder<T>) => QueryBuilder<T>,
      keyExtension?: string[]
    ): TanStackQueryOptions<SingleQueryResponse<T>, Error> => ({
      queryKey: [...keys.table(tableName), 'single', ...(keyExtension || [])],
      queryFn: createSingleQueryFunction(client, tableName, queryBuilder),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

    // Enhanced single with select array support
    singleWithOptions: (
      options?: QueryEnhancementOptions,
      queryBuilder?: (builder: QueryBuilder<T>) => QueryBuilder<T>,
      keyExtension?: string[]
    ): TanStackQueryOptions<SingleQueryResponse<T>, Error> => ({
      queryKey: [...keys.table(tableName), 'single-enhanced', options?.selectColumns, ...(keyExtension || [])],
      queryFn: createEnhancedSingleQueryFunction(client, tableName, options, queryBuilder),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

    // Custom query
    custom: (
      queryBuilder: (builder: QueryBuilder<T>) => QueryBuilder<T>,
      keyExtension: string[]
    ): TanStackQueryOptions<QueryResponse<T>, Error> => ({
      queryKey: [...keys.table(tableName), 'custom', ...keyExtension],
      queryFn: createQueryFunction(client, tableName, queryBuilder),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

    // Enhanced custom query with select array support
    customWithOptions: (
      options?: QueryEnhancementOptions,
      queryBuilder?: (builder: QueryBuilder<T>) => QueryBuilder<T>,
      keyExtension?: string[]
    ): TanStackQueryOptions<QueryResponse<T>, Error> => ({
      queryKey: [...keys.table(tableName), 'custom-enhanced', options?.selectColumns, ...(keyExtension || [])],
      queryFn: createEnhancedQueryFunction(client, tableName, options, queryBuilder),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  };
}

/**
 * Pre-built mutation options for common operations
 */
export function createPostgRESTMutations<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string
) {
  return {
    // Insert mutation
    insert: (
      options?: Omit<TanStackMutationOptions<QueryResponse<T>, Error, Partial<T> | Partial<T>[]>, 'mutationFn'>
    ): TanStackMutationOptions<QueryResponse<T>, Error, Partial<T> | Partial<T>[]> => ({
      mutationFn: createMutationFunction(client, tableName, (values, builder) =>
        builder.insert(values).select('*') as QueryBuilder<T>
      ),
      ...options,
    }),

    // Update mutation
    update: (
      options?: Omit<TanStackMutationOptions<QueryResponse<T>, Error, { values: Partial<T>; where: Partial<T> }>, 'mutationFn'>
    ): TanStackMutationOptions<QueryResponse<T>, Error, { values: Partial<T>; where: Partial<T> }> => ({
      mutationFn: createMutationFunction(client, tableName, ({ values, where }, builder) => {
        let query = builder.update(values);
        for (const [key, value] of Object.entries(where)) {
          query = query.eq(key as keyof T, value);
        }
        return query.select('*') as QueryBuilder<T>;
      }),
      ...options,
    }),

    // Delete mutation
    delete: (
      options?: Omit<TanStackMutationOptions<QueryResponse<T>, Error, Partial<T>>, 'mutationFn'>
    ): TanStackMutationOptions<QueryResponse<T>, Error, Partial<T>> => ({
      mutationFn: createMutationFunction(client, tableName, (where, builder) => {
        let query = builder.delete();
        for (const [key, value] of Object.entries(where)) {
          query = query.eq(key as keyof T, value);
        }
        return query;
      }),
      ...options,
    }),

    // Upsert mutation
    upsert: (
      options?: Omit<TanStackMutationOptions<QueryResponse<T>, Error, Partial<T> | Partial<T>[]>, 'mutationFn'>
    ): TanStackMutationOptions<QueryResponse<T>, Error, Partial<T> | Partial<T>[]> => ({
      mutationFn: createMutationFunction(client, tableName, (values, builder) =>
        builder.upsert(values).select('*') as QueryBuilder<T>
      ),
      ...options,
    }),
  };
}

/**
 * Create a complete query and mutation factory for a table
 */
export function createTableQueries<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string
) {
  return {
    queries: createPostgRESTQueries<T>(client, tableName),
    mutations: createPostgRESTMutations<T>(client, tableName),
    keys: createQueryKeys(),
  };
}

/**
 * RPC query options factory
 */
export function createRPCQuery<TArgs extends Record<string, unknown> | undefined = Record<string, unknown>, TReturn = unknown>(
  client: PostgRESTClient,
  functionName: string,
  args?: TArgs
): TanStackQueryOptions<QueryResponse<TReturn>, Error> {
  const keys = createQueryKeys();
  
  return {
    queryKey: keys.rpc(functionName, args as Record<string, unknown> | undefined),
    queryFn: async () => {
      const result = await client.rpc<TArgs, TReturn>(functionName, args).execute();
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  };
}

/**
 * Utility to invalidate queries for a specific table
 */
export function createInvalidationHelpers(tableName: string) {
  const keys = createQueryKeys();
  
  return {
    invalidateTable: () => keys.table(tableName),
    invalidateList: () => keys.tableData(tableName),
    invalidateItem: (id: string | number) => keys.tableItem(tableName, id),
    invalidateAll: () => keys.all(),
  };
}

/**
 * Cache optimization utilities
 */
export function createCacheHelpers<T extends Record<string, unknown>>(tableName: string) {
  const keys = createQueryKeys();
  
  return {
    // Update cache after mutation
    updateListCache: (
      queryClient: any,
      updater: (oldData: QueryResponse<T> | undefined) => QueryResponse<T> | undefined
    ) => {
      queryClient.setQueriesData(
        { queryKey: keys.table(tableName), type: 'active' },
        updater
      );
    },

    // Add item to list cache
    addToListCache: (queryClient: any, newItem: T) => {
      queryClient.setQueriesData(
        { queryKey: keys.table(tableName), type: 'active' },
        (oldData: QueryResponse<T> | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: [...(oldData.data || []), newItem],
          };
        }
      );
    },

    // Remove item from list cache
    removeFromListCache: (queryClient: any, itemId: string | number) => {
      queryClient.setQueriesData(
        { queryKey: keys.table(tableName), type: 'active' },
        (oldData: QueryResponse<T> | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: (oldData.data || []).filter((item: any) => item.id !== itemId),
          };
        }
      );
    },

    // Update item in list cache
    updateInListCache: (queryClient: any, itemId: string | number, updatedItem: Partial<T>) => {
      queryClient.setQueriesData(
        { queryKey: keys.table(tableName), type: 'active' },
        (oldData: QueryResponse<T> | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: (oldData.data || []).map((item: any) =>
              item.id === itemId ? { ...item, ...updatedItem } : item
            ),
          };
        }
      );
    },
  };
}

/**
 * Export commonly used types for better TypeScript support
 */

export type {
  QueryKey,
  QueryFunction,
  MutationFunction,
  UseQueryOptions as UseQueryOptionsFromTanStack,
  UseMutationOptions as TanStackMutationOptions,
} from '@tanstack/react-query';