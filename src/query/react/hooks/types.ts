/**
 * Hook-specific type utilities
 * Proper type definitions to avoid 'any' assertions
 */

import type { QueryBuilder } from '../../../core/query-builder';
import type { QueryKey, QueryFunction } from '../../core/types';

// Type-safe QueryBuilder utilities
export type AnyQueryBuilder<T = any> = QueryBuilder<T> | QueryBuilder<Partial<T>> | QueryBuilder<Pick<T, any>>;

// Hook option interfaces with proper typing
export interface TableQueryOptions<TData extends Record<string, unknown>> {
  queryKey?: QueryKey;
  queryBuilder?: (builder: QueryBuilder<TData>) => AnyQueryBuilder<TData>;
  filters?: Partial<TData>;
  select?: string | string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

// Type-safe query function wrapper
export type TypeSafeQueryFunction<TData> = QueryFunction<TData>;

// Type guards for runtime type checking
export function isQueryBuilder<T>(obj: unknown): obj is QueryBuilder<T> {
  return obj !== null && typeof obj === 'object' && 'select' in obj && 'execute' in obj;
}

// Type-safe result extraction
export interface ExecuteResult<TData> {
  data: TData | TData[] | null;
  error: Error | null;
}

// Helper to safely extract data from PostgREST responses
export function extractData<TData>(result: ExecuteResult<TData>): TData {
  if (result.error) {
    throw result.error;
  }
  
  if (result.data === null) {
    throw new Error('No data returned from query');
  }
  
  // Handle both single and array responses
  return (Array.isArray(result.data) ? result.data[0] : result.data) as TData;
}

export function extractDataArray<TData>(result: ExecuteResult<TData>): TData[] {
  if (result.error) {
    throw result.error;
  }
  
  if (result.data === null) {
    return [];
  }
  
  return (Array.isArray(result.data) ? result.data : [result.data]) as TData[];
}

// Type-safe option normalization
export interface NormalizedQueryOptions<TData, TError> {
  queryKey: QueryKey;
  queryFn: QueryFunction<TData>;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  suspense?: boolean;
  throwOnError?: boolean | ((error: TError) => boolean);
}

export function normalizeQueryOptions<TData, TError>(
  arg1: any,
  arg2?: any,
  arg3?: any
): NormalizedQueryOptions<TData, TError> {
  if (Array.isArray(arg1)) {
    // Separate parameters style
    return {
      queryKey: arg1,
      queryFn: arg2,
      ...arg3,
    };
  } else {
    // Object style
    return arg1;
  }
}