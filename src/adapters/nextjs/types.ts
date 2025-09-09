/**
 * Next.js adapter types
 */

import type { PostgRESTClient, ClientConfig } from '../../types';
// Note: Next.js types are imported as `any` to avoid build-time dependencies

export type RouterType = 'pages' | 'app' | 'auto';

export interface NextJSClientConfig extends ClientConfig {
  /** Next.js router type (auto-detected if not specified) */
  router?: RouterType;
  /** Enable Next.js specific optimizations */
  nextjs?: {
    /** Enable automatic cache management */
    cache?: boolean;
    /** Enable Edge Runtime compatibility */
    edge?: boolean;
    /** Enable streaming for large responses */
    streaming?: boolean;
    /** Custom revalidation tags */
    revalidate?: string | string[];
  };
}

export interface GetServerSidePropsContext<T = any> {
  client: PostgRESTClient;
  params?: { [key: string]: string | string[] };
  query: { [key: string]: string | string[] };
  req: any;
  res: any;
  resolvedUrl: string;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  preview?: boolean;
  previewData?: T;
}

export interface GetStaticPropsContext<T = any> {
  client: PostgRESTClient;
  params?: { [key: string]: string | string[] };
  preview?: boolean;
  previewData?: T;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
}

export interface ServerComponentProps {
  params: { [key: string]: string | string[] };
  searchParams: { [key: string]: string | string[] | undefined };
}

export interface AuthMiddlewareConfig {
  /** Paths that require authentication */
  protectedPaths?: string[];
  /** Public paths that bypass auth */
  publicPaths?: string[];
  /** Redirect URL for unauthenticated users */
  signInUrl?: string;
  /** Custom auth validation function */
  validateAuth?: (request: any) => Promise<boolean>;
}

export interface CacheStrategy {
  /** Cache key strategy */
  keyStrategy?: 'url' | 'query' | ((params: any) => string);
  /** Time to live in seconds */
  ttl?: number;
  /** Revalidation tags */
  tags?: string[];
  /** Cache on stale-while-revalidate */
  swr?: boolean;
}

export interface RouteHandlerContext {
  params: { [key: string]: string | string[] };
}

export interface ServerActionContext<T = any> {
  formData?: FormData;
  data?: T;
}

export interface OptimisticUpdateOptions<T> {
  /** Optimistic update function */
  updateFn: (current: T[], newData: T) => T[];
  /** Rollback function on error */
  rollbackFn?: (current: T[], error: Error) => T[];
}

export interface SSRCacheOptions {
  /** Enable SSR caching */
  enabled?: boolean;
  /** Cache key prefix */
  keyPrefix?: string;
  /** Cache TTL in seconds */
  ttl?: number;
}

export interface EdgeRuntimeOptions {
  /** Enable Edge Runtime compatibility */
  enabled?: boolean;
  /** Streaming threshold in bytes */
  streamingThreshold?: number;
  /** Maximum response size for Edge Runtime */
  maxResponseSize?: number;
}

export type NextJSHookOptions = {
  /** Suspense mode for React 18+ */
  suspense?: boolean;
  /** Enable automatic revalidation */
  revalidate?: boolean | number;
  /** Cache strategy */
  cache?: CacheStrategy;
};