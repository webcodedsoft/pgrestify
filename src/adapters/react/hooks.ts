/**
 * React hooks for PGRestify
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  PostgRESTClient,
  QueryBuilder,
  QueryResponse,
  SingleQueryResponse,
  AuthSession,
  User,
  RealtimeSubscription,
  PostgresChangesPayload,
} from '../../types';

export interface UseQueryOptions {
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

export interface UseQueryResult<T> {
  /** Query data */
  data: T[] | null;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Is refetching */
  isRefetching: boolean;
  /** Is loading (React Query standard) */
  isLoading: boolean;
  /** Is error (React Query standard) */
  isError: boolean;
  /** Is success (React Query standard) */
  isSuccess: boolean;
}

export interface UseSingleQueryResult<T> {
  /** Query data */
  data: T | null;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Is refetching */
  isRefetching: boolean;
  /** Is loading (React Query standard) */
  isLoading: boolean;
  /** Is error (React Query standard) */
  isError: boolean;
  /** Is success (React Query standard) */
  isSuccess: boolean;
}

export interface UseMutationOptions<T> {
  /** Called on successful mutation */
  onSuccess?: (data: T) => void;
  /** Called on mutation error */
  onError?: (error: Error) => void;
  /** Called when mutation settles (success or error) */
  onSettled?: (data: T | null, error: Error | null) => void;
}

export interface UseMutationResult<T, TVariables = unknown> {
  /** Mutation data */
  data: T | null;
  /** Error state */
  error: Error | null;
  /** Mutation function */
  mutate: (variables: TVariables) => Promise<void>;
  /** Async mutation function */
  mutateAsync: (variables: TVariables) => Promise<T>;
  /** Reset mutation state */
  reset: () => void;
  /** Is loading (React Query standard) */
  isLoading: boolean;
  /** Is error (React Query standard) */
  isError: boolean;
  /** Is success (React Query standard) */
  isSuccess: boolean;
  /** Is pending (React Query standard) */
  isPending: boolean;
}

/**
 * Hook for querying data with automatic loading states
 */
export function useQuery<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  queryFn?: (builder: QueryBuilder<T>) => QueryBuilder<T>,
  options: UseQueryOptions = {},
  queryOptions?: import('../../types').QueryOptions
): UseQueryResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);

  const {
    enabled = true,
    refetchInterval,
    retry = true,
    retryDelay = 1000,
    staleTime = 0,
  } = options;

  // Create stable reference for queryFn to prevent infinite re-renders
  const queryFnRef = useRef(queryFn);
  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const executeQuery = useCallback(async (isRefetch = false) => {
    if (!enabled) return;

    // Check if data is still fresh
    if (!isRefetch && staleTime > 0 && Date.now() - lastFetchRef.current < staleTime) {
      return;
    }

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let query = client.from<T>(tableName, queryOptions);
      if (queryFnRef.current) {
        query = queryFnRef.current(query);
      }

      const result = await query.execute();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      setData(result.data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);

      // Retry logic
      if (retry) {
        const maxRetries = typeof retry === 'number' ? retry : 3;
        const shouldRetry = typeof retry === 'boolean' ? true : maxRetries > 0;
        
        if (shouldRetry) {
          retryTimeoutRef.current = setTimeout(() => {
            executeQuery(isRefetch);
          }, retryDelay);
        }
      }
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [client, tableName, enabled, retry, retryDelay, staleTime, queryOptions]);

  const refetch = useCallback(() => executeQuery(true), [executeQuery]);

  // Initial fetch
  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  // Set up refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      intervalRef.current = setInterval(() => {
        executeQuery(true);
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
    return undefined;
  }, [refetchInterval, enabled, executeQuery]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    error,
    refetch,
    isRefetching,
    isLoading: loading,
    isError: !!error,
    isSuccess: !loading && !error && data !== null,
  };
}

/**
 * Hook for querying a single record
 */
