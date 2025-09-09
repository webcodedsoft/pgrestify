/**
 * Query and Mutation Observers
 * Observable query and mutation state for reactive updates
 */

import type {
  QueryObserver as IQueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
  NotifyOptions,
  NextResultOptions,
  Query,
  QueryState,
  PGRestifyClient,
} from './types';
import { replaceEqualDeep } from '../utils/structural-sharing';

/**
 * Query Observer Implementation
 * Observes a query and provides reactive updates
 */
export class QueryObserver<TData = unknown, TError = unknown> implements IQueryObserver<TData, TError> {
  client: PGRestifyClient;
  currentQuery: Query<TData, TError>;
  currentQueryInitialState: QueryState<TData, TError>;
  currentResult: QueryObserverResult<TData, TError>;
  currentResultOptions?: QueryObserverOptions<TData, TError>;
  currentResultState?: QueryState<TData, TError>;
  previousQueryResult?: QueryObserverResult<TData, TError>;
  selectError?: TError;
  selectFn?: (data: TData) => unknown;
  selectResult?: unknown;
  staleTimeoutId?: ReturnType<typeof setTimeout> | undefined;
  refetchIntervalId?: ReturnType<typeof setInterval> | undefined;
  currentRefetchInterval?: number | false;
  trackedProps: string[];

  private listeners: Set<(result: QueryObserverResult<TData, TError>) => void>;
  private options: QueryObserverOptions<TData, TError>;
  private isDestroyed: boolean;

  constructor(
    client: PGRestifyClient,
    options: QueryObserverOptions<TData, TError>
  ) {
    this.client = client;
    this.listeners = new Set();
    this.trackedProps = [];
    this.isDestroyed = false;

    // Build the query
    this.currentQuery = this.client.queryCache.build(client, options);
    this.currentQueryInitialState = { ...this.currentQuery.state };
    
    // Initialize options and result
    this.options = options;
    this.currentResult = this.createResult(this.currentQuery, options);
    this.currentResultOptions = options;
    this.currentResultState = this.currentQuery.state;

    // Add this observer to the query
    this.currentQuery.observers.push(this);

    // Setup initial state
    this.updateTimers();
  }

  subscribe(callback: (result: QueryObserverResult<TData, TError>) => void): () => void {
    this.listeners.add(callback);
    
    // Register with client
    this.client.mountedInstances.add(this as any);
    this.client.unsubscribeFns.set(this as any, () => {
      this.listeners.delete(callback);
    });

    return () => {
      this.listeners.delete(callback);
      
      if (this.listeners.size === 0) {
        this.destroy();
      }
    };
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.clearTimers();
    
    // Remove from query observers
    const index = this.currentQuery.observers.indexOf(this);
    if (index !== -1) {
      this.currentQuery.observers.splice(index, 1);
    }
    
    // Remove from client
    this.client.mountedInstances.delete(this as any);
    this.client.unsubscribeFns.delete(this as any);
    
    this.listeners.clear();
  }

  setOptions(
    options: QueryObserverOptions<TData, TError>,
    notifyOptions?: NotifyOptions
  ): void {
    const prevOptions = this.options;
    const prevQuery = this.currentQuery;
    
    this.options = options;

    // Check if we need a new query
    if (options.queryKey !== prevOptions.queryKey || options.queryFn !== prevOptions.queryFn) {
      // Remove from old query
      const index = prevQuery.observers.indexOf(this);
      if (index !== -1) {
        prevQuery.observers.splice(index, 1);
      }

      // Create new query
      this.currentQuery = this.client.queryCache.build(this.client, options);
      this.currentQuery.observers.push(this);
    } else {
      // Update existing query options
      this.currentQuery.setOptions(options);
    }

    this.updateTimers();
    this.updateResult(notifyOptions);
  }

  getOptimisticResult(options: QueryObserverOptions<TData, TError>): QueryObserverResult<TData, TError> {
    const query = this.client.queryCache.build(this.client, options);
    return this.createResult(query, options);
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.currentResult;
  }

  trackResult(result: QueryObserverResult<TData, TError>): QueryObserverResult<TData, TError> {
    const trackedResult: any = {};
    
    Object.keys(result).forEach(key => {
      Object.defineProperty(trackedResult, key, {
        get: () => {
          if (!this.trackedProps.includes(key)) {
            this.trackedProps.push(key);
          }
          return (result as any)[key];
        },
        configurable: true,
      });
    });

    return trackedResult;
  }

