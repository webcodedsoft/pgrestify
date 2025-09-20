/**
 * Core TypeScript definitions for PGRestify
 */

import { PostgRESTError } from './errors';
import type {
  User,
  AuthSession,
  SignInCredentials,
  SignUpCredentials,
  AuthStateChangeCallback,
  UnsubscribeFunction,
  AuthResult,
} from './auth';

// Client configuration and interfaces
export interface ClientConfig {
  /** PostgREST API URL */
  url: string;
  
  /** JWT token for authenticated requests (optional) */
  token?: string;
  
  /** Default role for requests (anonymous, authenticated, admin) */
  role?: 'anonymous' | 'authenticated' | 'admin';
  
  /** Database schema to target (default: 'public') */
  schema?: string;
  
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
  
  /** Custom fetch implementation */
  fetch?: typeof fetch;
  
  /** 
   * Transform column names between camelCase (JS) and snake_case (DB)
   * - true: firstName <-> first_name transformation
   * - false: no transformation (default)
   */
  transformColumns?: boolean;
  
  /** Cache configuration */
  cache?: {
    enabled?: boolean;
    ttl?: number;
  };
  
  /** Authentication configuration */
  auth?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
  };

  /** Real-time configuration */
  realtime?: {
    enabled?: boolean;
    url?: string;
    heartbeatInterval?: number;
    reconnect?: {
      enabled: boolean;
      maxAttempts: number;
      delay: number;
    };
  };

  /** SSR configuration */
  ssr?: {
    enabled?: boolean;
    serialize?: boolean;
  };
  
  /** CORS configuration */
  cors?: CORSConfig;
  
  /** Default pagination settings */
  pagination?: {
    defaultPageSize?: number;
    maxPageSize?: number;
  };

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
    backoff: number;
    shouldRetry: (error: Error, attempt: number) => boolean;
  };
}

// Query state and operations
export interface RelationConfig {
  name: string;
  alias: string;
  columns: string[] | '*';
}

export interface QueryState<T = Record<string, unknown>> {
  select?: string;
  filters: Filter<T>[];
  order?: OrderBy<T>;
  limit?: number;
  offset?: number;
  single?: boolean;
  groupBy?: string;
  having?: string;
  role?: string;
  joins?: JoinConfig[];
  relations?: RelationConfig[];
  // Raw PostgREST integration fields
  rawParams?: Record<string, string>;
  rawFilters?: Record<string, string>;
  rawSelect?: string;
  rawOrder?: string;
}

export interface Filter<T = Record<string, unknown>> {
  column: keyof T | string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterOperator = 
  // Enum values
  | FilterOp
  // Backward compatibility - string literals
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'match' | 'imatch'
  | 'in' | 'cs' | 'cd'
  | 'ov' | 'sl' | 'sr' | 'nxl' | 'nxr' | 'adj'
  | 'and' | 'or' | 'not'
  | 'is'
  | 'fts' | 'plfts' | 'phfts' | 'wfts';

export interface OrderBy<T = Record<string, unknown>> {
  column: keyof T;
  ascending: boolean;
  nullsFirst?: boolean | undefined;
}

// Query execution and results
export interface QueryResult<T> {
  data: T[];
  error: null;
  count?: number;
  statusCode?: number;
}

export interface QueryError {
  data: null;
  error: PostgRESTError;
  count?: number;
  statusCode?: number;
}

export type QueryResponse<T> = QueryResult<T> | QueryError;

export interface RawQueryResult<T> {
  data: T | null;
  error: Error | null;
  count: number | null;
  status: number;
  statusText: string;
}

export interface SingleQueryResult<T> {
  data: T;
  error: null;
  statusCode?: number;
}

export interface SingleQueryError {
  data: null;
  error: PostgRESTError;
  statusCode?: number;
}

export type SingleQueryResponse<T> = SingleQueryResult<T> | SingleQueryError;

export interface ExecuteOptions {
  head?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

// Query-level options for table queries
export interface QueryOptions {
  /** 
   * Transform column names between camelCase (JS) and snake_case (DB)
   * Overrides the global transformColumns setting from ClientConfig
   */
  transformColumns?: boolean;
}

// Raw query options for fully custom PostgREST queries
export interface RawQueryOptions {
  /** HTTP method override (defaults to GET for raw(), but can be overridden) */
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';
  
