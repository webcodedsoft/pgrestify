/**
 * Query Key Management System
 * React Query-inspired query key factory and utilities
 */

import type { QueryKey } from './types';

/**
 * Query key factory for consistent cache management
 * Creates hierarchical key structure for better invalidation
 */
export interface QueryKeyFactory {
  // Root keys
  all: () => readonly [string];
  
  // Table-based keys
  tables: () => readonly [string, 'tables'];
  table: (name: string) => readonly [string, 'tables', string];
  
  // Data queries
  tableList: <TFilters = unknown>(
    name: string, 
    filters?: TFilters
  ) => readonly [string, 'tables', string, 'list', TFilters | undefined];
  
  tableInfinite: <TFilters = unknown>(
    name: string,
    filters?: TFilters
  ) => readonly [string, 'tables', string, 'infinite', TFilters | undefined];
  
  tableItem: <TId = unknown>(
    name: string,
    id: TId
  ) => readonly [string, 'tables', string, 'item', TId];
  
  tableCount: <TFilters = unknown>(
    name: string,
    filters?: TFilters
  ) => readonly [string, 'tables', string, 'count', TFilters | undefined];
  
  // RPC keys
  rpc: <TArgs = unknown>(
    name: string,
    args?: TArgs
  ) => readonly [string, 'rpc', string, TArgs | undefined];
  
  // Custom queries
  custom: (...keys: unknown[]) => QueryKey;
}

/**
 * Create a query key factory instance
 */
export function createQueryKeyFactory(baseKey: string = 'pgrestify'): QueryKeyFactory {
  return {
    all: () => [baseKey] as const,
    
    tables: () => [baseKey, 'tables'] as const,
    
    table: (name: string) => [baseKey, 'tables', name] as const,
    
    tableList: <TFilters = unknown>(name: string, filters?: TFilters) => 
      [baseKey, 'tables', name, 'list', filters] as const,
    
    tableInfinite: <TFilters = unknown>(name: string, filters?: TFilters) =>
      [baseKey, 'tables', name, 'infinite', filters] as const,
    
    tableItem: <TId = unknown>(name: string, id: TId) =>
      [baseKey, 'tables', name, 'item', id] as const,
    
    tableCount: <TFilters = unknown>(name: string, filters?: TFilters) =>
      [baseKey, 'tables', name, 'count', filters] as const,
    
    rpc: <TArgs = unknown>(name: string, args?: TArgs) =>
      [baseKey, 'rpc', name, args] as const,
    
    custom: (...keys: unknown[]) => [baseKey, ...keys] as QueryKey,
  };
}

/**
 * Default query key factory instance
 */
export const queryKeys = createQueryKeyFactory();

/**
 * Hash a query key for cache storage
 * Creates a stable string representation of the query key
 */
export function hashQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_, value) => {
    if (typeof value === 'function') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value instanceof RegExp) {
      return value.toString();
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    // Handle circular references and complex objects
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return value;
  });
}

/**
 * Check if two query keys are equal
 */
export function isEqual(a: QueryKey, b: QueryKey): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Deep equality check for query key parts
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Check if a query key matches a filter
 * Supports partial matching for invalidation
 */
