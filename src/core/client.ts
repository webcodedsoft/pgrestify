/**
 * Core PostgREST client implementation with TypeORM-like API
 */

import { FetchHttpClient } from '../utils/http';
import { validateUrl, validateSchemaName } from '../utils/validation';
import { MemoryQueryCache } from './cache';
import { JWTAuthManager } from './auth';
import { QueryBuilder } from './query-builder';
import { RPCBuilder } from './rpc-builder';
import { DataManager, Repository } from './repository';
import { RealtimeClient } from './realtime';
import { SSRHelper } from './ssr';
import type {
  PostgRESTClient,
  ClientConfig,
  HttpClient,
  QueryCache,
  AuthManager,
  AuthStorage,
} from '../types';

/**
 * Check if we're running in a Node.js environment
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && 
         process.versions !== undefined && 
         process.versions.node !== undefined;
}

/**
 * Safely get environment variable
 */
function getEnvVar(key: string): string | undefined {
  if (!isNodeEnvironment()) return undefined;
  return process.env[key];
}

/**
 * Detect if running in a Docker container
 */
function isDockerEnvironment(): boolean {
  if (!isNodeEnvironment()) return false;
  
  return (
    getEnvVar('DOCKER_CONTAINER') === 'true' ||
    getEnvVar('KUBERNETES_SERVICE_HOST') !== undefined ||
    getEnvVar('HOSTNAME')?.includes('docker') ||
    getEnvVar('CONTAINER_NAME') !== undefined
  );
}

/**
 * Default client configuration with Docker optimizations
 */
const DEFAULT_CONFIG: Partial<ClientConfig> = {
  schema: 'public',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    // Add container identification for debugging
    ...(isDockerEnvironment() && {
      'X-Container-Name': getEnvVar('HOSTNAME') || 'unknown',
      'X-Container-Environment': 'docker',
    }),
  },
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
  },
  auth: {
    autoRefreshToken: true,
    persistSession: !isDockerEnvironment(), // Use stateless auth in containers by default
    detectSessionInUrl: false,
  },
  // Docker-friendly timeout settings
  timeout: isDockerEnvironment() ? 30000 : 10000, // 30s for containers, 10s for local
  retry: {
    attempts: isDockerEnvironment() ? 5 : 3,
    delay: isDockerEnvironment() ? 2000 : 1000,
    backoff: 1.5,
    shouldRetry: (error: Error) => {
      // Retry on common Docker network errors
      const dockerNetworkErrors = [
        'ECONNREFUSED',
        'ETIMEDOUT', 
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN', // DNS resolution failures
      ];
      
      return dockerNetworkErrors.some(errorType => 
        error.message.includes(errorType)
      );
    },
  },
};

/**
 * PostgREST roles for database access (aligned with PostgreSQL naming)
 */
export enum PostgrestRole {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated',
  ADMIN = 'admin',
}

/**
 * Browser-compatible storage implementation
 */
class BrowserStorage implements AuthStorage {
  private storage: Storage;

  constructor(useSessionStorage = false) {
    this.storage = useSessionStorage ? sessionStorage : localStorage;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.storage.setItem(key, value);
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.storage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Memory-only storage for Node.js or when localStorage is not available
 */
class MemoryStorage implements AuthStorage {
  private storage = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }
}

/**
 * Main PostgREST client implementation
 */
export class PostgRESTClientImpl {
  public readonly config: ClientConfig;
  public readonly auth: AuthManager;
  public readonly cache: QueryCache;
  public readonly manager: DataManager;
  public readonly realtime: RealtimeClient;
  public readonly ssr: SSRHelper;
  private readonly httpClient: HttpClient;