  /** Custom headers to include with the request */
  headers?: Record<string, string>;
  
  /** Query parameters to append to the URL */
  params?: Record<string, string | number | boolean>;
  
  /** Whether to return count information */
  count?: 'exact' | 'planned' | 'estimated';
  
  /** Whether to return only headers (HEAD request) */
  head?: boolean;
  
  /** Override the default schema */
  schema?: string;
  
  /** Cache configuration for this specific query */
  cache?: {
    enabled?: boolean;
    ttl?: number;
    key?: string;
  };
}

// Main client interface
export interface PostgRESTClient {
  from<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    options?: QueryOptions
  ): QueryBuilder<T>;
  
  rpc<TArgs = Record<string, unknown>, TReturn = unknown>(
    functionName: string, 
    args?: TArgs
  ): RPCBuilder<TArgs, TReturn>;
  
  // Raw PostgREST query methods
  raw<T = unknown>(
    path: string,
    options?: RawQueryOptions
  ): Promise<RawQueryResult<T>>;
  
  rawGet<T = unknown>(
    path: string,
    options?: RawQueryOptions
  ): Promise<RawQueryResult<T>>;
  
  rawPost<T = unknown>(
    path: string,
    body?: any,
    options?: RawQueryOptions
  ): Promise<RawQueryResult<T>>;
  
  rawPatch<T = unknown>(
    path: string,
    body?: any,
    options?: RawQueryOptions
  ): Promise<RawQueryResult<T>>;
  
  rawDelete<T = unknown>(
    path: string,
    options?: RawQueryOptions
  ): Promise<RawQueryResult<T>>;
  
  auth: AuthManager;
  cache: QueryCache;
  config: ClientConfig;
  realtime?: RealtimeClient;
  manager: any; // DataManager implementation from core/repository
  ssr: any; // SSRHelper implementation from core/ssr
  
  // Role management
  switchRole(role: PostgrestRole): Promise<void>;
  getCurrentUser(): User | null;
  getCurrentSession(): AuthSession | null;
  
  // Repository pattern
  getRepository(tableName: string): any;
  getCustomRepository<T extends any>(
    repositoryClass: new (...args: any[]) => T,
    tableName: string
  ): T;
  
  // Cache management
  clearCache(): void;
  invalidateCache(pattern: string): void;
  
  // Client extension
  extend(config: Partial<ClientConfig>): PostgRESTClient;
}

// Pagination interfaces
export interface PaginationOptions {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Offset for manual pagination */
  offset?: number;
  /** Limit for manual pagination */
  limit?: number;
}

export interface PaginationResult<T> {
  /** Current page data */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    pageSize: number;
    /** Total number of items */
    totalItems: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there's a next page */
    hasNextPage: boolean;
    /** Whether there's a previous page */
    hasPreviousPage: boolean;
    /** Current offset */
    offset: number;
  };
}

// ORM-style find options interfaces
export type FindOptionsSelect<T> = {
  [K in keyof T]?: boolean | FindOptionsSelect<T[K]>;
}

export type FindOptionsWhere<T> = {
  [K in keyof T]?: T[K] | T[K][] | FindOperator<T[K]>;
}

export type FindOptionsOrder<T> = {
  [K in keyof T]?: 'ASC' | 'DESC' | 1 | -1 | {
    direction?: 'ASC' | 'DESC';
    nulls?: 'FIRST' | 'LAST';
  };
}

