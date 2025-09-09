/**
 * Next.js caching utilities
 */

import { createCacheKey } from './utils';
import type { CacheStrategy } from './types';

// Next.js cache imports (these may not be available in all environments)
let nextCache: any;
let nextRevalidateTag: any;

try {
  // Try to import Next.js cache utilities
  const next = require('next/cache');
  nextCache = next.unstable_cache;
  nextRevalidateTag = next.revalidateTag;
} catch {
  // Fallback implementations
  nextCache = null;
  nextRevalidateTag = null;
}

/**
 * Creates a cache strategy for Next.js applications
 */
export function createCacheStrategy(strategy: CacheStrategy) {
  return {
    get: async (_key: string) => {
      // Implementation would depend on caching solution
      // This is a placeholder for the actual cache implementation
      return null;
    },
    set: async (_key: string, _value: any, _ttl?: number) => {
      // Implementation would depend on caching solution
    },
    invalidate: async (_pattern: string) => {
      if (nextRevalidateTag && strategy.tags) {
        strategy.tags.forEach(tag => nextRevalidateTag(tag));
      }
    }
  };
}

/**
 * Hook for managing PGRestify cache in Next.js
 */
export function usePGRestifyCache() {
  const invalidateCache = (tags?: string[]) => {
    if (nextRevalidateTag && tags) {
      tags.forEach(tag => nextRevalidateTag(tag));
    }
  };

  const createKey = (prefix: string, params: Record<string, any>) => {
    return createCacheKey(prefix, params);
  };

  return {
    invalidateCache,
    createKey,
    isAvailable: !!nextCache
  };
}

/**
 * Revalidate cache tags (wrapper for Next.js revalidateTag)
 */
export function revalidateTag(tag: string): void {
  if (nextRevalidateTag) {
    nextRevalidateTag(tag);
  }
}

/**
 * Wrapper for Next.js unstable_cache
 */
export function unstable_cache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts?: string[],
  options?: {
    tags?: string[];
    revalidate?: number | false;
  }
): T {
  if (nextCache) {
    return nextCache(fn, keyParts, options);
  }
  
  // Fallback: return original function
  return fn;
}