# Types API Reference

Comprehensive API documentation for PGRestify's type system and type-related utilities.

## Core Type Definitions

```typescript
// Base types for database interactions
type Primitive = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined;

type JSONValue = 
  | Primitive 
  | JSONObject 
  | JSONArray;

interface JSONObject {
  [key: string]: JSONValue;
}

interface JSONArray extends Array<JSONValue> {}
```

## Query Types

```typescript
// Generic query type for type-safe database operations
type Query<T> = {
  select(...columns: (keyof T)[]): Query<T>;
  where(criteria: Partial<T>): Query<T>;
  orderBy(column: keyof T, direction?: 'ASC' | 'DESC'): Query<T>;
  limit(count: number): Query<T>;
  execute(): Promise<T[]>;
};

// Pagination type
interface PaginationOptions {
  page?: number;
  pageSize?: number;
  cursor?: string | number;
}

interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

## Authentication Types

```typescript
// Authentication-related types
enum AuthProvider {
  GITHUB = 'github',
  GOOGLE = 'google',
  FACEBOOK = 'facebook'
}

interface AuthCredentials {
  email: string;
  password: string;
}

interface OAuthOptions {
  provider: AuthProvider;
  scopes?: string[];
}

interface AuthResult<U = User> {
  user: U;
  session: Session;
  error?: AuthError;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
}
```

## Error Types

```typescript
// Comprehensive error type hierarchy
enum ErrorType {
  NETWORK = 'NetworkError',
  AUTHENTICATION = 'AuthenticationError',
  VALIDATION = 'ValidationError',
  NOT_FOUND = 'NotFoundError',
  PERMISSION = 'PermissionError'
}

interface BaseError extends Error {
  type: ErrorType;
  code?: string;
  details?: Record<string, unknown>;
}

interface NetworkError extends BaseError {
  type: ErrorType.NETWORK;
  statusCode?: number;
}

interface AuthenticationError extends BaseError {
  type: ErrorType.AUTHENTICATION;
  reason: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'UNAUTHORIZED';
}

interface ValidationError extends BaseError {
  type: ErrorType.VALIDATION;
  field?: string;
  value?: unknown;
}
```

## Real-time Types

```typescript
// Real-time event types
enum RealtimeEventType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

interface BaseRealtimePayload<T> {
  table: string;
  eventType: RealtimeEventType;
  timestamp: number;
}

interface InsertPayload<T> extends BaseRealtimePayload<T> {
  new: T;
}

interface UpdatePayload<T> extends BaseRealtimePayload<T> {
  old: Partial<T>;
  new: T;
}

interface DeletePayload<T> extends BaseRealtimePayload<T> {
  old: T;
}

type RealtimePayload<T> = 
  | InsertPayload<T>
  | UpdatePayload<T>
  | DeletePayload<T>;
```

## Repository Types

```typescript
// Repository-related types
interface RepositoryOptions<T> {
  softDelete?: {
    enabled: boolean;
    deletedAtColumn?: string;
  };
  hooks?: {
    beforeSave?: (entity: Partial<T>) => Partial<T> | void;
    afterFind?: (entities: T[]) => T[];
  };
}

interface FindOptions<T> {
  where?: Partial<T>;
  relations?: string[];
  order?: {
    [K in keyof T]?: 'ASC' | 'DESC';
  };
  take?: number;
  skip?: number;
}
```

## CORS Types

```typescript
// CORS configuration types
interface CORSOptions {
  origins?: string[] | ((origin: string) => boolean);
  methods?: string[];
  credentials?: boolean;
  headers?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}
```

## Utility Types

```typescript
// Utility type for partial updates
type PartialUpdate<T> = {
  [K in keyof T]?: T[K];
};

// Utility type for making some properties optional
type Optional<T, K extends keyof T> = 
  Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for creating a type with only specific keys
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// Utility type for excluding certain keys
type Omit<T, K extends keyof T> = {
  [P in Exclude<keyof T, K>]: T[P];
};
```

## Advanced Type Utilities

```typescript
// Type guard for checking if a value is of a specific type
function isType<T>(value: unknown, predicate: (val: unknown) => val is T): value is T {
  return predicate(value);
}

// Validate object against a type
function validateType<T>(obj: unknown, schema: Record<keyof T, (val: unknown) => boolean>): obj is T {
  if (typeof obj !== 'object' || obj === null) return false;
  
  return Object.keys(schema).every(key => {
    const validator = schema[key as keyof T];
    return validator((obj as Record<string, unknown>)[key]);
  });
}
```

## Type Inference Helpers

```typescript
// Infer the type of a repository
type InferRepositoryType<R> = R extends Repository<infer T> ? T : never;

// Infer the type of a query result
type InferQueryResult<Q> = Q extends Query<infer T> ? T : never;

// Infer the type of a real-time payload
type InferRealtimePayloadType<P> = 
  P extends RealtimePayload<infer T> ? T : never;
```

## Performance and Optimization Types

```typescript
// Caching configuration types
interface CacheOptions {
  enabled: boolean;
  ttl?: number;
  strategy?: 'lru' | 'fifo' | 'custom';
  maxEntries?: number;
}

// Performance monitoring types
interface PerformanceMetrics {
  queryTime: number;
  cacheHitRate: number;
  networkLatency: number;
}
```

## Security Types

```typescript
// Token validation types
interface TokenValidationOptions {
  requireExpiration?: boolean;
  maxTokenAge?: number;
  validate?: (token: string) => boolean;
}

// Rate limiting configuration
interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: any) => string;
}
```

## Best Practices for Type Usage

- Always use explicit type annotations
- Leverage type inference
- Use utility types for complex type manipulations
- Implement type guards for runtime type checking
- Use generics for flexible, reusable types
- Avoid `any` type whenever possible
- Use discriminated unions for complex type scenarios
- Implement runtime type validation

## Performance Considerations

- Minimize type complexity
- Use type inference
- Avoid excessive type transformations
- Use const assertions for literal types
- Implement efficient type guards
- Profile and optimize type-related operations

## Troubleshooting Type Issues

- Check TypeScript configuration
- Enable strict mode
- Use type assertions carefully
- Implement comprehensive type guards
- Use type predicates for precise type narrowing
- Leverage TypeScript's type system for compile-time checks