export interface FindManyOptions<T> {
  select?: (keyof T)[] | string | string[] | FindOptionsSelect<T>;
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  order?: FindOptionsOrder<T>;
  take?: number; // limit
  skip?: number; // offset
  // Relations/Joins support (ORM-style + PostgREST)
  relations?: string[] | Record<string, boolean>; // ORM-style: ['user', 'user.profile']
  joins?: JoinConfig<any>[]; // PostgREST-style: detailed join configuration
  // PostgREST specific
  single?: boolean;
  maybeSingle?: boolean;
}

export interface FindOneOptions<T> {
  select?: (keyof T)[] | string | string[] | FindOptionsSelect<T>;
  where?: FindOptionsWhere<T>;
  order?: FindOptionsOrder<T>;
  // Relations/Joins support
  relations?: string[] | Record<string, boolean>;
  joins?: JoinConfig<any>[];
}

export interface FindOperator<T> {
  type: string;
  value: T;
}

// CORS configuration
export interface CORSConfig {
  /** Allow credentials */
  credentials?: boolean;
  /** Allowed origins */
  origins?: string | string[];
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  headers?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Max age for preflight */
  maxAge?: number;
}

// Aggregate function types
export interface AggregateResult {
  count?: number;
  sum?: Record<string, number>;
  avg?: Record<string, number>;
  min?: Record<string, any>;
  max?: Record<string, any>;
}

export interface AggregateOptions {
  /** Columns to group by */
  groupBy?: string[];
  /** Having clause for grouped results */
  having?: string;
}

// Column aliasing types
export type ColumnAlias<T> = {
  [K in keyof T]?: string;
} & {
  [alias: string]: keyof T;
};

export interface SelectOptions {
  /** Rename columns in the response */
  alias?: Record<string, string>;
}

// Bulk operation interfaces
export interface BulkInsertOptions {
  /** Batch size for bulk operations */
  batchSize?: number;
  /** Whether to return inserted records */
  returning?: boolean;
  /** Conflict resolution strategy */
  onConflict?: 'ignore' | 'update' | 'error';
  /** Columns to use for conflict detection */
  conflictColumns?: string[];
}

export interface BulkUpdateOptions {
  /** Batch size for bulk operations */
  batchSize?: number;
  /** Whether to return updated records */
  returning?: boolean;
  /** Column to match records by (usually 'id') */
  matchColumn?: string;
}

export interface BulkOperationResult<T> {
  /** Affected records */
  data: T[];
  /** Number of records processed */
  count: number;
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
  /** Any errors that occurred */
  errors: Error[];
}

// Enum types for better developer experience and type safety

/**
 * JOIN types supported by PostgREST
 */
export enum JoinType {
  /** Inner join - only records where related data exists */
  INNER = 'inner',
  /** Left join - all main table records, with related data if exists */
  LEFT = 'left',
  /** Right join - all records from related table */
  RIGHT = 'right',
  /** Full outer join - all records from both tables */
  FULL = 'full',
  /** Cross join - Cartesian product (use with caution!) */
  CROSS = 'cross',
}

/**
 * Real-time subscription events for PostgREST
 */
export enum RealtimeEvent {
  /** Record inserted */
  INSERT = 'INSERT',
  /** Record updated */
  UPDATE = 'UPDATE',
  /** Record deleted */
  DELETE = 'DELETE',
  /** All events (wildcard) */
  ALL = '*',
}

/**
 * Filter operators for PostgREST queries
 */
export enum FilterOp {
  // Comparison operators
  /** Equal to */
  EQ = 'eq',
  /** Not equal to */
  NEQ = 'neq',
  /** Greater than */
  GT = 'gt',
  /** Greater than or equal to */
  GTE = 'gte',
  /** Less than */
  LT = 'lt',
  /** Less than or equal to */
  LTE = 'lte',
  
  // Pattern matching
  /** Like (case-sensitive) */
  LIKE = 'like',
  /** Like (case-insensitive) */
  ILIKE = 'ilike',
  /** Regex match (case-sensitive) */
  MATCH = 'match',
  /** Regex match (case-insensitive) */
  IMATCH = 'imatch',
  
