/**
 * PGRestify Query System - Main Exports
 * V2 Fluent API - Modern fluent query builder interface
 */

// ===================
// V2 FLUENT API (DEFAULT)
// ===================

// V2 Core - Fluent Factories
export { query, mutation, setGlobalClient } from './v2/core/fluent-factory';

// V2 Core Classes
export { MutationBuilder, RawExpression, ParameterExpression, SubqueryBuilder } from './v2/core/mutation-builder';

// V2 Hooks (Fluent API)
export {
  useQuery,
  useInfiniteQuery,
} from './v2/hooks/useQuery';

export {
  useMutation,
} from './v2/hooks/useMutation';

// V2 Hook Types
export type {
  UseQueryOptions,
  UseQueryResult,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from './v2/hooks/useQuery';

export type {
  UseMutationOptions,
  UseMutationResult,
} from './v2/hooks/useMutation';

// Re-export QueryBuilder from core for advanced usage
export { QueryBuilder } from '../core/query-builder';

// ===================
// V1 LEGACY API ACCESS
// ===================

// Import all v1 exports under a namespace for explicit access
import * as v1 from './v1';
export { v1 };

// ===================
// SHARED CORE EXPORTS
// ===================

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

// React Provider exports (shared between v1 and v2)
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

// Utility Hook exports (shared between v1 and v2)
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

// React-specific type exports (shared)
export type {
  PGRestifyProviderProps,
} from './react/provider';

// Common types re-exported from v2 (avoiding duplicates)
export type {
  QueryKey as V2QueryKey,
  MutationFunction as V2MutationFunction,
  MutateOptions as V2MutateOptions,
} from './v2';

// Version information
export const version = '2.0.0';

// Default client factory
export function createPGRestifyClient(config: PGRestifyClientConfig = {}) {
  return new PGRestifyClient(config);
}

// ===================
// MIGRATION GUIDE
// ===================

/**
 * MIGRATION FROM V1 TO V2
 * 
 * V1 (Object-based API):
 * ```typescript
 * import { useQuery } from '@webcoded/pgrestify';
 * 
 * const { data } = useQuery({
 *   from: 'products',
 *   select: ['id', 'name'],
 *   filter: { active: true },
 *   order: { created_at: 'desc' }
 * });
 * ```
 * 
 * V2 (Fluent API - Default):
 * ```typescript
 * import { useQuery, query } from '@webcoded/pgrestify';
 * 
 * const { data } = useQuery(
 *   ['products', 'active'],
 *   query()
 *     .from('products')
 *     .select(['id', 'name'])
 *     .eq('active', true)
 *     .orderBy('created_at', 'desc')
 * );
 * ```
 * 
 * Continue using V1 (Explicit import):
 * ```typescript
 * import { v1 } from '@webcoded/pgrestify';
 * 
 * const { data } = v1.useQuery({
 *   from: 'products',
 *   select: ['id', 'name'],
 *   filter: { active: true }
 * });
 * ```
 */