export function matchesQueryKey(queryKey: QueryKey, filter: QueryKey): boolean {
  if (filter.length > queryKey.length) return false;
  
  for (let i = 0; i < filter.length; i++) {
    if (!deepEqual(queryKey[i], filter[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all query keys that start with the given prefix
 */
export function getMatchingKeys(queryKeys: QueryKey[], prefix: QueryKey): QueryKey[] {
  return queryKeys.filter(key => matchesQueryKey(key, prefix));
}

/**
 * PostgREST-specific query key utilities
 */
export class PostgRESTQueryKeys {
  constructor(private factory: QueryKeyFactory = queryKeys) {}
  
  /**
   * Create a table query key with filters
   */
  tableQuery<T extends Record<string, unknown>>(
    tableName: string,
    filters?: Partial<T>,
    options?: {
      select?: string[];
      order?: string;
      limit?: number;
      offset?: number;
    }
  ): QueryKey {
    const queryParams = {
      ...(filters && Object.keys(filters).length > 0 && { filters }),
      ...(options?.select && { select: options.select }),
      ...(options?.order && { order: options.order }),
      ...(options?.limit !== undefined && { limit: options.limit }),
      ...(options?.offset !== undefined && { offset: options.offset }),
    };
    
    return Object.keys(queryParams).length > 0
      ? this.factory.tableList(tableName, queryParams)
      : this.factory.tableList(tableName);
  }
  
  /**
   * Create an infinite query key with pagination params
   */
  infiniteTableQuery<T extends Record<string, unknown>>(
    tableName: string,
    filters?: Partial<T>,
    paginationType: 'offset' | 'range' = 'offset'
  ): QueryKey {
    const queryParams = {
      ...(filters && Object.keys(filters).length > 0 && { filters }),
      paginationType,
    };
    
    return this.factory.tableInfinite(tableName, queryParams);
  }
  
  /**
   * Create an RPC query key with proper argument handling
   */
  rpcQuery<TArgs extends Record<string, unknown>>(
    functionName: string,
    args?: TArgs
  ): QueryKey {
    // Sort args keys for consistent caching
    if (args && typeof args === 'object') {
      const sortedArgs = Object.keys(args)
        .sort()
        .reduce((result, key) => {
          (result as Record<string, unknown>)[key] = (args as Record<string, unknown>)[key];
          return result;
        }, {} as TArgs);
      
      return this.factory.rpc(functionName, sortedArgs);
    }
    
    return this.factory.rpc(functionName, args);
  }
  
  /**
   * Get all keys related to a table
   */
  getTableKeys(tableName: string): {
    all: QueryKey;
    list: QueryKey;
    items: QueryKey;
    count: QueryKey;
    infinite: QueryKey;
  } {
    return {
      all: this.factory.table(tableName),
      list: this.factory.tableList(tableName),
      items: [...this.factory.table(tableName), 'item'] as QueryKey,
      count: this.factory.tableCount(tableName),
      infinite: this.factory.tableInfinite(tableName),
    };
  }
  
  /**
   * Get keys for invalidation after mutations
   */
  getInvalidationKeys(tableName: string, operation: 'insert' | 'update' | 'delete' | 'upsert'): QueryKey[] {
    const tableKeys = this.getTableKeys(tableName);
    
    switch (operation) {
      case 'insert':
        return [
          tableKeys.list,
          tableKeys.count,
          tableKeys.infinite,
        ];
      
      case 'update':
        return [
          tableKeys.all, // Invalidate everything for the table
        ];
      
      case 'delete':
        return [
          tableKeys.all, // Invalidate everything for the table
        ];
      
      case 'upsert':
        return [
          tableKeys.all, // Invalidate everything for the table
        ];
      
      default:
        return [tableKeys.all];
    }
  }
}

/**
 * Default PostgREST query keys instance
 */
export const postgrestQueryKeys = new PostgRESTQueryKeys();

/**
 * Utility to create stable query keys for complex objects
 */
export function createStableKey(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    return `[${obj.map(createStableKey).join(',')}]`;
  }
  
  // Sort object keys for stable serialization
  const sortedKeys = Object.keys(obj).sort();
  const keyValuePairs = sortedKeys.map(key => {
    const value = (obj as Record<string, unknown>)[key];
    return `${key}:${createStableKey(value)}`;
  });
  
  return `{${keyValuePairs.join(',')}}`;
}

/**
 * Extract table name from a query key if possible
 */
export function extractTableName(queryKey: QueryKey): string | null {
  if (queryKey.length >= 3 && queryKey[0] === 'pgrestify' && queryKey[1] === 'tables') {
    return typeof queryKey[2] === 'string' ? queryKey[2] : null;
  }
  return null;
}

/**
 * Extract operation type from a query key if possible
 */
export function extractOperation(queryKey: QueryKey): string | null {
  if (queryKey.length >= 4 && queryKey[0] === 'pgrestify' && queryKey[1] === 'tables') {
    return typeof queryKey[3] === 'string' ? queryKey[3] : null;
  }
  return null;
}