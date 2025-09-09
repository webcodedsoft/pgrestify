/**
 * Query and Mutation Cache Implementation
 * TanStack Query-inspired cache system for PGRestify
 */

import type {
  Query,
  QueryCache as IQueryCache,
  QueryCacheConfig,
  QueryCacheListener,
  QueryCacheNotifyEvent,
  QueryFilters,
  QueryKey,
  QueryOptions,
  QueryState,
  Mutation,
  MutationCache as IMutationCache,
  MutationCacheConfig,
  MutationCacheListener,
  MutationCacheNotifyEvent,
  MutationFilters,
  MutationKey,
  MutationOptions,
  MutationState,
  PGRestifyClient,
} from './types';
import { hashQueryKey, isEqual, matchesQueryKey } from './query-key';
import { replaceEqualDeep } from '../utils/structural-sharing';

/**
 * Query Cache Implementation
 * Manages all queries and their states
 */
export class QueryCache implements IQueryCache {
  config: QueryCacheConfig;
  queries: Map<string, Query>;
  queriesInMap: Map<QueryKey, Query>;
  private listeners: Set<QueryCacheListener>;

  constructor(config: QueryCacheConfig = {}) {
    this.config = config;
    this.queries = new Map();
    this.queriesInMap = new Map();
    this.listeners = new Set();
  }

  build<TData = unknown, TError = unknown>(
    client: PGRestifyClient,
    options: QueryOptions<TData, TError>,
    state?: QueryState<TData, TError>
  ): Query<TData, TError> {
    const queryKey = options.queryKey;
    const queryHash = hashQueryKey(queryKey);
    
    // Check if query already exists
    let query = this.queries.get(queryHash) as Query<TData, TError> | undefined;
    
    if (!query) {
      const defaultOptions = client.getDefaultOptions().queries;
      const queryConfig: {
        cache: QueryCache;
        queryKey: QueryKey;
        queryHash: string;
        options: QueryOptions<TData, TError>;
        state: QueryState<TData, TError>;
        defaultOptions?: QueryOptions<TData, TError>;
      } = {
        cache: this,
        queryKey,
        queryHash,
        options,
        state: state || createInitialQueryState(),
      };
      
      if (defaultOptions) {
        queryConfig.defaultOptions = defaultOptions as QueryOptions<TData, TError>;
      }
      
      query = new QueryImpl<TData, TError>(queryConfig);
      
      this.add(query as Query);
    }
    
    query!.setOptions(options);
    
    return query!;
  }

  add(query: Query): void {
    if (!this.queries.has(query.queryHash)) {
      this.queries.set(query.queryHash, query);
      this.queriesInMap.set(query.queryKey, query);
      
      this.notify({
        type: 'added',
        query,
      });
    }
  }

  remove(query: Query): void {
    if (this.queries.has(query.queryHash)) {
      this.queries.delete(query.queryHash);
      this.queriesInMap.delete(query.queryKey);
      
      query.destroy();
      
      this.notify({
        type: 'removed',
        query,
      });
    }
  }

  clear(): void {
    this.queries.forEach(query => {
      this.remove(query);
    });
  }

  get<TData = unknown, TError = unknown>(queryHash: string): Query<TData, TError> | undefined {
    return this.queries.get(queryHash) as Query<TData, TError> | undefined;
  }

  getAll(): Query[] {
    return Array.from(this.queries.values());
  }

  find<TData = unknown, TError = unknown>(filters: QueryFilters): Query<TData, TError> | undefined {
    const queries = this.findAll(filters);
    return queries[0] as Query<TData, TError> | undefined;
  }