  constructor(config: ClientConfig) {
    // Validate and merge configuration
    this.config = this.validateAndMergeConfig(config);
    
    // Initialize HTTP client
    this.httpClient = new FetchHttpClient(
      this.config.url,
      this.buildDefaultHeaders(),
      this.config.fetch
    );

    // Initialize cache
    this.cache = new MemoryQueryCache({
      enabled: this.config.cache?.enabled ?? true,
      ttl: this.config.cache?.ttl ?? 300000,
    });

    // Initialize auth manager
    const storage = this.createAuthStorage();
    this.auth = new JWTAuthManager(
      this.httpClient,
      storage,
      this.config.auth
    );

    // Set up auth header updates
    this.setupAuthHeaderUpdates();

    // Initialize data manager (TypeORM-like repositories)
    this.manager = new DataManager(
      this.httpClient,
      this.cache,
      this.auth,
      this.config
    );

    // Initialize real-time client
    const realtimeConfig = {
      url: this.config.realtime?.url || `${this.config.url.replace(/^http/, 'ws')}/realtime`,
      ...(this.config.realtime?.heartbeatInterval !== undefined && { heartbeatInterval: this.config.realtime.heartbeatInterval }),
      ...(this.config.realtime?.reconnect !== undefined && { reconnect: this.config.realtime.reconnect }),
    };
    this.realtime = new RealtimeClient(realtimeConfig, this.auth);

    // Initialize SSR helper
    this.ssr = new SSRHelper(this as unknown as PostgRESTClient, {
      enabled: this.config.ssr?.enabled ?? false,
      serialize: this.config.ssr?.serialize ?? true,
    });
  }

  /**
   * Create a query builder for a table (TypeORM-like API)
   */
  from<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    options?: import('../types').QueryOptions
  ): QueryBuilder<T> {
    return new QueryBuilder<T>(
      table,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      undefined,
      options
    );
  }

  /**
   * Call a PostgreSQL function via RPC
   */
  rpc<TArgs = Record<string, unknown>, TReturn = unknown>(
    functionName: string,
    args?: TArgs
  ): RPCBuilder<TArgs, TReturn> {
    return new RPCBuilder<TArgs, TReturn>(
      functionName,
      this.httpClient,
      this.auth,
      this.config,
      args
    );
  }

  /**
   * Switch database role (anonymous, authenticated, admin)
   */
  async switchRole(role: PostgrestRole): Promise<void> {
    const headers: Record<string, string> = {};

    switch (role) {
      case PostgrestRole.ANONYMOUS:
        // For anonymous access, remove authorization header
        this.httpClient.removeDefaultHeader('Authorization');
        break;
      case PostgrestRole.AUTHENTICATED:
        const authHeaders = await this.auth.getHeaders();
        Object.assign(headers, authHeaders);
        break;
      case PostgrestRole.ADMIN:
        const adminHeaders = await this.auth.getHeaders();
        if (adminHeaders.Authorization) {
          headers['Authorization'] = adminHeaders.Authorization;
          headers['X-PostgREST-Role'] = 'admin';
        } else {
          throw new Error('Admin role requires authentication');
        }
        break;
    }

    if (Object.keys(headers).length > 0) {
      this.httpClient.setDefaultHeaders(headers);
    }
  }

  /**
   * Get current user from auth session
   */
  getCurrentUser() {
    return this.auth.getUser();
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.auth.getSession();
  }

  /**
   * Get repository for a table (TypeORM-style)
   */
  getRepository<T extends Record<string, unknown>>(
    tableName: string
  ): Repository<T> {
    return this.manager.getRepository<T>(tableName);
  }

