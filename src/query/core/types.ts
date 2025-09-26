/**
 * Core types for PGRestify Query System
 * React Query-inspired types with PostgREST specifics
 */

import type { QueryBuilder } from '../../core/query-builder';
import type { RPCBuilder } from '../../core/rpc-builder';
import type { PostgRESTError } from '../../types/errors';

// Global type registration (similar to React Query v5)
export interface Register {
  queryMeta: Record<string, unknown>;
  mutationMeta: Record<string, unknown>;
  defaultError: PostgRESTError;
}

// Query Key System
export type QueryKey = readonly unknown[];
export type MutationKey = readonly unknown[];

// Query Function Types
export interface QueryFunctionContext<TQueryKey extends QueryKey = QueryKey> {
  queryKey: TQueryKey;
  signal?: AbortSignal;
  meta?: QueryMeta;
  pageParam?: unknown;
}

export type QueryFunction<T = unknown, TQueryKey extends QueryKey = QueryKey> = (
  context: QueryFunctionContext<TQueryKey>
) => Promise<T>;

// Mutation Function Types
export interface MutationFunctionContext<
  _TData = unknown,
  _TError = unknown,
  TVariables = void,
  _TContext = unknown
> {
  variables: TVariables;
  mutationKey?: MutationKey;
  signal?: AbortSignal;
  meta?: MutationMeta;
}

export type MutationFunction<TData = unknown, TVariables = void> = (
  variables: TVariables
) => Promise<TData>;

// Query Status and State
export type QueryStatus = 'idle' | 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'loading' | 'error' | 'success';
export type FetchStatus = 'idle' | 'fetching' | 'paused';

export interface QueryState<TData = unknown, TError = unknown> {
  data: TData | undefined;
  dataUpdatedAt: number;
  error: TError | null;
  errorUpdatedAt: number;
  failureCount: number;
  failureReason: TError | null;
  fetchStatus: FetchStatus;
  isInvalidated: boolean;
  status: QueryStatus;
}

export interface MutationState<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  context: TContext | undefined;
  data: TData | undefined;
  error: TError | null;
  failureCount: number;
  failureReason: TError | null;
  isPaused: boolean;
  status: MutationStatus;
  variables: TVariables | undefined;
  submittedAt: number;
}

// Options Types
export interface QueryOptions<
  TData = unknown,
  TError = unknown,
  TSelect = TData
> {
  // Core
  queryKey: QueryKey;
  queryFn: QueryFunction<TData>;
  
  // Behavior
  enabled?: boolean | ((query: Query<TData, TError>) => boolean);
  retry?: boolean | number | ((failureCount: number, error: TError) => boolean);
  retryDelay?: number | ((retryAttempt: number, error: TError) => number);
  
  // Timing
  staleTime?: number;
  cacheTime?: number; // Deprecated in favor of gcTime
  gcTime?: number;
  refetchInterval?: number | false | ((data: TData | undefined, query: Query<TData, TError>) => number | false);
  refetchIntervalInBackground?: boolean;
  
  // Refetch Triggers
  refetchOnMount?: boolean | 'always' | ((query: Query<TData, TError>) => boolean | 'always');
  refetchOnWindowFocus?: boolean | 'always' | ((query: Query<TData, TError>) => boolean | 'always');
  refetchOnReconnect?: boolean | 'always' | ((query: Query<TData, TError>) => boolean | 'always');
  
  // Data Transformation
  select?: (data: TData) => TSelect;
  keepPreviousData?: boolean;
  structuralSharing?: boolean | ((oldData: TData | undefined, newData: TData) => TData);
  
  // Advanced
  suspense?: boolean;
  useErrorBoundary?: boolean | ((error: TError, query: Query<TData, TError>) => boolean);
  meta?: QueryMeta;
  
  // PostgREST specific
  queryBuilder?: (builder: QueryBuilder<any>) => QueryBuilder<any>;
  tableName?: string;
}