  // Array operations
  /** In array */
  IN = 'in',
  /** Contains */
  CONTAINS = 'cs',
  /** Contained by */
  CONTAINED_BY = 'cd',
  
  // Range operations
  /** Overlaps */
  OVERLAPS = 'ov',
  /** Strictly left */
  STRICTLY_LEFT = 'sl',
  /** Strictly right */
  STRICTLY_RIGHT = 'sr',
  /** Not extends right */
  NOT_EXTENDS_RIGHT = 'nxr',
  /** Not extends left */
  NOT_EXTENDS_LEFT = 'nxl',
  /** Adjacent */
  ADJACENT = 'adj',
  
  // Null operations
  /** Is null/true/false */
  IS = 'is',
  
  // Full-text search
  /** Full-text search */
  FTS = 'fts',
  /** Plain full-text search */
  PLFTS = 'plfts',
  /** Phrase full-text search */
  PHFTS = 'phfts',
  /** Web search full-text search */
  WFTS = 'wfts',
  
  // Logical operations
  /** Logical AND */
  AND = 'and',
  /** Logical OR */
  OR = 'or',
  /** Logical NOT */
  NOT = 'not',
}

// JOIN-related types
export interface JoinConfig<TRelated = Record<string, unknown>> {
  /** The related table/resource name */
  table: string;
  /** Columns to select from the related table */
  select?: string | string[];
  /** Additional filters for the related table */
  filters?: Partial<TRelated>;
  /** Foreign key column (defaults to table_id) */
  foreignKey?: string;
  /** Local key column (defaults to 'id') */
  localKey?: string;
  /** JOIN type - all PostgREST supported join types */
  type?: JoinType | keyof typeof JoinType | 'inner' | 'left' | 'right' | 'full' | 'cross';
}

export interface JoinBuilder<T = Record<string, unknown>> {
  /** Add an inner join */
  innerJoin<TRelated = Record<string, unknown>>(
    table: string, 
    config?: Omit<JoinConfig<TRelated>, 'table' | 'type'>
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }>;
  
  /** Add a left join */
  leftJoin<TRelated = Record<string, unknown>>(
    table: string, 
    config?: Omit<JoinConfig<TRelated>, 'table' | 'type'>
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated | null }>;
  
  /** Add a right join */
  rightJoin<TRelated = Record<string, unknown>>(
    table: string, 
    config?: Omit<JoinConfig<TRelated>, 'table' | 'type'>
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }>;
  
  /** Add a full outer join */
  fullJoin<TRelated = Record<string, unknown>>(
    table: string, 
    config?: Omit<JoinConfig<TRelated>, 'table' | 'type'>
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated | null }>;
  
  /** Add a cross join */
  crossJoin<TRelated = Record<string, unknown>>(
    table: string, 
    config?: Omit<JoinConfig<TRelated>, 'table' | 'type' | 'foreignKey' | 'localKey'>
  ): QueryBuilder<T & { [K in string]: TRelated[] }>;
  
  /** Generic join method */
  join<TRelated = Record<string, unknown>>(
    config: JoinConfig<TRelated>
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }>;
}

// Query builder interface
export interface QueryBuilder<T = Record<string, unknown>> extends JoinBuilder<T> {
  // Selection methods - always return QueryBuilder<T> to maintain method availability
  select<K extends keyof T>(...columns: K[]): QueryBuilder<T>;
  select(query: string): QueryBuilder<T>;
  select(columns: string[]): QueryBuilder<T>;
  
  // Column renaming/aliasing
  selectAs<K extends keyof T>(columns: { [alias: string]: K }): QueryBuilder<Record<string, T[K]>>;
  selectAs(mapping: Record<string, string>): QueryBuilder<Record<string, unknown>>;
  