  async getNextResult(options?: NextResultOptions): Promise<QueryObserverResult<TData, TError>> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.subscribe(result => {
        if (!result.isFetching) {
          unsubscribe();
          if (result.isError && options?.throwOnError) {
            reject(result.error);
          } else {
            resolve(result);
          }
        }
      });
    });
  }

  updateResult(notifyOptions?: NotifyOptions): void {
    const prevResult = this.currentResult;
    const nextResult = this.createResult(this.currentQuery, this.options);

    this.currentResultState = this.currentQuery.state;
    this.currentResultOptions = this.options;

    // Only update if result has actually changed
    if (this.hasResultChanged(prevResult, nextResult)) {
      this.currentResult = nextResult;
      
      if (notifyOptions?.listeners !== false) {
        this.notify();
      }
    }
  }

  async refetch(): Promise<QueryObserverResult<TData, TError>> {
    return this.currentQuery.fetch().then(() => this.currentResult);
  }

  async fetchOptimistic(
    options: QueryObserverOptions<TData, TError>
  ): Promise<QueryObserverResult<TData, TError>> {
    const defaultedOptions = { ...this.options, ...options };
    const query = this.client.queryCache.build(this.client, defaultedOptions);
    
    await query.fetch();
    return this.createResult(query, defaultedOptions);
  }

  private createResult(
    query: Query<TData, TError>,
    options: QueryObserverOptions<TData, TError>
  ): QueryObserverResult<TData, TError> {
    const { state } = query;
    const { data, error, status, fetchStatus } = state;
    
    // Apply select transform if provided
    let selectedData: TData | undefined;
    let selectError: TError | undefined;
    
    try {
      selectedData = options.select && data !== undefined 
        ? (options.select(data) as TData)
        : data;
    } catch (err) {
      selectError = err as TError;
    }

    const isPending = status === 'loading';
    const isError = status === 'error';
    const isSuccess = status === 'success';
    const isFetching = fetchStatus === 'fetching';
    const isLoading = isPending && isFetching;
    const isInitialLoading = isLoading && !state.dataUpdatedAt;

    return {
      data: selectedData,
      dataUpdatedAt: state.dataUpdatedAt,
      error: selectError || error,
      errorUpdatedAt: state.errorUpdatedAt,
      failureCount: state.failureCount,
      failureReason: state.failureReason,
      fetchStatus: fetchStatus,
      isError: isError || !!selectError,
      isFetched: state.dataUpdatedAt > 0,
      isFetchedAfterMount: state.dataUpdatedAt > this.currentQueryInitialState.dataUpdatedAt,
      isFetching,
      isInitialLoading,
      isLoading,
      isLoadingError: isError && state.dataUpdatedAt === 0,
      isPaused: fetchStatus === 'paused',
      isPending,
      isPlaceholderData: false, // TODO: implement placeholder data
      isPreviousData: !!(this.options.keepPreviousData && data !== selectedData),
      isRefetchError: isError && state.dataUpdatedAt > 0,
      isRefetching: isFetching && !isPending,
      isStale: this.isStale(query),
      isSuccess,
      refetch: this.refetch.bind(this),
      remove: () => this.client.getQueryCache().remove(query as any),
      status,
    };
  }

  private hasResultChanged(
    prevResult: QueryObserverResult<TData, TError>,
    nextResult: QueryObserverResult<TData, TError>
  ): boolean {
    // If tracking specific props, only check those
    if (this.trackedProps.length > 0) {
      return this.trackedProps.some(key => {
        const prevValue = (prevResult as any)[key];
        const nextValue = (nextResult as any)[key];
        return !Object.is(prevValue, nextValue);
      });
    }

    // Otherwise, do a full comparison with structural sharing
    return !this.areResultsEqual(prevResult, nextResult);
  }

  private areResultsEqual(
    a: QueryObserverResult<TData, TError>,
    b: QueryObserverResult<TData, TError>
  ): boolean {
    // Use structural sharing to compare results
    return replaceEqualDeep(a, b) === a;
  }

  private notify(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentResult);
      } catch (error) {
        console.error('QueryObserver listener error:', error);
      }
    });
  }

  private isStale(query: Query<TData, TError>): boolean {
    if (query.state.isInvalidated) return true;
    
    const staleTime = this.options.staleTime ?? this.client.getDefaultOptions().queries?.staleTime ?? 0;
    if (staleTime === Infinity) return false;
    
    const timeSinceLastUpdate = Date.now() - query.state.dataUpdatedAt;
    return timeSinceLastUpdate > staleTime;
  }

  private updateTimers(): void {
    this.clearTimers();

    const { refetchInterval } = this.options;
    
    // Calculate the actual interval value
    let intervalValue: number | false = false;
    if (typeof refetchInterval === 'function') {
      intervalValue = refetchInterval(this.currentQuery.state.data, this.currentQuery);
    } else if (typeof refetchInterval === 'number') {
      intervalValue = refetchInterval;
    }
    
    if (intervalValue && typeof intervalValue === 'number' && intervalValue > 0) {
      this.currentRefetchInterval = intervalValue;
      this.refetchIntervalId = setInterval(() => {
        if (this.options.refetchIntervalInBackground || this.isDocumentVisible()) {
          this.currentQuery.fetch();
        }
      }, intervalValue);
    }

    // Set up stale timeout
    const staleTime = this.options.staleTime;
    if (staleTime && staleTime > 0 && staleTime !== Infinity) {
      const timeUntilStale = staleTime - (Date.now() - this.currentQuery.state.dataUpdatedAt);
      
      if (timeUntilStale > 0) {
        this.staleTimeoutId = setTimeout(() => {
          if (!this.isStale(this.currentQuery)) return;
          
          this.updateResult();
        }, timeUntilStale);
      }
    }
  }

  private clearTimers(): void {
    if (this.staleTimeoutId) {
      clearTimeout(this.staleTimeoutId);
      this.staleTimeoutId = undefined;
    }

    if (this.refetchIntervalId) {
      clearInterval(this.refetchIntervalId);
      this.refetchIntervalId = undefined;
    }
  }

  private isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
}