  findAll(filters: QueryFilters = {}): Query[] {
    const queries = this.getAll();
    
    return queries.filter(query => {
      // Filter by query key
      if (filters.queryKey) {
        if (filters.exact) {
          if (!isEqual(query.queryKey, filters.queryKey)) {
            return false;
          }
        } else {
          if (!matchesQueryKey(query.queryKey, filters.queryKey)) {
            return false;
          }
        }
      }
      
      // Filter by type
      if (filters.type) {
        const isActive = query.observers.length > 0;
        if (filters.type === 'active' && !isActive) return false;
        if (filters.type === 'inactive' && isActive) return false;
      }
      
      // Filter by stale
      if (filters.stale !== undefined) {
        const isStale = query.state.isInvalidated || (query as any).isStale?.() || false;
        if (filters.stale !== isStale) return false;
      }
      
      // Filter by fetch status
      if (filters.fetchStatus && query.state.fetchStatus !== filters.fetchStatus) {
        return false;
      }
      
      // Custom predicate
      if (filters.predicate && !filters.predicate(query)) {
        return false;
      }
      
      return true;
    });
  }

  notify(event: QueryCacheNotifyEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('QueryCache listener error:', error);
      }
    });
  }

  subscribe(callback: QueryCacheListener): () => void {
    this.listeners.add(callback);
    
    return () => {
      this.listeners.delete(callback);
    };
  }
}

/**
 * Mutation Cache Implementation
 * Manages all mutations and their states
 */
export class MutationCache implements IMutationCache {
  config: MutationCacheConfig;
  mutations: Mutation[];
  mutationId: number;
  private listeners: Set<MutationCacheListener>;

  constructor(config: MutationCacheConfig = {}) {
    this.config = config;
    this.mutations = [];
    this.mutationId = 0;
    this.listeners = new Set();
  }

  build<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
    _client: PGRestifyClient, // Unused for now
    options: MutationOptions<TData, TError, TVariables, TContext>,
    state?: MutationState<TData, TError, TVariables, TContext>
  ): Mutation<TData, TError, TVariables, TContext> {
    const mutation = new MutationImpl<TData, TError, TVariables, TContext>({
      mutationCache: this,
      mutationId: ++this.mutationId,
      options,
      state: state || createInitialMutationState(),
    });

    this.add(mutation as unknown as Mutation);
    return mutation;
  }

  add(mutation: Mutation): void {
    this.mutations.push(mutation);
    
    this.notify({
      type: 'added',
      mutation,
    });
  }

  remove(mutation: Mutation): void {
    const index = this.mutations.indexOf(mutation);
    if (index !== -1) {
      this.mutations.splice(index, 1);
      
      this.notify({
        type: 'removed',
        mutation,
      });
    }
  }

  clear(): void {
    this.mutations.slice().forEach(mutation => {
      this.remove(mutation);
    });
  }

  getAll(): Mutation[] {
    return this.mutations;
  }

  find<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
    filters: MutationFilters
  ): Mutation<TData, TError, TVariables, TContext> | undefined {
    const mutations = this.findAll(filters);
    return mutations[0] as Mutation<TData, TError, TVariables, TContext> | undefined;
  }

  findAll(filters: MutationFilters = {}): Mutation[] {
    return this.mutations.filter(mutation => {
      // Filter by mutation key
      if (filters.mutationKey) {
        if (filters.exact) {
          if (!isEqual(mutation.mutationKey || [], filters.mutationKey)) {
            return false;
          }
        } else {
          if (!matchesQueryKey(mutation.mutationKey || [], filters.mutationKey)) {
            return false;
          }
        }
      }
      
      // Filter by type
      if (filters.type) {
        const isActive = mutation.state.status === 'loading';
        const isPaused = mutation.state.isPaused;
        
        if (filters.type === 'active' && !isActive) return false;
        if (filters.type === 'paused' && !isPaused) return false;
      }
      
      // Custom predicate
      if (filters.predicate && !filters.predicate(mutation)) {
        return false;
      }
      
      return true;
    });
  }

  notify(event: MutationCacheNotifyEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('MutationCache listener error:', error);
      }
    });
  }

  subscribe(callback: MutationCacheListener): () => void {
    this.listeners.add(callback);
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  async resumePausedMutations(): Promise<unknown> {
    const pausedMutations = this.findAll({ type: 'paused' });
    
    const promises = pausedMutations.map(mutation => {
      return (mutation as any).continue?.() || Promise.resolve();
    });
    
    return Promise.allSettled(promises);
  }
}

