/**
 * Next.js client creation utilities
 */

import { createClient } from '../../core/client';
import { detectNextJSEnvironment, isServer, isEdgeRuntime } from './utils';
import type { PostgRESTClient } from '../../types';
import type { 
  NextJSClientConfig,
  RouterType 
} from './types';

/**
 * Creates an optimized PGRestify client for Next.js applications
 * with automatic environment detection and router-specific optimizations.
 */
export function createNextJSClient(config: NextJSClientConfig): PostgRESTClient {
  const environment = detectNextJSEnvironment();
  
  // Auto-detect router type if not specified
  const routerType: RouterType = config.router || environment.router;
  
  // Apply Next.js specific defaults
  const nextjsDefaults = {
    ssr: {
      enabled: isServer(),
      serialize: true
    },
    cache: {
      enabled: true,
      ttl: routerType === 'app' ? 3600 : 300, // App Router gets longer cache
    },
    fetch: isEdgeRuntime() ? globalThis.fetch : undefined,
    ...config.nextjs
  };

  const clientConfig: any = {
    ...config,
    ssr: nextjsDefaults.ssr,
    headers: {
      'User-Agent': `PGRestify-NextJS/${environment.version}`,
      ...config.headers
    }
  };

  // Only add cache if it's defined
  if (nextjsDefaults.cache) {
    clientConfig.cache = nextjsDefaults.cache;
  }

  // Only add fetch if we have a custom implementation
  if (nextjsDefaults.fetch) {
    clientConfig.fetch = nextjsDefaults.fetch;
  }

  return createClient(clientConfig);
}

/**
 * Creates a server-side client optimized for App Router Server Components
 */
export function createServerClient(config?: Partial<NextJSClientConfig>): PostgRESTClient {
  if (!isServer()) {
    throw new Error('createServerClient can only be used in server environments');
  }

  return createNextJSClient({
    url: process.env.POSTGREST_URL || process.env.NEXT_PUBLIC_POSTGREST_URL!,
    router: 'app',
    ssr: { enabled: true },
    cache: { enabled: true, ttl: 3600 },
    ...config
  });
}

/**
 * Creates a client-side client optimized for browser environments
 */
export function createClientClient(config?: Partial<NextJSClientConfig>): PostgRESTClient {
  if (isServer()) {
    throw new Error('createClientClient can only be used in browser environments');
  }

  return createNextJSClient({
    url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    cache: { enabled: true },
    ...config
  });
}