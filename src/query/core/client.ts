/**
 * PGRestifyClient - Core Query Client
 * TanStack Query-inspired client with PostgREST integration
 */

import type {
  PGRestifyClient as IPGRestifyClient,
  PGRestifyClientConfig,
  QueryCache as IQueryCache,
  MutationCache as IMutationCache,
  QueryOptions,
  MutationOptions,
  DefaultOptions,
  QueryKey,
  QueryFilters,
  MutationFilters,
  InvalidateQueryFilters,
  RefetchQueryFilters,
  ResetQueryFilters,
  InvalidateOptions,
  RefetchOptions,
  CancelOptions,
  ResetOptions,
  FetchQueryOptions,
  FetchInfiniteQueryOptions,
  EnsureQueryDataOptions,
  QueryState,
  InfiniteData,
  Updater,
  QueryObserver,
  QueryLogger,
} from './types';
import { QueryBuilder } from '../../core/query-builder';
import { RPCBuilder } from '../../core/rpc-builder';
import { QueryCache, MutationCache } from './cache';
import { hashQueryKey } from './query-key';
import { PostgRESTError } from '../../types/errors';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  defaultOptions: {
    queries: {
      queryKey: [],
      queryFn: () => Promise.resolve(undefined),
      staleTime: 0,
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      structuralSharing: true,
    },
    mutations: {
      mutationFn: () => Promise.resolve(undefined),
      retry: 0,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
};

/**
 * PGRestifyClient Implementation
 * Main client class that manages queries, mutations, and cache
 */
export class PGRestifyClient implements IPGRestifyClient {
  queryCache: IQueryCache;
  mutationCache: IMutationCache;
  defaultOptions: DefaultOptions;
  queryDefaults: QueryOptions;
  mutationDefaults: MutationOptions;
  mountedInstances: Set<QueryObserver>;
  unsubscribeFns: Map<QueryObserver, () => void>;

  // PostgREST specific properties
  private url: string;
  private headers: Record<string, string>;
  private auth?: {
    token?: string;
    getToken?: () => string | Promise<string>;
  } | undefined;
  private logger: QueryLogger | undefined;
  private experimental: {
    structuralSharing: boolean;
    requestDeduplication: boolean;
  };

  // Internal state
  private isFetchingMap: Map<string, Promise<unknown>>;
  private isDestroyed: boolean;

  constructor(config: PGRestifyClientConfig = {}) {
    // Initialize caches
    this.queryCache = config.queryCache || new QueryCache();
    this.mutationCache = config.mutationCache || new MutationCache();

    // Setup default options
    this.defaultOptions = {
      queries: {
        ...DEFAULT_CONFIG.defaultOptions.queries,
        ...(config.defaultOptions?.queries || {}),
      },
      mutations: {
        ...DEFAULT_CONFIG.defaultOptions.mutations,
        ...(config.defaultOptions?.mutations || {}),
      },
    };
    this.queryDefaults = this.defaultOptions.queries || DEFAULT_CONFIG.defaultOptions.queries;
    this.mutationDefaults = this.defaultOptions.mutations || DEFAULT_CONFIG.defaultOptions.mutations;

    // Initialize collections
    this.mountedInstances = new Set();
    this.unsubscribeFns = new Map();
    this.isFetchingMap = new Map();

    // PostgREST configuration
    this.url = config.url || '';
    this.headers = config.headers || {};
    this.auth = config.auth;
    this.logger = config.logger;
    this.experimental = {
      structuralSharing: config.experimental?.structuralSharing ?? true,
      requestDeduplication: config.experimental?.requestDeduplication ?? true,
    };

    this.isDestroyed = false;

    // Setup cache listeners
    this.setupCacheListeners();
  }

  // Lifecycle methods
  mount(): void {
    // Called when first observer mounts
  }

  unmount(): void {
    // Called when last observer unmounts
  }

  clear(): void {
    this.queryCache.clear();
    this.mutationCache.clear();
    this.isFetchingMap.clear();
  }

  destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.clear();
    this.mountedInstances.forEach(instance => {
      instance.destroy();
    });
    this.mountedInstances.clear();
    this.unsubscribeFns.clear();
  }

  // Configuration methods
  getQueryCache(): IQueryCache {
    return this.queryCache;
  }

  getMutationCache(): IMutationCache {
    return this.mutationCache;
  }

  getDefaultOptions(): DefaultOptions {
    return this.defaultOptions;
  }

  setDefaultOptions(options: DefaultOptions): void {
    const queriesUpdate = options.queries ? {
      ...this.defaultOptions.queries,
      ...options.queries,
    } : this.defaultOptions.queries;
    
    const mutationsUpdate = options.mutations ? {
      ...this.defaultOptions.mutations,
      ...options.mutations,
    } : this.defaultOptions.mutations;
    
    this.defaultOptions = {};
    if (queriesUpdate) {
      this.defaultOptions.queries = queriesUpdate;
    }
    if (mutationsUpdate) {
      this.defaultOptions.mutations = mutationsUpdate;
    }
    this.queryDefaults = this.defaultOptions.queries || DEFAULT_CONFIG.defaultOptions.queries;
    this.mutationDefaults = this.defaultOptions.mutations || DEFAULT_CONFIG.defaultOptions.mutations;
  }

  setQueryDefaults(options: QueryOptions): void {
    this.queryDefaults = { ...this.queryDefaults, ...options };
  }

  setMutationDefaults(options: MutationOptions): void {
    this.mutationDefaults = { ...this.mutationDefaults, ...options };
  }

  // Query data methods
  getQueryData<TData = unknown>(queryKey: QueryKey): TData | undefined {
    const queryHash = hashQueryKey(queryKey);
    const query = this.queryCache.get(queryHash);
    return query?.state.data as TData | undefined;
  }

  async ensureQueryData<TData = unknown, TError = unknown>(
    options: EnsureQueryDataOptions<TData, TError>
  ): Promise<TData> {
    const queryHash = hashQueryKey(options.queryKey);
    const query = this.queryCache.get<TData, TError>(queryHash);

    if (query?.state.data !== undefined) {
      const isStale = options.revalidateIfStale !== false && this.isStale(query);
      if (!isStale) {
        return query.state.data;
      }
    }

    return this.fetchQuery(options);
  }

  getQueriesData<TData = unknown>(
    filters: QueryFilters
  ): Array<[QueryKey, TData | undefined]> {
    const queries = this.queryCache.findAll(filters);
    return queries.map(query => [query.queryKey, query.state.data as TData | undefined]);
  }

  setQueryData<TData>(
    queryKey: QueryKey,
    updater: Updater<TData | undefined, TData | undefined>
  ): TData | undefined {
    const queryHash = hashQueryKey(queryKey);
    const query = this.queryCache.get<TData>(queryHash);

    const prevData = query?.state.data;
    const newData = typeof updater === 'function' 
      ? (updater as (input: TData | undefined) => TData | undefined)(prevData)
      : updater;

    if (newData === undefined) {
      return undefined;
    }

    // Create or update query
    const queryOptions = {
      queryKey,
      queryFn: () => Promise.resolve(newData),
    };

    const createdQuery = this.queryCache.build(this, queryOptions as any);
    createdQuery.setState({
      data: newData,
      dataUpdatedAt: Date.now(),
      status: 'success',
    });

    return newData;
  }

  setQueriesData<TData>(
    filters: QueryFilters,
    updater: Updater<TData | undefined, TData | undefined>
  ): Array<[QueryKey, TData | undefined]> {
    const queries = this.queryCache.findAll(filters);
    return queries.map(query => {
      const prevData = query.state.data as TData | undefined;
      const newData = typeof updater === 'function' 
        ? (updater as (input: TData | undefined) => TData | undefined)(prevData)
        : updater;
      
      if (newData !== undefined) {
        query.setState({
          data: newData,
          dataUpdatedAt: Date.now(),
        });
      }
      
      return [query.queryKey, newData];
    });
  }

  // Query invalidation and refetching
  async invalidateQueries<TData = unknown>(
    filters?: InvalidateQueryFilters<TData>,
    options?: InvalidateOptions
  ): Promise<void> {
    const queries = this.queryCache.findAll(filters);
    
    const promises = queries.map(query => {
      query.setState({ isInvalidated: true });
      
      const refetchType = filters?.refetchType ?? 'active';
      const shouldRefetch = this.shouldRefetch(query, refetchType);
      
      if (shouldRefetch && !options?.cancelRefetch) {
        return query.fetch();
      }
      
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  async refetchQueries<TData = unknown>(
    filters?: RefetchQueryFilters<TData>,
    options?: RefetchOptions
  ): Promise<void> {
    const queries = this.queryCache.findAll(filters);
    
    const promises = queries.map(query => {
      if (options?.cancelRefetch) {
        return query.cancel().then(() => query.fetch());
      }
      return query.fetch();
    });

    await Promise.all(promises);
  }

  async cancelQueries(
    filters?: QueryFilters,
    _options?: CancelOptions
  ): Promise<void> {
    const queries = this.queryCache.findAll(filters);
    
    const promises = queries.map(query => query.cancel());
    await Promise.all(promises);
  }

  removeQueries(filters?: QueryFilters): void {
    const queries = this.queryCache.findAll(filters);
    queries.forEach(query => {
      this.queryCache.remove(query);
    });
  }

  async resetQueries<TData = unknown>(
    filters?: ResetQueryFilters<TData>,
    _options?: ResetOptions
  ): Promise<void> {
    const queries = this.queryCache.findAll(filters);
    
    const promises = queries.map(async query => {
      query.reset();
      
      if (query.observers.length > 0) {
        return query.fetch();
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  // Status methods
  isFetching(filters?: QueryFilters): number {
    return this.queryCache
      .findAll({ ...filters, fetchStatus: 'fetching' })
      .length;
  }

  isMutating(filters?: MutationFilters): number {
    return this.mutationCache
      .findAll({ ...filters, type: 'active' })
      .length;
  }

  // Fetch methods
  async fetchQuery<TData = unknown, TError = unknown>(
    options: FetchQueryOptions<TData, TError>
  ): Promise<TData> {
    const queryHash = hashQueryKey(options.queryKey);

    // Request deduplication
    if (this.experimental.requestDeduplication) {
      const existingPromise = this.isFetchingMap.get(queryHash);
      if (existingPromise) {
        return existingPromise as Promise<TData>;
      }
    }

    // Build or get query
    const query = this.queryCache.build(this, options as any);
    
    // Create fetch promise
    const fetchPromise = this.executeFetch(query, options);
    
    if (this.experimental.requestDeduplication) {
      this.isFetchingMap.set(queryHash, fetchPromise);
      
      fetchPromise.finally(() => {
        this.isFetchingMap.delete(queryHash);
      });
    }

    return fetchPromise;
  }

  async fetchInfiniteQuery<TData = unknown, TError = unknown>(
    options: FetchInfiniteQueryOptions<TData, TError>
  ): Promise<InfiniteData<TData>> {
    // Implementation would handle infinite queries
    // For now, returning a basic structure
    const data = await this.fetchQuery(options);
    return {
      pages: [data],
      pageParams: [undefined],
    };
  }

  async prefetchQuery<TData = unknown, TError = unknown>(
    options: FetchQueryOptions<TData, TError>
  ): Promise<void> {
    await this.fetchQuery(options);
  }

  async prefetchInfiniteQuery<TData = unknown, TError = unknown>(
    options: FetchInfiniteQueryOptions<TData, TError>
  ): Promise<void> {
    await this.fetchInfiniteQuery(options);
  }

  // SSR methods
  getQueryState<TData = unknown, TError = unknown>(
    queryKey: QueryKey
  ): QueryState<TData, TError> | undefined {
    const queryHash = hashQueryKey(queryKey);
    const query = this.queryCache.get<TData, TError>(queryHash);
    return query?.state;
  }

  // PostgREST specific methods
  from<T = any>(table: string): QueryBuilder<T> {
    // Create a new QueryBuilder instance with proper client integration
    return new QueryBuilder<T>(
      table,
      this.createHttpClient(),
      this.createLegacyCache(),
      this.createAuthManager(),
      this.createClientConfig()
    );
  }

  rpc<TArgs = any, TReturn = any>(
    functionName: string,
    args?: TArgs
  ): RPCBuilder<TArgs, TReturn> {
    return new RPCBuilder<TArgs, TReturn>(
      functionName,
      this.createHttpClient(),
      this.createAuthManager(),
      this.createClientConfig(),
      args
    );
  }

  // Private helper methods
  private async executeFetch<TData = unknown, TError = unknown>(
    query: any,
    options: FetchQueryOptions<TData, TError>
  ): Promise<TData> {
    query.setState({
      fetchStatus: 'fetching',
      error: null,
    });

    try {
      // Execute the query function
      const data = await options.queryFn({
        queryKey: options.queryKey,
        signal: new AbortController().signal,
        meta: options.meta || {},
      });

      query.setState({
        data,
        dataUpdatedAt: Date.now(),
        status: 'success',
        fetchStatus: 'idle',
        error: null,
        failureCount: 0,
      });

      return data;
    } catch (error) {
      const pgError = error instanceof PostgRESTError 
        ? error 
        : new PostgRESTError(String(error), 500);

      query.setState({
        error: pgError,
        errorUpdatedAt: Date.now(),
        status: 'error',
        fetchStatus: 'idle',
        failureCount: query.state.failureCount + 1,
        failureReason: pgError,
      });

      throw pgError;
    }
  }

  private shouldRefetch(query: any, refetchType: string): boolean {
    const isActive = query.observers.length > 0;
    
    switch (refetchType) {
      case 'active':
        return isActive;
      case 'inactive':
        return !isActive;
      case 'all':
        return true;
      case 'none':
        return false;
      default:
        return isActive;
    }
  }

  private isStale(query: any): boolean {
    if (query.state.isInvalidated) return true;
    
    const staleTime = query.options.staleTime ?? this.queryDefaults.staleTime ?? 0;
    if (staleTime === Infinity) return false;
    
    const timeSinceLastUpdate = Date.now() - query.state.dataUpdatedAt;
    return timeSinceLastUpdate > staleTime;
  }

  private setupCacheListeners(): void {
    // Listen to cache events for logging and debugging
    if (this.logger) {
      this.queryCache.subscribe(event => {
        this.logger?.log('Query cache event:', event);
      });

      this.mutationCache.subscribe(event => {
        this.logger?.log('Mutation cache event:', event);
      });
    }
  }

  // Compatibility methods for existing QueryBuilder integration
  private createHttpClient(): any {
    return {
      get: async (url: string, headers?: Record<string, string>) => {
        const response = await fetch(`${this.url}${url}`, {
          method: 'GET',
          headers: { ...this.headers, ...headers },
        });
        
        if (!response.ok) {
          throw new PostgRESTError(response.statusText, response.status);
        }
        
        return {
          data: await response.json(),
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
      post: async (url: string, data?: any, headers?: Record<string, string>) => {
        const response = await fetch(`${this.url}${url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.headers, ...headers },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new PostgRESTError(response.statusText, response.status);
        }
        
        return {
          data: await response.json(),
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
      patch: async (url: string, data?: any, headers?: Record<string, string>) => {
        const response = await fetch(`${this.url}${url}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...this.headers, ...headers },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new PostgRESTError(response.statusText, response.status);
        }
        
        return {
          data: await response.json(),
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
      delete: async (url: string, headers?: Record<string, string>) => {
        const response = await fetch(`${this.url}${url}`, {
          method: 'DELETE',
          headers: { ...this.headers, ...headers },
        });
        
        if (!response.ok) {
          throw new PostgRESTError(response.statusText, response.status);
        }
        
        return {
          data: response.status === 204 ? null : await response.json(),
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
    };
  }

  private createLegacyCache(): any {
    // Create a legacy cache interface for QueryBuilder compatibility
    return {
      get: (key: string) => {
        // Convert string key to QueryKey and hash
        const queryKey = [key];
        const queryHash = hashQueryKey(queryKey);
        const query = this.queryCache.get(queryHash);
        return query?.state.data;
      },
      set: (key: string, data: any) => {
        const queryKey = [key];
        this.setQueryData(queryKey, data);
      },
      invalidate: (pattern: string) => {
        // Simple pattern matching for legacy compatibility
        const queries = this.queryCache.getAll();
        queries.forEach(query => {
          if (hashQueryKey(query.queryKey).includes(pattern)) {
            query.setState({ isInvalidated: true });
          }
        });
      },
      clear: () => {
        this.queryCache.clear();
      },
    };
  }

  private createAuthManager(): any {
    return {
      getHeaders: async () => {
        let authHeaders: Record<string, string> = {};
        
        if (this.auth?.token) {
          authHeaders['Authorization'] = `Bearer ${this.auth.token}`;
        } else if (this.auth?.getToken) {
          const token = await this.auth.getToken();
          authHeaders['Authorization'] = `Bearer ${token}`;
        }
        
        return { ...this.headers, ...authHeaders };
      },
      getUser: () => {
        // Return current user if available
        return null;
      },
    };
  }

  private createClientConfig(): any {
    return {
      url: this.url,
      headers: this.headers,
    };
  }
}