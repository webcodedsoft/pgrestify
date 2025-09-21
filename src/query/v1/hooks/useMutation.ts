/**
 * useMutation Hook
 * React Query-inspired mutation hook for PGRestify
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { usePGRestifyClient } from '../../react/provider';
import { 
  extractData, 
} from './types';
import type {
  MutationKey,
  MutationFunction,
  MutationObserverOptions,
  MutationObserverResult,
  MutateOptions,
  QueryKey,
  PGRestifyClient,
} from '../../core/types';
import { QueryBuilder } from '@/core/query-builder';

// Hook option types
export interface UseMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> extends Omit<MutationObserverOptions<TData, TError, TVariables, TContext>, 'optimisticUpdate'> {
  // React-specific options
  throwOnError?: boolean | ((error: TError) => boolean);
  
  // PostgREST specific options
  tableName?: string;
  
  // Cache invalidation options
  invalidateQueries?: QueryKey[] | ((data: TData, variables: TVariables, context: TContext) => QueryKey[]);
  refetchQueries?: QueryKey[] | ((data: TData, variables: TVariables, context: TContext) => QueryKey[]);
  
  // Optimistic update options
  optimisticUpdate?: {
    queryKey: QueryKey;
    updater: (variables: TVariables, previousData?: unknown) => unknown;
  }[];
}

// Hook result type
export interface UseMutationResult<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> extends MutationObserverResult<TData, TError, TVariables, TContext> {
  // Additional React-specific properties can be added here
}

/**
 * Simple mutation observer class for React
 */
class MutationObserver<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> {
  private client: PGRestifyClient;
  private options: UseMutationOptions<TData, TError, TVariables, TContext>;
  private listeners = new Set<(result: MutationObserverResult<TData, TError, TVariables, TContext>) => void>();
  private currentResult: MutationObserverResult<TData, TError, TVariables, TContext>;
  
  constructor(
    client: PGRestifyClient,
    options: UseMutationOptions<TData, TError, TVariables, TContext>
  ) {
    this.client = client;
    this.options = options;
    this.currentResult = this.createInitialResult();
  }

  private createInitialResult(): MutationObserverResult<TData, TError, TVariables, TContext> {
    return {
      data: undefined,
      error: null,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      isError: false,
      isPaused: false,
      isPending: false,
      status: 'idle',
      variables: undefined,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
      mutate: this.mutate.bind(this),
      mutateAsync: this.mutateAsync.bind(this),
      reset: this.reset.bind(this),
    };
  }

