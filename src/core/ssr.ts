/**
 * Server-Side Rendering (SSR) support for PGRestify
 */

import type { QueryBuilder } from './query-builder';
import type { PostgRESTClient, QueryResponse } from '../types';

export interface SSRConfig {
  /** Enable SSR mode */
  enabled: boolean;
  
  /** Serialize query results for hydration */
  serialize?: boolean;
  
  /** Custom serialization function */
  serializer?: (data: any) => string;
  
  /** Custom deserialization function */
  deserializer?: (data: string) => any;
}

export interface SSRQueryResult<T> {
  /** Query key for cache identification */
  key: string;
  
  /** Serialized query data */
  data: T[] | null;
  
  /** Error information */
  error: any;
  
  /** Query metadata */
  meta: {
    timestamp: number;
    url: string;
    method: string;
  };
}

/**
 * SSR helper for server-side data fetching
 */
export class SSRHelper {
  private queryResults = new Map<string, SSRQueryResult<any>>();
  private config: SSRConfig;

  constructor(
    private client: PostgRESTClient,
    config: Partial<SSRConfig> = {}
  ) {
    this.config = {
      enabled: true,
      serialize: true,
      serializer: JSON.stringify,
      deserializer: JSON.parse,
      ...config,
    };
  }

  /**
   * Execute query and cache result for SSR
   */
  async executeQuery<T>(
    queryBuilder: QueryBuilder<T>,
    key?: string
  ): Promise<QueryResponse<T>> {
    const queryKey = key || this.generateQueryKey(queryBuilder);
    
    // Execute the query
    const result = await queryBuilder.execute();
    
    // Store result for SSR if enabled
    if (this.config.enabled) {
      const ssrResult: SSRQueryResult<T> = {
        key: queryKey,
        data: result.data,
        error: result.error,
        meta: {
          timestamp: Date.now(),
          url: this.extractUrl(queryBuilder),
          method: 'GET',
        },
      };
      
      this.queryResults.set(queryKey, ssrResult);
    }

    return result;
  }

  /**
   * Get all cached query results for SSR
   */
  getSSRData(): Record<string, SSRQueryResult<any>> {
    const data: Record<string, SSRQueryResult<any>> = {};
    
    for (const [key, result] of this.queryResults) {
      data[key] = result;
    }

    return data;
  }

  /**
   * Serialize SSR data for client-side hydration
   */
  serializeSSRData(): string {
    if (!this.config.serialize) {
      return '{}';
    }

    const data = this.getSSRData();
    return this.config.serializer!(data);
  }

  /**
   * Hydrate client-side cache with SSR data
   */
  hydrateFromSSRData(serializedData: string): void {
    if (!this.config.serialize || !serializedData) {
      return;
    }

    try {
      const data = this.config.deserializer!(serializedData);
      
      for (const [key, result] of Object.entries(data)) {
        const ssrResult = result as SSRQueryResult<any>;
        
        // Add to client cache if available
        if (ssrResult.data) {
          this.client.cache.set(key, ssrResult.data, 300000); // 5 minutes TTL
        }
        
        // Store in local results
        this.queryResults.set(key, ssrResult);
      }
    } catch (error) {
      console.error('Failed to hydrate SSR data:', error);
    }
  }

  /**
   * Check if query result is available from SSR
   */
  hasSSRResult(key: string): boolean {
    return this.queryResults.has(key);
  }

  /**
   * Get SSR result by key
   */
  getSSRResult<T>(key: string): SSRQueryResult<T> | null {
    return this.queryResults.get(key) || null;
  }

  /**
   * Clear all SSR data
   */
  clearSSRData(): void {
    this.queryResults.clear();
  }

  /**
   * Generate unique query key
   */
  private generateQueryKey(queryBuilder: QueryBuilder<any>): string {
    // This would need access to internal query state
    // For now, use a simple hash of the query
    const queryString = this.extractUrl(queryBuilder);
    return `query:${this.simpleHash(queryString)}`;
  }

  /**
   * Extract URL from query builder (would need internal access)
   */
  private extractUrl(_queryBuilder: QueryBuilder<any>): string {
    // This is a placeholder - in real implementation,
    // we'd need access to query builder internals
    return '/api/query';
  }

  /**
   * Simple hash function for query keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * SSR-aware query builder wrapper
 */
export class SSRQueryBuilder<T> {
  constructor(
    private queryBuilder: QueryBuilder<T>,
    private ssrHelper: SSRHelper,
    private queryKey?: string
  ) {}