export function useSingleQuery<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  queryFn?: (builder: QueryBuilder<T>) => QueryBuilder<T>,
  options: UseQueryOptions = {},
  queryOptions?: import('../../types').QueryOptions
): UseSingleQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const { enabled = true, staleTime = 0 } = options;
  const lastFetchRef = useRef<number>(0);

  // Create stable reference for queryFn to prevent infinite re-renders
  const queryFnRef = useRef(queryFn);
  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const executeQuery = useCallback(async (isRefetch = false) => {
    if (!enabled) return;

    if (!isRefetch && staleTime > 0 && Date.now() - lastFetchRef.current < staleTime) {
      return;
    }

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let query = client.from<T>(tableName, queryOptions);
      if (queryFnRef.current) {
        query = queryFnRef.current(query);
      }

      const result = await query.single().execute() as SingleQueryResponse<T>;
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      setData(result.data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [client, tableName, enabled, staleTime, queryOptions]);

  const refetch = useCallback(() => executeQuery(true), [executeQuery]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return {
    data,
    error,
    refetch,
    isRefetching,
    isLoading: loading,
    isError: !!error,
    isSuccess: !loading && !error && data !== null,
  };
}

/**
 * Hook for mutations (create, update, delete)
 */
export function useMutation<T extends Record<string, unknown>, TVariables = Partial<T>>(
  client: PostgRESTClient,
  tableName: string,
  mutationFn: (variables: TVariables, builder: QueryBuilder<T>) => Promise<QueryResponse<T>>,
  options: UseMutationOptions<T> = {}
): UseMutationResult<T, TVariables> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { onSuccess, onError, onSettled } = options;

  // Create stable references for callback functions to prevent infinite re-renders
  const mutationFnRef = useRef(mutationFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    mutationFnRef.current = mutationFn;
  }, [mutationFn]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<T> => {
    setLoading(true);
    setError(null);

    let currentData: T | null = null;
    let currentError: Error | null = null;

    try {
      const result = await mutationFnRef.current(variables, client.from<T>(tableName));
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      const resultData = Array.isArray(result.data) ? result.data[0] : result.data;
      currentData = resultData || null;
      setData(currentData);
      
      if (onSuccessRef.current && resultData) {
        onSuccessRef.current(resultData);
      }

      if (!resultData) {
        throw new Error('No data returned from mutation');
      }

      return resultData;
    } catch (err) {
      currentError = err instanceof Error ? err : new Error('Unknown error');
      setError(currentError);
      
      if (onErrorRef.current) {
        onErrorRef.current(currentError);
      }
      
      throw currentError;
    } finally {
      setLoading(false);
      
      if (onSettledRef.current) {
        onSettledRef.current(currentData, currentError);
      }
    }
  }, [client, tableName]);

  const mutate = useCallback(async (variables: TVariables) => {
    try {
      await mutateAsync(variables);
    } catch {
      // Error is already handled in mutateAsync
    }
  }, [mutateAsync]);

  return {
    data,
    error,
    mutate,
    mutateAsync,
    reset,
    isLoading: loading,
    isError: !!error,
    isSuccess: !loading && !error && data !== null,
    isPending: loading,
  };
}

/**
 * Hook for insert mutations
 */
export function useInsert<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, Partial<T> | Partial<T>[]> {
  // Create stable mutationFn reference to prevent re-renders
  const mutationFn = useCallback(
    async (variables: Partial<T> | Partial<T>[], builder: QueryBuilder<T>) => {
      return builder.insert(variables).select('*').execute() as Promise<QueryResponse<T>>;
    },
    []
  );

  return useMutation(client, tableName, mutationFn, options);
}

/**
 * Hook for update mutations
 */
export function useUpdate<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, { values: Partial<T>; where: Partial<T> }> {
  // Create stable mutationFn reference to prevent re-renders
  const mutationFn = useCallback(
    async ({ values, where }: { values: Partial<T>; where: Partial<T> }, builder: QueryBuilder<T>) => {
      let query = builder.update(values);
      
      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key as keyof T, value);
      }
      
      return query.select('*').execute() as Promise<QueryResponse<T>>;
    },
    []
  );

  return useMutation(client, tableName, mutationFn, options);
}

/**
 * Hook for delete mutations
 */
export function useDelete<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, Partial<T>> {
  // Create stable mutationFn reference to prevent re-renders
  const mutationFn = useCallback(
    async (where: Partial<T>, builder: QueryBuilder<T>) => {
      let query = builder.delete();
      
      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key as keyof T, value);
      }
      
      return query.execute();
    },
    []
  );

  return useMutation(client, tableName, mutationFn, options);
}

/**
 * Hook for upsert mutations
 */
export function useUpsert<T extends Record<string, unknown>>(
  client: PostgRESTClient,
  tableName: string,
  options?: UseMutationOptions<T>
): UseMutationResult<T, Partial<T> | Partial<T>[]> {
  // Create stable mutationFn reference to prevent re-renders
  const mutationFn = useCallback(
    async (variables: Partial<T> | Partial<T>[], builder: QueryBuilder<T>) => {
      return builder.upsert(variables).select('*').execute() as Promise<QueryResponse<T>>;
    },
    []
  );

  return useMutation(client, tableName, mutationFn, options);
}

/**
 * Hook for authentication state
 */
export function useAuth(client: PostgRESTClient) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initialSession = client.auth.getSession();
    const initialUser = client.auth.getUser();
    
    setSession(initialSession);
    setUser(initialUser);
    setLoading(false);

    // Listen for auth changes
    const unsubscribe = client.auth.onAuthStateChange((event) => {
      setSession(event.session);
      setUser(event.session?.user || null);
    });

    return unsubscribe;
  }, [client]);

  const signIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      return client.auth.signIn(credentials);
    },
    [client]
  );

  const signOut = useCallback(async () => {
    return client.auth.signOut();
  }, [client]);

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
  };
}

/**
 * Hook for real-time subscriptions
 */