  subscribe(callback: (result: MutationObserverResult<TData, TError, TVariables, TContext>) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getCurrentResult(): MutationObserverResult<TData, TError, TVariables, TContext> {
    return this.currentResult;
  }

  setOptions(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
    this.options = options;
  }

  private updateResult(updates: Partial<MutationObserverResult<TData, TError, TVariables, TContext>>) {
    this.currentResult = { ...this.currentResult, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentResult);
      } catch (error) {
        console.error('MutationObserver listener error:', error);
      }
    });
  }

  mutate(
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ): void {
    this.mutateAsync(variables, options).catch(() => {
      // Error is already handled in mutateAsync and stored in state
    });
  }

  async mutateAsync(
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ): Promise<TData> {
    // Update state to loading
    this.updateResult({
      status: 'loading',
      isLoading: true,
      isIdle: false,
      isSuccess: false,
      isError: false,
      isPending: true,
      variables,
      submittedAt: Date.now(),
    });

    let context: TContext | undefined;

    try {
      // Call onMutate
      if (this.options.onMutate) {
        const mutateResult = await this.options.onMutate(variables);
        if (mutateResult !== undefined) {
          context = mutateResult as TContext;
        }
      }
      // Note: options doesn't have onMutate, this is handled by the main mutation options

      // Apply optimistic updates
      if (this.options.optimisticUpdate) {
        this.options.optimisticUpdate.forEach(({ queryKey, updater }) => {
          const previousData = this.client.getQueryData(queryKey);
          const optimisticData = updater(variables, previousData);
          this.client.setQueryData(queryKey, optimisticData);
        });
      }

      // Execute mutation
      const data = await this.options.mutationFn(variables);

      // Update state to success
      this.updateResult({
        data,
        error: null,
        status: 'success',
        isLoading: false,
        isSuccess: true,
        isError: false,
        isPending: false,
        context,
      });

      // Handle cache invalidation and refetching
      await this.handleCacheUpdates(data, variables, context);

      // Call success callbacks
      if (this.options.onSuccess) {
        await this.options.onSuccess(data, variables, context);
      }
      if (options?.onSuccess) {
        await options.onSuccess(data, variables, context);
      }

      // Call settled callback
      if (this.options.onSettled) {
        await this.options.onSettled(data, null, variables, context);
      }
      if (options?.onSettled) {
        await options.onSettled(data, null, variables, context);
      }

      return data;

    } catch (error) {
      const mutationError = error as TError;

      // Revert optimistic updates on error
      if (this.options.optimisticUpdate) {
        // This would typically require storing previous values
        // For now, just invalidate the affected queries
        this.options.optimisticUpdate.forEach(({ queryKey }) => {
          this.client.invalidateQueries({ queryKey });
        });
      }

      // Update state to error
      this.updateResult({
        data: undefined,
        error: mutationError,
        status: 'error',
        isLoading: false,
        isSuccess: false,
        isError: true,
        isPending: false,
        failureCount: this.currentResult.failureCount + 1,
        failureReason: mutationError,
        context,
      });

      // Call error callbacks
      if (this.options.onError) {
        await this.options.onError(mutationError, variables, context);
      }
      if (options?.onError) {
        await options.onError(mutationError, variables, context);
      }

      // Call settled callback
      if (this.options.onSettled) {
        await this.options.onSettled(undefined, mutationError, variables, context);
      }
      if (options?.onSettled) {
        await options.onSettled(undefined, mutationError, variables, context);
      }

      throw mutationError;
    }
  }

  private async handleCacheUpdates(
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) {
    // Handle query invalidation
    if (this.options.invalidateQueries) {
      const queryKeys = typeof this.options.invalidateQueries === 'function'
        ? this.options.invalidateQueries(data, variables, context!)
        : this.options.invalidateQueries;

      for (const queryKey of queryKeys) {
        await this.client.invalidateQueries({ queryKey });
      }
    }

    // Handle query refetching
    if (this.options.refetchQueries) {
      const queryKeys = typeof this.options.refetchQueries === 'function'
        ? this.options.refetchQueries(data, variables, context!)
        : this.options.refetchQueries;

      for (const queryKey of queryKeys) {
        await this.client.refetchQueries({ queryKey });
      }
    }
  }

  reset(): void {
    this.updateResult(this.createInitialResult());
  }

  destroy(): void {
    this.listeners.clear();
  }
}

/**
 * Primary useMutation hook
 */
export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext>;

export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  mutationFn: MutationFunction<TData, TVariables>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'>
): UseMutationResult<TData, TError, TVariables, TContext>;

export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  arg1: UseMutationOptions<TData, TError, TVariables, TContext> | MutationFunction<TData, TVariables>,
  arg2?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const client = usePGRestifyClient();
  
  // Normalize arguments
  const options = typeof arg1 === 'function' 
    ? { mutationFn: arg1, ...arg2 }
    : arg1;

  if (!options.mutationFn) {
    throw new Error('useMutation: mutationFn is required');
  }

  // Create stable observer reference
  const observerRef = useRef<MutationObserver<TData, TError, TVariables, TContext>>();
  
  if (!observerRef.current) {
    observerRef.current = new MutationObserver(client, options);
  }

  const observer = observerRef.current;

  // Update observer options when they change
  const optionsRef = useRef(options);
  if (optionsRef.current !== options) {
    observer.setOptions(options);
    optionsRef.current = options;
  }

  // Subscribe to observer changes
  const result = useSyncExternalStore(
    (callback) => observer.subscribe(callback),
    () => observer.getCurrentResult(),
    () => observer.getCurrentResult()
  ) as UseMutationResult<TData, TError, TVariables, TContext>;

  // Handle error throwing
  if (options.throwOnError && result.error) {
    const shouldThrow = typeof options.throwOnError === 'function' 
      ? options.throwOnError(result.error)
      : true;
    
    if (shouldThrow) {
      throw result.error;
    }
  }

  return result;
}

/**
 * Convenience hook for table insertions
 */
