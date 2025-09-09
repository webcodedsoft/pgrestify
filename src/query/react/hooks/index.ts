/**
 * PGRestify React Query Hooks
 * Export all React query hooks and utilities
 */

// Core hooks
export {
  useQuery,
  type UseTanStackQueryOptions,
  type UseQueryOptions,
  type UseQueryResult,
} from './useQuery';

export {
  useInfiniteQuery,
  useInfinitePosts,
  useInfiniteComments,
  useInfiniteUsers,
  useInfiniteSearch,
  useInfiniteFeed,
  useInfiniteTableQuery, // deprecated
  type UseTanStackInfiniteQueryOptions,
  type UseTableInfiniteQueryOptions,
  type UseStandardInfiniteQueryOptions,
  type UseInfiniteQueryResult,
} from './useInfiniteQuery';

export {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from './useMutation';

export {
  useInvalidateQueries,
} from './useUtility';

// Types
export type {
  QueryKey,
  QueryFunction,
  InfiniteQueryOptions,
  InfiniteQueryObserverResult,
  InfiniteData,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
} from './useInfiniteQuery';

export type {
  AnyQueryBuilder,
  TypeSafeQueryFunction,
} from './types';