  // Filter methods - main where method
  where<K extends keyof T>(column: K | string, operator: FilterOperator, value: T[K] | unknown): QueryBuilder<T>;
  
  // Filter methods - comparison
  eq<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T>;
  neq<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T>;
  gt<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T>;
  gte<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T>;
  lt<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T>;
  lte<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T>;
  
  // Filter methods - pattern matching
  like<K extends keyof T>(column: K | string, pattern: string): QueryBuilder<T>;
  ilike<K extends keyof T>(column: K | string, pattern: string): QueryBuilder<T>;
  match<K extends keyof T>(column: K | string, regex: string): QueryBuilder<T>;
  imatch<K extends keyof T>(column: K | string, regex: string): QueryBuilder<T>;
  
  // Filter methods - array operations
  in<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T>;
  contains<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T>;
  containedBy<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T>;
  
  // Filter methods - range operations
  overlaps<K extends keyof T>(column: K | string, range: string): QueryBuilder<T>;
  strictlyLeft<K extends keyof T>(column: K | string, range: string): QueryBuilder<T>;
  strictlyRight<K extends keyof T>(column: K | string, range: string): QueryBuilder<T>;
  notExtendsRight<K extends keyof T>(column: K | string, range: string): QueryBuilder<T>;
  notExtendsLeft<K extends keyof T>(column: K | string, range: string): QueryBuilder<T>;
  adjacent<K extends keyof T>(column: K | string, range: string): QueryBuilder<T>;
  
  // Filter methods - null operations  
  is<K extends keyof T>(column: K | string, value: null | boolean): QueryBuilder<T>;
  
  // Filter methods - full-text search
  fts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T>;
  plfts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T>;
  phfts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T>;
  wfts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T>;
  
  // Logical operations
  and(filters: string): QueryBuilder<T>;
  or(filters: string): QueryBuilder<T>;
  not<K extends keyof T>(column: K | string, operator: FilterOperator, value: T[K] | unknown): QueryBuilder<T>;
  