export interface MutationOptions<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  mutationFn: MutationFunction<TData, TVariables>;
  mutationKey?: MutationKey;
  
  // Behavior
  retry?: boolean | number | ((failureCount: number, error: TError) => boolean);
  retryDelay?: number | ((retryAttempt: number, error: TError) => number);
  
  // Callbacks
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext | void;
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<unknown> | unknown | void;
  onError?: (
    error: TError,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<unknown> | unknown | void;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<unknown> | unknown | void;
  
  // Advanced
  useErrorBoundary?: boolean | ((error: TError) => boolean);
  meta?: MutationMeta;
  
  // PostgREST specific
  tableName?: string;
  optimisticUpdate?: boolean;
}

export interface InfiniteQueryOptions<
  TData = unknown,
  TError = unknown,
  TSelect = TData
> extends QueryOptions<TData, TError, TSelect> {
  getNextPageParam?: (lastPage: TData, allPages: TData[], lastPageParam: unknown, allPageParams: unknown[]) => unknown;
  getPreviousPageParam?: (firstPage: TData, allPages: TData[], firstPageParam: unknown, allPageParams: unknown[]) => unknown;
  maxPages?: number;
  initialPageParam?: unknown;
}

// Data Types
export interface InfiniteData<TData> {
  pages: TData[];
  pageParams: unknown[];
}

// Query and Mutation Classes (interfaces for now)
export interface Query<TData = unknown, TError = unknown> {
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
  
  // Methods
  fetch(options?: FetchOptions, fetchMore?: FetchMoreOptions): Promise<TData>;
  cancel(): Promise<void>;
  continue(): Promise<TData>;
  destroy(): void;
  reset(): void;
  setState(state: Partial<QueryState<TData, TError>>): void;
  setOptions(options: QueryOptions<TData, TError>): void;
  setDefaultOptions(options: QueryOptions<TData, TError>): void;
  trigger(): void;
}

export interface Mutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  mutationId: number;
  mutationKey?: MutationKey;
  options: MutationOptions<TData, TError, TVariables, TContext>;
  state: MutationState<TData, TError, TVariables, TContext>;
  
  // Methods
  execute(variables: TVariables): Promise<TData>;
  destroy(): void;
  reset(): void;
  setState(state: Partial<MutationState<TData, TError, TVariables, TContext>>): void;
}

// Observer Types
export interface QueryObserver<TData = unknown, TError = unknown> {
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
  
  // Methods
  subscribe(callback: (result: QueryObserverResult<TData, TError>) => void): () => void;
  destroy(): void;
  setOptions(options: QueryObserverOptions<TData, TError>, notifyOptions?: NotifyOptions): void;
  getOptimisticResult(options: QueryObserverOptions<TData, TError>): QueryObserverResult<TData, TError>;
  getCurrentResult(): QueryObserverResult<TData, TError>;
  trackResult(result: QueryObserverResult<TData, TError>): QueryObserverResult<TData, TError>;
  getNextResult(options?: NextResultOptions): Promise<QueryObserverResult<TData, TError>>;
  updateResult(notifyOptions?: NotifyOptions): void;
  refetch(): Promise<QueryObserverResult<TData, TError>>;
  fetchOptimistic(options: QueryObserverOptions<TData, TError>): Promise<QueryObserverResult<TData, TError>>;
}

export interface MutationObserver<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  client: PGRestifyClient;
  currentMutation?: Mutation<TData, TError, TVariables, TContext>;
  currentResult: MutationObserverResult<TData, TError, TVariables, TContext>;
  mutateOptions?: MutateOptions<TData, TError, TVariables, TContext>;
  
  // Methods
  subscribe(callback: (result: MutationObserverResult<TData, TError, TVariables, TContext>) => void): () => void;
  destroy(): void;
  setOptions(options: MutationObserverOptions<TData, TError, TVariables, TContext>): void;
  getCurrentResult(): MutationObserverResult<TData, TError, TVariables, TContext>;
  reset(): void;
  mutate(variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>): Promise<TData>;
}