export function useInsert<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string,
  options?: Omit<UseMutationOptions<TData, TError, Partial<TData>>, 'mutationFn'> & {
    select?: string | string[];
    returning?: boolean;
  }
): UseMutationResult<TData, TError, Partial<TData>> {
  const client = usePGRestifyClient();

  const mutationFn = useCallback(
    async (variables: Partial<TData>) => {
      let query = client.from<TData>(tableName).insert(variables);

      if (options?.select) {
        const selectStr = Array.isArray(options.select) 
          ? options.select.join(', ')
          : options.select;
        query = query.select(selectStr) as QueryBuilder<TData>;
      } else if (options?.returning !== false) {
        query = query.select('*') as QueryBuilder<TData>;
      }

      const result = await query.single().execute();
      return extractData<TData>(result);
    },
    [client, tableName, options?.select, options?.returning]
  );

  return useMutation(mutationFn, {
    ...options,
    tableName,
    // Auto-invalidate list queries for this table
    invalidateQueries: [['tables', tableName, 'list']],
  });
}

/**
 * Convenience hook for table updates
 */
export function useUpdate<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string,
  options?: Omit<UseMutationOptions<TData, TError, { where: Partial<TData>; values: Partial<TData> }>, 'mutationFn'> & {
    select?: string | string[];
    returning?: boolean;
  }
): UseMutationResult<TData, TError, { where: Partial<TData>; values: Partial<TData> }> {
  const client = usePGRestifyClient();

  const mutationFn = useCallback(
    async ({ where, values }: { where: Partial<TData>; values: Partial<TData> }) => {
      let query = client.from<TData>(tableName);

      // Apply where conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key as keyof TData, value as TData[keyof TData]);
        }
      });

      query = query.update(values);

      if (options?.select) {
        const selectStr = Array.isArray(options.select) 
          ? options.select.join(', ')
          : options.select;
        query = query.select(selectStr) as QueryBuilder<TData>;
      } else if (options?.returning !== false) {
        query = query.select('*') as QueryBuilder<TData>;
      }

      const result = await query.execute();
      return extractData<TData>(result);
    },
    [client, tableName, options?.select, options?.returning]
  );

  return useMutation(mutationFn, {
    ...options,
    tableName,
    // Invalidate queries for this table
    invalidateQueries: [['tables', tableName]],
  });
}

/**
 * Convenience hook for table deletions
 */
export function useDelete<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string,
  options?: Omit<UseMutationOptions<TData, TError, Partial<TData>>, 'mutationFn'> & {
    select?: string | string[];
    returning?: boolean;
  }
): UseMutationResult<TData, TError, Partial<TData>> {
  const client = usePGRestifyClient();

  const mutationFn = useCallback(
    async (where: Partial<TData>) => {
      let query = client.from<TData>(tableName);

      // Apply where conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key as keyof TData, value as TData[keyof TData]);
        }
      });

      query = query.delete();

      if (options?.select) {
        const selectStr = Array.isArray(options.select) 
          ? options.select.join(', ')
          : options.select;
        query = query.select(selectStr) as QueryBuilder<TData>;
      } else if (options?.returning !== false) {
        query = query.select('*') as QueryBuilder<TData>;
      }

      const result = await query.execute();
      return extractData<TData>(result);
    },
    [client, tableName, options?.select, options?.returning]
  );

  return useMutation(mutationFn, {
    ...options,
    tableName,
    // Invalidate queries for this table
    invalidateQueries: [['tables', tableName]],
  });
}

/**
 * Convenience hook for table upserts
 */
export function useUpsert<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TError = Error
>(
  tableName: string,
  options?: Omit<UseMutationOptions<TData, TError, Partial<TData>>, 'mutationFn'> & {
    select?: string | string[];
    returning?: boolean;
    onConflict?: string;
  }
): UseMutationResult<TData, TError, Partial<TData>> {
  const client = usePGRestifyClient();

  const mutationFn = useCallback(
    async (variables: Partial<TData>) => {
      let query = client.from<TData>(tableName).upsert(variables);

      if (options?.select) {
        const selectStr = Array.isArray(options.select) 
          ? options.select.join(', ')
          : options.select;
        query = query.select(selectStr) as QueryBuilder<TData>;
      } else if (options?.returning !== false) {
        query = query.select('*') as QueryBuilder<TData>;
      }

      const result = await query.single().execute();
      return extractData<TData>(result);
    },
    [client, tableName, options?.select, options?.returning]
  );

  return useMutation(mutationFn, {
    ...options,
    tableName,
    // Invalidate queries for this table
    invalidateQueries: [['tables', tableName]],
  });
}

// Export types
export type {
  MutationKey,
  MutationFunction,
  MutationObserverOptions,
  MutationObserverResult,
  MutateOptions,
};