/**
 * Query Implementation
 */
class QueryImpl<TData = unknown, TError = unknown> implements Query<TData, TError> {
  queryKey: QueryKey;
  queryHash: string;
  options: QueryOptions<TData, TError>;
  state: QueryState<TData, TError>;
  observers: QueryObserver<TData, TError>[];
  cache: QueryCache;
  promise?: Promise<TData>;
  retryer?: Retryer<TData>;
  abortSignalConsumed: boolean;
  defaultOptions?: QueryOptions<TData, TError>;
  
  private gcTimeout?: ReturnType<typeof setTimeout>;

  constructor(config: {
    cache: QueryCache;
    queryKey: QueryKey;
    queryHash: string;
    options: QueryOptions<TData, TError>;
    state: QueryState<TData, TError>;
    defaultOptions?: QueryOptions<TData, TError>;
  }) {
    this.cache = config.cache;
    this.queryKey = config.queryKey;
    this.queryHash = config.queryHash;
    this.options = config.options;
    this.state = config.state;
    this.observers = [];
    this.abortSignalConsumed = false;
    if (config.defaultOptions !== undefined) {
      this.defaultOptions = config.defaultOptions;
    }
    
    this.scheduleGarbageCollection();
  }

  async fetch(_options?: FetchOptions, _fetchMore?: FetchMoreOptions): Promise<TData> {
    // Implementation would go here
    // This is a complex method that handles the actual data fetching
    // For now, returning a promise that resolves to the current data
    return this.state.data as TData;
  }

  async cancel(): Promise<void> {
    if (this.retryer) {
      this.retryer.cancel();
    }
    
    this.setState({
      fetchStatus: 'idle',
    });
  }

  async continue(): Promise<TData> {
    if (this.retryer) {
      this.retryer.continue();
    }
    
    return this.state.data as TData;
  }

  destroy(): void {
    this.cancel();
    
    if (this.gcTimeout) {
      clearTimeout(this.gcTimeout);
    }
    
    this.observers.forEach(observer => {
      observer.destroy();
    });
    
    this.observers = [];
  }

  reset(): void {
    this.destroy();
    this.setState(createInitialQueryState());
  }

  setState(state: Partial<QueryState<TData, TError>>): void {
    const prevState = this.state;
    this.state = { ...prevState, ...state };
    
    // Apply structural sharing to data
    if (state.data !== undefined && this.options.structuralSharing !== false) {
      const structuralSharing = this.options.structuralSharing;
      if (typeof structuralSharing === 'function') {
        this.state.data = structuralSharing(prevState.data, state.data);
      } else {
        this.state.data = replaceEqualDeep(prevState.data, state.data);
      }
    }
    
    this.cache.notify({
      type: 'updated',
      query: this as any,
      action: this.getNotifyAction(),
    });
    
    this.scheduleGarbageCollection();
  }

  setOptions(options: QueryOptions<TData, TError>): void {
    const prevOptions = this.options;
    this.options = { ...prevOptions, ...options };
    
    if (options.queryFn !== prevOptions.queryFn) {
      this.abortSignalConsumed = false;
    }
  }

  setDefaultOptions(options: QueryOptions<TData, TError>): void {
    this.defaultOptions = options;
  }

  trigger(): void {
    this.observers.forEach(observer => {
      observer.updateResult();
    });
  }

  isStale(): boolean {
    if (this.state.isInvalidated) return true;
    
    const staleTime = this.getStaleTime();
    if (staleTime === Infinity) return false;
    
    const timeSinceLastUpdate = Date.now() - this.state.dataUpdatedAt;
    return timeSinceLastUpdate > staleTime;
  }

  private getStaleTime(): number {
    return this.options.staleTime ?? this.defaultOptions?.staleTime ?? 0;
  }