// Result Types
export interface QueryObserverResult<TData = unknown, TError = unknown> {
  data: TData | undefined;
  dataUpdatedAt: number;
  error: TError | null;
  errorUpdatedAt: number;
  failureCount: number;
  failureReason: TError | null;
  fetchStatus: FetchStatus;
  isError: boolean;
  isFetched: boolean;
  isFetchedAfterMount: boolean;
  isFetching: boolean;
  isInitialLoading: boolean;
  isLoading: boolean;
  isLoadingError: boolean;
  isPaused: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  isPreviousData: boolean;
  isRefetchError: boolean;
  isRefetching: boolean;
  isStale: boolean;
  isSuccess: boolean;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<TData, TError>>;
  remove: () => void;
  status: QueryStatus;
}

export interface InfiniteQueryObserverResult<TData = unknown, TError = unknown>
  extends QueryObserverResult<InfiniteData<TData>, TError> {
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<InfiniteQueryObserverResult<TData, TError>>;
  fetchPreviousPage: (options?: FetchPreviousPageOptions) => Promise<InfiniteQueryObserverResult<TData, TError>>;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
}

export interface MutationObserverResult<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  context: TContext | undefined;
  data: TData | undefined;
  error: TError | null;
  failureCount: number;
  failureReason: TError | null;
  isError: boolean;
  isIdle: boolean;
  isLoading: boolean;
  isPaused: boolean;
  isPending: boolean;
  isSuccess: boolean;
  mutate: (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => void;
  mutateAsync: (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => Promise<TData>;
  reset: () => void;
  status: MutationStatus;
  submittedAt: number;
  variables: TVariables | undefined;
}

// Option Types for Methods
export interface QueryObserverOptions<
  TData = unknown,
  TError = unknown,
  TSelect = TData
> extends QueryOptions<TData, TError, TSelect> {
  // Observer-specific options
  optimisticResults?: boolean;
}

export interface MutationObserverOptions<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> extends MutationOptions<TData, TError, TVariables, TContext> {}

export interface FetchOptions {
  cancelRefetch?: boolean;
  meta?: QueryMeta;
  throwOnError?: boolean;
}

export interface FetchMoreOptions {
  direction: 'forward' | 'backward';
  pageParam: unknown;
}

export interface RefetchOptions {
  cancelRefetch?: boolean;
  throwOnError?: boolean;
}

export interface FetchNextPageOptions {
  cancelRefetch?: boolean;
  throwOnError?: boolean;
}

export interface FetchPreviousPageOptions {
  cancelRefetch?: boolean;
  throwOnError?: boolean;
}

export interface MutateOptions<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: TContext | undefined) => void;
}

export interface NotifyOptions {
  listeners?: boolean;
  cache?: boolean;
}

export interface NextResultOptions {
  throwOnError?: boolean;
}

// Cache Types
export interface QueryCache {
  config: QueryCacheConfig;
  queries: Map<string, Query>;
  queriesInMap: Map<QueryKey, Query>;
  
  // Methods
  build<TData, TError>(client: PGRestifyClient, options: QueryOptions<TData, TError>, state?: QueryState<TData, TError>): Query<TData, TError>;
  add(query: Query): void;
  remove(query: Query): void;
  clear(): void;
  get<TData = unknown, TError = unknown>(queryHash: string): Query<TData, TError> | undefined;
  getAll(): Query[];
  find<TData = unknown, TError = unknown>(filters: QueryFilters): Query<TData, TError> | undefined;
  findAll(filters?: QueryFilters): Query[];
  notify(event: QueryCacheNotifyEvent): void;
  subscribe(callback: QueryCacheListener): () => void;
}

export interface MutationCache {
  config: MutationCacheConfig;
  mutations: Mutation[];
  mutationId: number;
  