  // Ordering and pagination
  order<K extends keyof T>(
    column: K | string, 
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
  
  // Pagination helpers
  paginate(options: PaginationOptions): QueryBuilder<T>;
  
  // Role specification for this query
  withRole(role: PostgrestRole | string): QueryBuilder<T>;
  
  // Aggregate functions
  count(column?: keyof T | '*'): QueryBuilder<AggregateResult>;
  sum(column: keyof T): QueryBuilder<AggregateResult>;
  avg(column: keyof T): QueryBuilder<AggregateResult>;
  min(column: keyof T): QueryBuilder<AggregateResult>;
  max(column: keyof T): QueryBuilder<AggregateResult>;
  
  // Group by and having
  groupBy(...columns: (keyof T)[]): QueryBuilder<T>;
  having(condition: string): QueryBuilder<T>;
  
  // Modifiers
  single(): QueryBuilder<T>;
  maybeSingle(): QueryBuilder<T>;
  
  // ORM-style convenience methods
  find(options?: FindManyOptions<T>): Promise<QueryResponse<T>>;
  findBy(where: FindOptionsWhere<T>): Promise<QueryResponse<T>>;
  findBy(options: { where: FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<QueryResponse<T>>;
  findOne(options?: FindOneOptions<T>): Promise<T | null>;
  findOneBy(where: FindOptionsWhere<T>): Promise<T | null>;
  findOneBy(options: { where: FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<T | null>;
  findOneOrFail(options?: FindOneOptions<T>): Promise<T>;
  findOneByOrFail(where: FindOptionsWhere<T>): Promise<T>;
  findOneByOrFail(options: { where: FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<T>;
  getMany(): Promise<QueryResponse<T>>;
  getOne(): Promise<QueryResponse<T>>;
  
  // Execution
  execute(options?: ExecuteOptions): Promise<QueryResponse<T>>;
  executeWithPagination(options?: ExecuteOptions): Promise<PaginationResult<T>>;
  
  // Mutations
  insert(values: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  update(values: Partial<T>): QueryBuilder<T>;
  upsert(values: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  
  // Bulk operations
  bulkInsert(values: Partial<T>[], options?: BulkInsertOptions): Promise<BulkOperationResult<T>>;
  bulkUpdate(values: Partial<T>[], options?: BulkUpdateOptions): Promise<BulkOperationResult<T>>;
  bulkUpsert(values: Partial<T>[], options?: BulkInsertOptions): Promise<BulkOperationResult<T>>;
  bulkDelete(conditions: Partial<T>[]): Promise<BulkOperationResult<T>>;
  
  // Raw PostgREST integration methods
  rawParams(params: Record<string, string>): QueryBuilder<T>;
  rawFilter(filters: Record<string, string>): QueryBuilder<T>;
  rawSelect(selectExpression: string): QueryBuilder<T>;
  rawOrder(orderExpression: string): QueryBuilder<T>;
  rawQuery<TResult = T>(rawQuery: string, options?: ExecuteOptions): Promise<RawQueryResult<TResult[]>>;
  
  // Column transformation
  transformColumns(enabled: boolean): QueryBuilder<T>;
}

// RPC builder interface
export interface RPCBuilder<TArgs = Record<string, unknown>, TReturn = unknown> {
  execute(options?: ExecuteOptions): Promise<QueryResponse<TReturn>>;
  single(): RPCBuilder<TArgs, TReturn>;
}

// HTTP client abstractions
export interface HttpClient {
  get<T = unknown>(
    url: string, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  
  post<T = unknown>(
    url: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  
  patch<T = unknown>(
    url: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  
  put<T = unknown>(
    url: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  
  delete<T = unknown>(
    url: string, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  
  head(
    url: string, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<never>>;

  // Header management methods
  setDefaultHeaders(headers: Record<string, string>): void;
  removeDefaultHeader(key: string): void;
  getDefaultHeaders(): Record<string, string>;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoff: number;
  shouldRetry: (error: Error, attempt: number) => boolean;
}

// Cache interfaces
export interface QueryCache {
  get<T = unknown>(key: string): T | null;
  set<T = unknown>(key: string, data: T, ttl?: number): void;
  invalidate(pattern: string): void;
  clear(): void;
  delete(key: string): void;
  keys(): string[];
  size(): number;
}

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Authentication interfaces  
export interface AuthManager {
  signIn(credentials: SignInCredentials): Promise<AuthResult>;
  signUp(credentials: SignUpCredentials): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): AuthSession | null;
  getUser(): User | null;
  refreshSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: AuthStateChangeCallback): UnsubscribeFunction;
  getHeaders(): Promise<Record<string, string>>;
}

// Import and re-export all auth-related types from auth module
export type {
  SignInCredentials,
  SignUpCredentials,
  AuthSession,
  User,
  AuthStateChangeCallback,
  UnsubscribeFunction,
  AuthResult,
} from './auth';

// Remove duplicate - already imported from auth types

// Storage interface for auth persistence
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Utility types for better type inference
export type TableName = string & { readonly __brand: 'TableName' };
export type ColumnName<T> = keyof T & string;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Real-time subscription types
export type RealtimeSubscription = {
  unsubscribe: () => void;
};

export type PostgresChangesPayload<T = Record<string, unknown>> = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: RealtimeEvent | 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  errors: string[] | null;
};

export type PostgresChangesFilter = {
  schema?: string;
  table?: string;
  filter?: string;
};

export type SubscriptionCallback<T = Record<string, unknown>> = (
  payload: PostgresChangesPayload<T>
) => void;

// Re-export from errors module
export type { PostgRESTError, ValidationError, AuthError, NetworkError } from './errors';

// Forward declarations for missing types
export interface RealtimeClient {
  connect(): Promise<void>;
  disconnect(): void;
  from(tableName: string): any;
}

export enum PostgrestRole {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated', 
  ADMIN = 'admin',
}