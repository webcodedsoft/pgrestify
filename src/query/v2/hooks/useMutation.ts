/**
 * V2 useMutation Hook - Fluent API  
 * Accepts MutationBuilder function for fully fluent mutation building
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { MutationBuilder } from '../core/mutation-builder';
import { usePGRestifyClient } from '../../react/provider';
import type {
  QueryKey,
  MutationFunction,
  MutateOptions,
  PGRestifyClient,
} from '../../core/types';

// Hook option types for v2
export interface UseMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> {
  // React Query compatibility
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext | void;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => Promise<void> | void;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => Promise<void> | void;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void;
  
  // Retry configuration
  retry?: boolean | number;
  retryDelay?: number | ((attempt: number) => number);
  
  // React-specific options
  throwOnError?: boolean | ((error: TError) => boolean);
  
  // Cache management
  invalidateQueries?: QueryKey[] | ((data: TData, variables: TVariables, context: TContext | undefined) => QueryKey[]);
  refetchQueries?: QueryKey[] | ((data: TData, variables: TVariables, context: TContext | undefined) => QueryKey[]);
  
  // Optimistic updates
  optimisticUpdate?: {
    queryKey: QueryKey;
    updater: (variables: TVariables, previousData?: unknown) => unknown;
  }[];
}

// Hook result type for v2
export interface UseMutationResult<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> {
  data: TData | undefined;
  error: TError | null;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isPaused: boolean;
  isPending: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  variables: TVariables | undefined;
  context: TContext | undefined;
  failureCount: number;
  failureReason: TError | null;
  submittedAt: number;
  mutate: (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => void;
  mutateAsync: (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => Promise<TData>;
  reset: () => void;
}

/**
 * Simple mutation observer for v2 React hooks
 */
class MutationObserver<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> {
  private client: PGRestifyClient;
  private options: UseMutationOptions<TData, TError, TVariables, TContext>;
  private listeners = new Set<(result: UseMutationResult<TData, TError, TVariables, TContext>) => void>();
  private currentResult: UseMutationResult<TData, TError, TVariables, TContext>;
  private mutationFn: (variables: TVariables) => Promise<TData>;
  
  constructor(
    client: PGRestifyClient,
    options: UseMutationOptions<TData, TError, TVariables, TContext>,
    mutationFn: (variables: TVariables) => Promise<TData>
  ) {
    this.client = client;
    this.options = options;
    this.mutationFn = mutationFn;
    this.currentResult = this.createInitialResult();
  }

  private createInitialResult(): UseMutationResult<TData, TError, TVariables, TContext> {
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

  subscribe(callback: (result: UseMutationResult<TData, TError, TVariables, TContext>) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getCurrentResult(): UseMutationResult<TData, TError, TVariables, TContext> {
    return this.currentResult;
  }

  setOptions(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
    this.options = options;
  }

  private updateResult(updates: Partial<UseMutationResult<TData, TError, TVariables, TContext>>) {
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

      // Apply optimistic updates
      if (this.options.optimisticUpdate) {
        this.options.optimisticUpdate.forEach(({ queryKey, updater }) => {
          const previousData = this.client.getQueryData(queryKey);
          const optimisticData = updater(variables, previousData);
          this.client.setQueryData(queryKey, optimisticData);
        });
      }

      // Execute mutation through the provided mutation function
      const data = await this.mutationFn(variables);

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

      // Handle cache updates
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
 * V2 useMutation - Pure Fluent API
 * Accepts MutationBuilder function for fully fluent mutation building
 * 
 * @param mutationBuilderFn Function that returns MutationBuilder with chained methods
 * @param options Mutation options
 * @returns Mutation result with data, loading states, and mutate functions
 * 
 * @example
 * const createUser = useMutation(
 *   (m) => m
 *     .insertInto('users')
 *     .values([{ name: 'John', email: 'john@example.com' }])
 *     .returning(['id', 'name', 'email']),
 *   {
 *     onSuccess: (data) => {
 *       queryClient.invalidateQueries(['users']);
 *       toast.success(`${data.length} users created!`);
 *     },
 *     onError: (error) => {
 *       toast.error(`Creation failed: ${error.message}`);
 *     }
 *   }
 * );
 * 
 * // Usage
 * createUser.mutate();
 */
export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  mutationBuilderFn: (m: MutationBuilder<any>, variables: TVariables) => MutationBuilder<TData>,
  options: UseMutationOptions<TData, TError, TVariables, TContext> = {}
): UseMutationResult<TData, TError, TVariables, TContext> {
  const client = usePGRestifyClient();
  
  // Create mutation function from MutationBuilder
  const executeMutation = useCallback(async (variables: TVariables): Promise<TData> => {
    const builder = new MutationBuilder<TData>(client);
    const mutation = mutationBuilderFn(builder, variables);
    const result = await mutation.execute();
    
    // Handle both single records and arrays
    return result as TData;
  }, [client, mutationBuilderFn]);

  // Create stable observer reference
  const observerRef = useRef<MutationObserver<TData, TError, TVariables, TContext>>();
  
  if (!observerRef.current) {
    observerRef.current = new MutationObserver(client, options, executeMutation);
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
  );

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

// Export types
export type {
  MutationFunction,
  MutateOptions,
};