  // Methods
  build<TData, TError, TVariables, TContext>(
    client: PGRestifyClient,
    options: MutationOptions<TData, TError, TVariables, TContext>,
    state?: MutationState<TData, TError, TVariables, TContext>
  ): Mutation<TData, TError, TVariables, TContext>;
  add(mutation: Mutation): void;
  remove(mutation: Mutation): void;
  clear(): void;
  getAll(): Mutation[];
  find<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
    filters: MutationFilters
  ): Mutation<TData, TError, TVariables, TContext> | undefined;
  findAll(filters?: MutationFilters): Mutation[];
  notify(event: MutationCacheNotifyEvent): void;
  subscribe(callback: MutationCacheListener): () => void;
  resumePausedMutations(): Promise<unknown>;
}

// Cache Configuration
export interface QueryCacheConfig {
  onError?: (error: unknown, query: Query) => void;
  onSuccess?: (data: unknown, query: Query) => void;
  onSettled?: (data: unknown | undefined, error: unknown | null, query: Query) => void;
}

export interface MutationCacheConfig {
  onError?: (error: unknown, variables: unknown, context: unknown, mutation: Mutation) => void;
  onSuccess?: (data: unknown, variables: unknown, context: unknown, mutation: Mutation) => void;
  onSettled?: (data: unknown | undefined, error: unknown | null, variables: unknown, context: unknown, mutation: Mutation) => void;
  onMutate?: (variables: unknown, mutation: Mutation) => Promise<unknown> | unknown;
}

// Filter Types
export interface QueryFilters {
  queryKey?: QueryKey;
  exact?: boolean;
  type?: 'active' | 'inactive' | 'all';
  stale?: boolean;
  fetchStatus?: FetchStatus;
  predicate?: (query: Query) => boolean;
}

export interface MutationFilters {
  mutationKey?: MutationKey;
  exact?: boolean;
  type?: 'active' | 'paused' | 'all';
  predicate?: (mutation: Mutation) => boolean;
}

// Event Types
export interface QueryCacheNotifyEvent {
  type: 'added' | 'removed' | 'updated';
  query: Query;
  action?: 'success' | 'error' | 'invalidate' | 'fetch';
}

export interface MutationCacheNotifyEvent {
  type: 'added' | 'removed' | 'updated';
  mutation: Mutation;
}

export type QueryCacheListener = (event: QueryCacheNotifyEvent) => void;
export type MutationCacheListener = (event: MutationCacheNotifyEvent) => void;

// Client Types
export interface PGRestifyClient {
  queryCache: QueryCache;
  mutationCache: MutationCache;
  defaultOptions: DefaultOptions;
  queryDefaults: QueryOptions;
  mutationDefaults: MutationOptions;
  mountedInstances: Set<QueryObserver>;
  unsubscribeFns: Map<QueryObserver, () => void>;
  
  // Methods
  mount(): void;
  unmount(): void;
  clear(): void;
  getQueryCache(): QueryCache;
  getMutationCache(): MutationCache;
  getDefaultOptions(): DefaultOptions;
  setDefaultOptions(options: DefaultOptions): void;
  setQueryDefaults(options: QueryOptions): void;
  setMutationDefaults(options: MutationOptions): void;
  
  // Query methods
  getQueryData<TData = unknown>(queryKey: QueryKey): TData | undefined;
  ensureQueryData<TData = unknown, TError = unknown>(options: EnsureQueryDataOptions<TData, TError>): Promise<TData>;
  getQueriesData<TData = unknown>(filters: QueryFilters): Array<[QueryKey, TData | undefined]>;
  setQueryData<TData>(queryKey: QueryKey, updater: Updater<TData | undefined, TData | undefined>): TData | undefined;
  setQueriesData<TData>(filters: QueryFilters, updater: Updater<TData | undefined, TData | undefined>): Array<[QueryKey, TData | undefined]>;
  invalidateQueries<TData = unknown>(filters?: InvalidateQueryFilters<TData>, options?: InvalidateOptions): Promise<void>;
  refetchQueries<TData = unknown>(filters?: RefetchQueryFilters<TData>, options?: RefetchOptions): Promise<void>;
  cancelQueries(filters?: QueryFilters, options?: CancelOptions): Promise<void>;
  removeQueries(filters?: QueryFilters): void;
  resetQueries<TData = unknown>(filters?: ResetQueryFilters<TData>, options?: ResetOptions): Promise<void>;
  isFetching(filters?: QueryFilters): number;
  isMutating(filters?: MutationFilters): number;
  
