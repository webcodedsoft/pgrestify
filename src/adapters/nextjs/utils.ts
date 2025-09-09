/**
 * Next.js environment detection and utilities
 */

import type { RouterType } from './types';

export interface NextJSEnvironment {
  version: string;
  router: RouterType;
  isServer: boolean;
  isEdge: boolean;
  isDevelopment: boolean;
}

/**
 * Detects the current Next.js environment and configuration
 */
export function detectNextJSEnvironment(): NextJSEnvironment {
  const isServer = typeof window === 'undefined';
  const isEdge = isEdgeRuntime();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Try to detect Next.js version
  let version = 'unknown';
  let router: RouterType = 'auto';
  
  try {
    // Check if we can access Next.js internals
    if (isServer) {
      // Try to detect from Next.js imports or environment
      const nextVersion = process.env.NEXT_VERSION || 
                          process.env.npm_package_dependencies_next ||
                          '14.0.0'; // Default assumption
      version = nextVersion;
      
      // Auto-detect router type based on directory structure
      router = detectRouter();
    } else {
      // Client-side detection
      version = (globalThis as any).__NEXT_DATA__?.buildId ? '13+' : 'unknown';
      router = 'app'; // Assume app router for modern setups
    }
  } catch {
    // Fallback values
    version = '14.0.0';
    router = 'app';
  }

  return {
    version,
    router,
    isServer,
    isEdge,
    isDevelopment
  };
}

/**
 * Checks if running in server environment
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Checks if running in Edge Runtime
 */
export function isEdgeRuntime(): boolean {
  return (globalThis as any).EdgeRuntime !== undefined ||
         process.env.NEXT_RUNTIME === 'edge';
}

/**
 * Attempts to detect the router type based on project structure
 */
function detectRouter(): RouterType {
  try {
    // Check for app directory structure
    if (require.resolve.paths?.('app/layout')?.length) {
      return 'app';
    }
    
    // Check for pages directory structure  
    if (require.resolve.paths?.('pages/_app')?.length) {
      return 'pages';
    }
  } catch {
    // Ignore errors
  }
  
  // Default to app router for modern Next.js
  return 'app';
}

/**
 * Creates a cache key for Next.js caching
 */
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  
  return `${prefix}:${sortedParams}`;
}

/**
 * Safely serializes data for Next.js props
 */
export function serializeForProps<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Gets the current URL in both server and client environments
 */
export function getCurrentURL(): string {
  if (isServer()) {
    return process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
  }
  
  return window.location.origin;
}

/**
 * Determines if the request is for static generation (SSG)
 */
export function isStaticGeneration(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Checks if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Gets Next.js version if available
 */
export function getNextJSVersion(): string {
  try {
    return require('next/package.json').version;
  } catch {
    return 'unknown';
  }
}