  /**
   * Get custom repository instance
   */
  getCustomRepository<T extends any>(
    repositoryClass: new (...args: any[]) => T,
    tableName: string
  ): T {
    return this.manager.getCustomRepository(repositoryClass as any, tableName) as T;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCache(pattern: string): void {
    this.cache.invalidate(pattern);
  }

  /**
   * Create a new client instance with different configuration
   */
  extend(config: Partial<ClientConfig>): PostgRESTClient {
    return new PostgRESTClientImpl({
      ...this.config,
      ...config,
    }) as unknown as PostgRESTClient;
  }

  /**
   * Execute a raw PostgREST query with full control over the request
   */
  async raw<T = unknown>(path: string, options?: import('../types').RawQueryOptions): Promise<import('../types').RawQueryResult<T>> {
    const method = options?.method || 'GET';
    const headers: Record<string, string> = {
      ...await this.auth.getHeaders(),
      ...options?.headers,
    };

    // Add schema headers if specified
    if (options?.schema) {
      headers['Accept-Profile'] = options.schema;
      headers['Content-Profile'] = options.schema;
    }

    // Add count header if specified
    if (options?.count) {
      headers['Prefer'] = `count=${options.count}`;
    }

    // Build query parameters
    const searchParams = new URLSearchParams();
    if (options?.params && method === 'GET') {
      Object.entries(options.params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
    }

    const pathWithQuery = `/${path.replace(/^\//, '')}${
      searchParams.toString() ? `?${searchParams.toString()}` : ''
    }`;

    try {
      let response: import('../types').HttpResponse<T>;

      switch (method) {
        case 'GET':
          response = await this.httpClient.get<T>(pathWithQuery, headers);
          break;
        case 'POST':
          response = await this.httpClient.post<T>(pathWithQuery, options?.params, headers);
          break;
        case 'PATCH':
          response = await this.httpClient.patch<T>(pathWithQuery, options?.params, headers);
          break;
        case 'PUT':
          response = await this.httpClient.put<T>(pathWithQuery, options?.params, headers);
          break;
        case 'DELETE':
          response = await this.httpClient.delete<T>(pathWithQuery, headers);
          break;
        case 'HEAD':
          await this.httpClient.head(pathWithQuery, headers);
          response = {
            data: null as T,
            headers: {},
            status: 200,
            statusText: 'OK',
          };
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      const data = method === 'HEAD' || options?.head ? null : response.data;
      const count = response.headers?.['content-range']?.split('/')[1];

      return {
        data: data as T,
        count: count === '*' ? null : count ? parseInt(count, 10) : null,
        error: null,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        data: null,
        count: null,
        error: error instanceof Error ? error : new Error(String(error)),
        status: (error as any)?.status || 0,
        statusText: (error as any)?.statusText || 'Unknown Error',
      };
    }
  }

  /**
   * Execute a raw GET request to PostgREST
   */
  async rawGet<T = unknown>(path: string, options?: import('../types').RawQueryOptions): Promise<import('../types').RawQueryResult<T>> {
    return this.raw<T>(path, { ...options, method: 'GET' });
  }

  /**
   * Execute a raw POST request to PostgREST
   */
  async rawPost<T = unknown>(path: string, body?: any, options?: import('../types').RawQueryOptions): Promise<import('../types').RawQueryResult<T>> {
    return this.raw<T>(path, { ...options, method: 'POST', params: body });
  }

  /**
   * Execute a raw PATCH request to PostgREST
   */
  async rawPatch<T = unknown>(path: string, body?: any, options?: import('../types').RawQueryOptions): Promise<import('../types').RawQueryResult<T>> {
    return this.raw<T>(path, { ...options, method: 'PATCH', params: body });
  }

  /**
   * Execute a raw DELETE request to PostgREST
   */
  async rawDelete<T = unknown>(path: string, options?: import('../types').RawQueryOptions): Promise<import('../types').RawQueryResult<T>> {
    return this.raw<T>(path, { ...options, method: 'DELETE' });
  }

  private validateAndMergeConfig(config: ClientConfig): ClientConfig {
    if (!config.url) {
      throw new Error('PostgREST URL is required');
    }

    const validatedUrl = validateUrl(config.url);
    
    if (config.schema) {
      validateSchemaName(config.schema);
    }

    return {
      ...DEFAULT_CONFIG,
      ...config,
      url: validatedUrl,
      headers: {
        ...DEFAULT_CONFIG.headers,
        ...config.headers,
      },
      cache: {
        ...DEFAULT_CONFIG.cache,
        ...config.cache,
      },
      auth: {
        ...DEFAULT_CONFIG.auth,
        ...config.auth,
      },
    };
  }

  private buildDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    // Add schema header
    if (this.config.schema && this.config.schema !== 'public') {
      headers['Accept-Profile'] = this.config.schema;
      headers['Content-Profile'] = this.config.schema;
    }

    // Add JWT token if provided
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    // Set role-specific headers if role is specified
    if (this.config.role === 'admin') {
      headers['X-PostgREST-Role'] = 'admin';
    }

    return headers;
  }

  private createAuthStorage(): AuthStorage {
    // Try to use browser storage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      return new BrowserStorage(false); // Use localStorage
    }

    // Fallback to memory storage
    return new MemoryStorage();
  }

  private setupAuthHeaderUpdates(): void {
    // Listen to auth state changes and update HTTP client headers
    this.auth.onAuthStateChange(async (session) => {
      if (session) {
        // User is authenticated
        const authHeaders = await this.auth.getHeaders();
        this.httpClient.setDefaultHeaders(authHeaders);
      } else {
        // User is not authenticated, use anonymous role
        this.httpClient.removeDefaultHeader('Authorization');
        await this.switchRole(PostgrestRole.ANONYMOUS);
      }
    });
  }
}

/**
 * Create a new PostgREST client instance
 */
export function createClient(config: ClientConfig): PostgRESTClient {
  return new PostgRESTClientImpl(config) as unknown as PostgRESTClient;
}


// Re-export the PostgRESTClient type for external use
export type { PostgRESTClient } from '../types';