  // Fetch methods  
  fetchQuery<TData = unknown, TError = unknown>(options: FetchQueryOptions<TData, TError>): Promise<TData>;
  fetchInfiniteQuery<TData = unknown, TError = unknown>(options: FetchInfiniteQueryOptions<TData, TError>): Promise<InfiniteData<TData>>;
  prefetchQuery<TData = unknown, TError = unknown>(options: FetchQueryOptions<TData, TError>): Promise<void>;
  prefetchInfiniteQuery<TData = unknown, TError = unknown>(options: FetchInfiniteQueryOptions<TData, TError>): Promise<void>;
  
  // SSR methods
  getQueryState<TData = unknown, TError = unknown>(queryKey: QueryKey): QueryState<TData, TError> | undefined;
  
  // PostgREST specific methods
  from<T = any>(table: string): QueryBuilder<T>;
  rpc<TArgs = any, TReturn = any>(functionName: string, args?: TArgs): RPCBuilder<TArgs, TReturn>;
}

// Client Configuration
export interface PGRestifyClientConfig {
  queryCache?: QueryCache;
  mutationCache?: MutationCache;
  defaultOptions?: DefaultOptions;
  
  // PostgREST configuration
  url?: string;
  headers?: Record<string, string>;
  auth?: {
    token?: string;
    getToken?: () => string | Promise<string>;
  };
  
  // Advanced options
  logger?: QueryLogger;
  experimental?: {
    structuralSharing?: boolean;
    requestDeduplication?: boolean;
  };
}

export interface DefaultOptions {
  queries?: QueryOptions;
  mutations?: MutationOptions;
}

// Additional Types
export interface QueryMeta extends Record<string, unknown> {}
export interface MutationMeta extends Record<string, unknown> {}

export type Updater<TInput, TOutput> = TOutput | ((input: TInput) => TOutput);

export interface EnsureQueryDataOptions<TData = unknown, TError = unknown> extends FetchQueryOptions<TData, TError> {
  revalidateIfStale?: boolean;
}

export interface FetchQueryOptions<TData = unknown, TError = unknown> extends QueryOptions<TData, TError> {
  staleTime?: number;
}

export interface FetchInfiniteQueryOptions<TData = unknown, TError = unknown> extends InfiniteQueryOptions<TData, TError> {
  staleTime?: number;
}

export interface InvalidateQueryFilters<_TData = unknown> extends QueryFilters {
  refetchType?: 'active' | 'inactive' | 'all' | 'none';
}

export interface RefetchQueryFilters<_TData = unknown> extends QueryFilters {
  type?: 'active' | 'inactive' | 'all';
}

export interface ResetQueryFilters<_TData = unknown> extends QueryFilters {}

export interface InvalidateOptions {
  cancelRefetch?: boolean;
}

export interface CancelOptions {
  revert?: boolean;
  silent?: boolean;
}

export interface ResetOptions {
  exact?: boolean;
}

// Retry Types
export interface Retryer<TData = unknown> {
  promise: Promise<TData>;
  cancel: () => void;
  continue: () => void;
  cancelRetry: () => void;
  continueRetry: () => void;
}

// Logger Type
export interface QueryLogger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

// Utility Types for better type inference
export type QueryClientProviderProps = {
  client: PGRestifyClient;
  children?: React.ReactNode;
};