  private getGcTime(): number {
    return this.options.gcTime ?? this.options.cacheTime ?? this.defaultOptions?.gcTime ?? 5 * 60 * 1000;
  }

  private getNotifyAction(): 'success' | 'error' | 'invalidate' | 'fetch' {
    if (this.state.error) return 'error';
    if (this.state.data !== undefined) return 'success';
    if (this.state.fetchStatus === 'fetching') return 'fetch';
    return 'invalidate';
  }

  private scheduleGarbageCollection(): void {
    if (this.gcTimeout) {
      clearTimeout(this.gcTimeout);
    }
    
    if (this.observers.length === 0) {
      const gcTime = this.getGcTime();
      
      if (gcTime !== Infinity) {
        this.gcTimeout = setTimeout(() => {
          if (this.observers.length === 0) {
            this.cache.remove(this as unknown as Query);
          }
        }, gcTime);
      }
    }
  }
}

/**
 * Mutation Implementation
 */
class MutationImpl<TData = unknown, TError = unknown, TVariables = void, TContext = unknown> 
  implements Mutation<TData, TError, TVariables, TContext> {
  mutationId: number;
  mutationKey: MutationKey;
  options: MutationOptions<TData, TError, TVariables, TContext>;
  state: MutationState<TData, TError, TVariables, TContext>;
  
  private mutationCache: MutationCache;
  private retryer?: Retryer<TData>;

  constructor(config: {
    mutationCache: MutationCache;
    mutationId: number;
    options: MutationOptions<TData, TError, TVariables, TContext>;
    state: MutationState<TData, TError, TVariables, TContext>;
  }) {
    this.mutationCache = config.mutationCache;
    this.mutationId = config.mutationId;
    this.mutationKey = config.options.mutationKey || [];
    this.options = config.options;
    this.state = config.state;
  }

  async execute(variables: TVariables): Promise<TData> {
    this.setState({
      status: 'loading',
      variables,
      submittedAt: Date.now(),
    });
    
    try {
      const data = await this.options.mutationFn(variables);
      
      this.setState({
        status: 'success',
        data,
      });
      
      return data;
    } catch (error) {
      this.setState({
        status: 'error',
        error: error as TError,
        failureCount: this.state.failureCount + 1,
        failureReason: error as TError,
      });
      
      throw error;
    }
  }

  async continue(): Promise<TData> {
    if (this.retryer) {
      this.retryer.continue();
    }
    
    return this.state.data as TData;
  }

  destroy(): void {
    if (this.retryer) {
      this.retryer.cancel();
    }
    
    this.mutationCache.remove(this as unknown as Mutation);
  }

  reset(): void {
    this.setState(createInitialMutationState());
  }

  setState(state: Partial<MutationState<TData, TError, TVariables, TContext>>): void {
    this.state = { ...this.state, ...state };
    
    this.mutationCache.notify({
      type: 'updated',
      mutation: this as unknown as Mutation,
    });
  }
}

// Helper functions
function createInitialQueryState<TData = unknown, TError = unknown>(): QueryState<TData, TError> {
  return {
    data: undefined,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: 'idle',
    isInvalidated: false,
    status: 'idle',
  };
}

function createInitialMutationState<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(): 
  MutationState<TData, TError, TVariables, TContext> {
  return {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: 'idle',
    variables: undefined,
    submittedAt: 0,
  };
}

// Placeholder types for implementation
interface FetchOptions {
  cancelRefetch?: boolean;
  meta?: Record<string, unknown>;
  throwOnError?: boolean;
}

interface FetchMoreOptions {
  direction: 'forward' | 'backward';
  pageParam: unknown;
}

interface Retryer<TData = unknown> {
  promise: Promise<TData>;
  cancel: () => void;
  continue: () => void;
  cancelRetry: () => void;
  continueRetry: () => void;
}

// Import types that need to be defined elsewhere
import type { QueryObserver } from './types';