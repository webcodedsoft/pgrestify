/**
 * PGRestify Query System - Main Exports
 * TanStack Query-like implementation for PostgREST
 */

// Core imports
import type { PGRestifyClientConfig } from './core/types';
import { PGRestifyClient } from './core/client';

// Core exports
export { PGRestifyClient };
export { QueryCache, MutationCache } from './core/cache';
export { QueryObserver } from './core/query-observer';
export {
  createQueryKeyFactory,
  queryKeys,
  postgrestQueryKeys,
  hashQueryKey,
  isEqual,
  matchesQueryKey,
} from './core/query-key';

// React exports
export {
  PGRestifyProvider,
  usePGRestifyClient,
  usePGRestifySSR,
  useIsHydrating,
  withPGRestify,
  createPGRestifyProvider,
  useNextjsAppRouter,
  usePGRestifyDevtools,
} from './react/provider';

// React Hooks
export {
  useQuery,
  useTableQuery,
  useSingleQuery,
  useRPC,
} from './react/hooks/useQuery';

export {
  useMutation,
  useInsert,
  useUpdate,
  useDelete,
  useUpsert,
} from './react/hooks/useMutation';

export {
  useInfiniteQuery,
  useInfiniteTableQuery,
} from './react/hooks/useInfiniteQuery';

export {
  useIsFetching,
  useIsMutating,
  useIsQueryFetching,
  useInvalidateQueries,
  useRefetchQueries,
  useResetQueries,
  useCancelQueries,
  useQueryData,
  useSetQueryData,
  useQueries,
  useSubscription,
  useSchema,
} from './react/hooks/useUtility';

// Utility exports
export {
  replaceEqualDeep,
  createStructuralSharing,
  deepEqual,
  shallowEqual,
  replaceEqualArray,
  stableMerge,
  replaceEqualPaginatedData,
  replaceEqualInfiniteData,
  PostgRESTStructuralSharing,
} from './utils/structural-sharing';

// Type exports
export type {
  // Client types
  PGRestifyClient as IPGRestifyClient,
  PGRestifyClientConfig,
  DefaultOptions,
  
  // Query types
  Query,
  QueryOptions,
  QueryState,
  QueryObserver as IQueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
  QueryKey,
  QueryFunction,
  QueryFunctionContext,
  QueryStatus,
  QueryFilters,
  FetchOptions,
  RefetchOptions,
  
  // Mutation types
  Mutation,
  MutationOptions,
  MutationState,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationKey,
  MutationFunction,
  MutationStatus,
  MutationFilters,
  MutateOptions,
  
  // Infinite query types
  InfiniteQueryOptions,
  InfiniteQueryObserverResult,
  InfiniteData,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  
  // Cache types
  QueryCache as IQueryCache,
  MutationCache as IMutationCache,
  QueryCacheConfig,
  MutationCacheConfig,
  QueryCacheListener,
  MutationCacheListener,
  QueryCacheNotifyEvent,
  MutationCacheNotifyEvent,
  
  // Utility types
  Updater,
  FetchStatus,
  QueryMeta,
  MutationMeta,
  QueryLogger,
  Register,
} from './core/types';

// React-specific type exports
export type {
  PGRestifyProviderProps,
} from './react/provider';

// React Hook types
export type {
  UseQueryOptions,
  UseQueryResult,
} from './react/hooks/useQuery';

export type {
  UseMutationOptions,
  UseMutationResult,
} from './react/hooks/useMutation';

export type {
  UseInfiniteQueryResult,
} from './react/hooks/useInfiniteQuery';

// Version information
export const version = '1.0.0';

// Default client factory
export function createPGRestifyClient(config: PGRestifyClientConfig = {}) {
  return new PGRestifyClient(config);
}