  /**
   * Execute query with SSR support
   */
  async execute(): Promise<QueryResponse<T>> {
    // Check if we have SSR data first
    const key = this.queryKey || this.ssrHelper['generateQueryKey'](this.queryBuilder);
    
    if (typeof window === 'undefined') {
      // Server-side: execute and cache
      return this.ssrHelper.executeQuery(this.queryBuilder, key);
    } else {
      // Client-side: check SSR cache first
      const ssrResult = this.ssrHelper.getSSRResult<T>(key);
      
      if (ssrResult && ssrResult.data) {
        // Return cached SSR data
        return {
          data: ssrResult.data,
          error: ssrResult.error,
          statusCode: 200,
        };
      }
      
      // No SSR data, execute normally
      return this.queryBuilder.execute();
    }
  }

  /**
   * Proxy all other query builder methods
   */
  select<K extends keyof T>(...columns: K[]): SSRQueryBuilder<T> {
    const newBuilder = this.queryBuilder.select(...columns);
    return new SSRQueryBuilder(newBuilder, this.ssrHelper, this.queryKey);
  }

  eq<K extends keyof T>(column: K, value: T[K]): SSRQueryBuilder<T> {
    const newBuilder = this.queryBuilder.eq(column, value);
    return new SSRQueryBuilder(newBuilder, this.ssrHelper, this.queryKey);
  }

  // ... proxy other methods as needed
}

/**
 * Environment detection utilities
 */
export class SSRUtils {
  /**
   * Check if running on server
   */
  static isServer(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Check if running on client
   */
  static isClient(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Check if we're in a browser environment
   */
  static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * Check if running in Node.js
   */
  static isNode(): boolean {
    return typeof process !== 'undefined' && !!process.versions?.node;
  }

  /**
   * Get environment-appropriate storage
   */
  static getStorage(): Storage | null {
    if (this.isBrowser()) {
      return window.localStorage;
    }
    return null;
  }

  /**
   * Safe JSON parse that doesn't throw
   */
  static safeJsonParse<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  /**
   * Create SSR-safe event listener
   */
  static addEventListener(
    element: EventTarget | null,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): () => void {
    if (!element || !this.isBrowser()) {
      return () => {}; // No-op cleanup
    }

    element.addEventListener(event, handler, options);
    
    return () => {
      element.removeEventListener(event, handler, options);
    };
  }

  /**
   * Create SSR-safe timeout
   */
  static setTimeout(callback: () => void, delay: number): () => void {
    if (!this.isBrowser() && !this.isNode()) {
      return () => {}; // No-op cleanup
    }

    const timeoutId = setTimeout(callback, delay);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }

  /**
   * Get initial props for SSR frameworks (Next.js, Nuxt.js, etc.)
   */
  static async getServerSideProps<T>(
    client: PostgRESTClient,
    queries: Array<() => Promise<any>>
  ): Promise<{ props: { ssrData: string; queries: T[] } }> {
    const ssrHelper = new SSRHelper(client);
    const results: T[] = [];

    // Execute all queries
    for (const query of queries) {
      try {
        const result = await query();
        results.push(result);
      } catch (error) {
        console.error('SSR query failed:', error);
        results.push(null as T);
      }
    }

    return {
      props: {
        ssrData: ssrHelper.serializeSSRData(),
        queries: results,
      },
    };
  }
}

/**
 * React SSR hook (example)
 */
export function useSSRQuery<T>(
  _client: PostgRESTClient,
  _queryBuilder: QueryBuilder<T>,
  _key?: string
): QueryResponse<T> & { isSSR: boolean } {
  // This would be implemented in the React adapter
  // Placeholder for now
  throw new Error('useSSRQuery should be implemented in React adapter');
}

/**
 * Next.js integration helpers
 */
export class NextJSIntegration {
  /**
   * Create getServerSideProps function
   */
  static createGetServerSideProps<T>(
    client: PostgRESTClient,
    queryFn: (context: any) => QueryBuilder<T>[]
  ) {
    return async (context: any) => {
      const queries = queryFn(context);
      const ssrHelper = new SSRHelper(client);
      
      const results = await Promise.allSettled(
        queries.map(query => ssrHelper.executeQuery(query))
      );

      return {
        props: {
          ssrData: ssrHelper.serializeSSRData(),
          initialData: results.map(result => 
            result.status === 'fulfilled' ? result.value : null
          ),
        },
      };
    };
  }

  /**
   * Create getStaticProps function
   */
  static createGetStaticProps<T>(
    client: PostgRESTClient,
    queries: QueryBuilder<T>[]
  ) {
    return async () => {
      const ssrHelper = new SSRHelper(client);
      
      const results = await Promise.allSettled(
        queries.map(query => ssrHelper.executeQuery(query))
      );

      return {
        props: {
          ssrData: ssrHelper.serializeSSRData(),
          initialData: results.map(result => 
            result.status === 'fulfilled' ? result.value : null
          ),
        },
        revalidate: 60, // Revalidate every minute
      };
    };
  }
}