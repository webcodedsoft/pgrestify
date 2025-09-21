/**
 * PGRestify V2 API - Fluent Query Builder
 * Modern fluent API with method chaining for superior developer experience
 */

// V2 Core - Fluent Factories
export { query, mutation, setGlobalClient } from './core/fluent-factory';

// V2 Core Classes
export { MutationBuilder, RawExpression, ParameterExpression, SubqueryBuilder } from './core/mutation-builder';

// V2 Hooks (Fluent API)
export {
  useQuery,
  useInfiniteQuery,
} from './hooks/useQuery';

export {
  useMutation,
} from './hooks/useMutation';

// V2 Hook Types
export type {
  UseQueryOptions,
  UseQueryResult,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from './hooks/useQuery';

export type {
  UseMutationOptions,
  UseMutationResult,
} from './hooks/useMutation';

// Re-export QueryBuilder from core for advanced usage
export { QueryBuilder } from '../../core/query-builder';

// Re-export common types
export type {
  QueryKey,
  MutationFunction,
  MutateOptions,
} from '../core/types';