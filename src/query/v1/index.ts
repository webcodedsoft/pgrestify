/**
 * PGRestify V1 API - Object-based Configuration
 * Legacy API maintained for backward compatibility
 */

// Core exports (shared)
export { PGRestifyClient } from '../core/client';
export { QueryCache, MutationCache } from '../core/cache';
export { QueryObserver } from '../core/query-observer';
export {
  createQueryKeyFactory,
  queryKeys,
  postgrestQueryKeys,
  hashQueryKey,
  isEqual,
  matchesQueryKey,
} from '../core/query-key';

// React Provider exports (shared)
export {
  PGRestifyProvider,
  usePGRestifyClient,
  usePGRestifySSR,
  useIsHydrating,
  withPGRestify,
  createPGRestifyProvider,
  useNextjsAppRouter,
  usePGRestifyDevtools,
} from '../react/provider';

// V1 Hooks (Object-based API)
export {
  useQuery,
  useTableQuery,
  useSingleQuery,
  useRPC,
} from './hooks/useQuery';

export {
  useMutation,
  useInsert,
  useUpdate,
  useDelete,
  useUpsert,
} from './hooks/useMutation';

export {
  useInfiniteQuery,
  useInfiniteTableQuery,
} from './hooks/useInfiniteQuery';

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
} from './hooks/useUtility';

// V1 Hook Types
export type {
  UseQueryOptions,
  UseQueryResult,
} from './hooks/useQuery';

export type {
  UseMutationOptions,
  UseMutationResult,
} from './hooks/useMutation';

export type {
  UseInfiniteQueryResult,
} from './hooks/useInfiniteQuery';

// Utility exports (shared)
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
} from '../utils/structural-sharing';

// Type exports (shared)
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
} from '../core/types';

// React-specific type exports
export type {
  PGRestifyProviderProps,
} from '../react/provider';

// Version information
export const version = '1.0.0';

// Default client factory  
export function createPGRestifyClient(config: any = {}) {
  return new (require('../core/client').PGRestifyClient)(config);
}