export function useRealtimeSubscription(
  client: PostgRESTClient,
  tableName: string,
  callback: (payload: PostgresChangesPayload<any>) => void,
  eventType: import('../../types').RealtimeEvent | 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*'
) {
  const [connected, setConnected] = useState(false);
  const subscriptionRef = useRef<RealtimeSubscription | null>(null);

  // Create stable reference for callback to prevent infinite re-renders
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let isMounted = true;

    const setupSubscription = async () => {
      try {
        // Connect to realtime if not already connected
        if (!client.realtime) {
          console.warn('Realtime not configured on client');
          return;
        }

        await client.realtime.connect();
        
        if (!isMounted) return;

        // Create subscription with stable callback
        const subscription = client.realtime
          .from(tableName)
          .on(eventType, (payload: PostgresChangesPayload<any>) => {
            callbackRef.current(payload);
          });

        subscriptionRef.current = subscription;
        setConnected(true);
      } catch (error) {
        console.error('Failed to setup realtime subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      setConnected(false);
    };
  }, [client, tableName, eventType]);

  return { connected };
}

/**
 * Hook for executing raw PostgREST queries
 */
export function useRawQuery<T = unknown>(
  client: PostgRESTClient,
  path: string,
  options?: import('../../types').RawQueryOptions & UseQueryOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<number>(0);
  const [count, setCount] = useState<number | null>(null);

  const enabled = options?.enabled ?? true;
  const refetchInterval = options?.refetchInterval;
  
  const execute = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.raw<T>(path, options);
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setCount(result.count || null);
      }
      
      setStatus(result.status);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
      setStatus(0);
    } finally {
      setIsLoading(false);
    }
  }, [client, path, enabled, JSON.stringify(options)]);

  useEffect(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => {
      execute();
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [execute, refetchInterval, enabled]);

  const refetch = useCallback(() => {
    return execute();
  }, [execute]);

  return {
    data,
    error,
    isLoading,
    status,
    count,
    refetch,
  };
}

/**
 * Hook for executing raw mutations (POST, PATCH, DELETE)
 */
export function useRawMutation<TData = unknown, TVariables = unknown>(
  client: PostgRESTClient,
  path: string,
  options?: import('../../types').RawQueryOptions
) {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<number>(0);
  const [count, setCount] = useState<number | null>(null);

  const mutate = useCallback(async (variables?: TVariables) => {
    setIsLoading(true);
    setError(null);

    try {
      const method = options?.method || 'POST';
      const result = await client.raw<TData>(path, {
        ...options,
        method,
        params: variables as Record<string, string | number | boolean>,
      });
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setCount(result.count || null);
      }
      
      setStatus(result.status);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
      setStatus(0);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [client, path, JSON.stringify(options)]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus(0);
    setCount(null);
  }, []);

  return {
    data,
    error,
    isLoading,
    status,
    count,
    mutate,
    reset,
  };
}

/**
 * Hook for executing a pre-built QueryBuilder
 */
export function useQueryBuilder<T extends Record<string, unknown>>(
  queryBuilder: QueryBuilder<T>,
  options: UseQueryOptions = {}
): UseQueryResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);

  const {
    enabled = true,
    refetchInterval,
    retry = true,
    retryDelay = 1000,
    staleTime = 0,
  } = options;

  // Create stable reference for queryBuilder to prevent infinite re-renders
  const queryBuilderRef = useRef(queryBuilder);
  useEffect(() => {
    queryBuilderRef.current = queryBuilder;
  }, [queryBuilder]);

  const executeQuery = useCallback(async (isRefetch = false) => {
    if (!enabled) return;

    // Check if data is still fresh
    if (!isRefetch && staleTime > 0 && Date.now() - lastFetchRef.current < staleTime) {
      return;
    }

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await queryBuilderRef.current.execute();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      setData(result.data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);

      // Retry logic
      if (retry) {
        const maxRetries = typeof retry === 'number' ? retry : 3;
        const shouldRetry = typeof retry === 'boolean' ? true : maxRetries > 0;
        
        if (shouldRetry) {
          retryTimeoutRef.current = setTimeout(() => {
            executeQuery(isRefetch);
          }, retryDelay);
        }
      }
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [enabled, retry, retryDelay, staleTime]);

  const refetch = useCallback(() => executeQuery(true), [executeQuery]);

  // Initial fetch
  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  // Set up refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      intervalRef.current = setInterval(() => {
        executeQuery(true);
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
    return undefined;
  }, [refetchInterval, enabled, executeQuery]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    error,
    refetch,
    isRefetching,
    isLoading: loading,
    isError: !!error,
    isSuccess: !loading && !error && data !== null,
  };
}

/**
 * Hook for client state management
 */
export function useClient(client: PostgRESTClient) {
  const clearCache = useCallback(() => {
    client.clearCache();
  }, [client]);

  const invalidateCache = useCallback((pattern: string) => {
    client.invalidateCache(pattern);
  }, [client]);

  return {
    clearCache,
    invalidateCache,
  };
}