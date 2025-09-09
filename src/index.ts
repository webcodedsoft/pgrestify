/**
 * PGRestify - A comprehensive TypeScript client library for PostgREST APIs
 * 
 * @packageDocumentation
 */

// Core exports
export { 
  createClient, 
  PostgRESTClientImpl,
  PostgrestRole 
} from './core/client';
export { QueryBuilder } from './core/query-builder';
export { JWTAuthManager } from './core/auth';
export { MemoryQueryCache, SmartQueryCache, CacheKeyBuilder } from './core/cache';
export { RPCBuilder, TypedRPCBuilder, RPCUtils, PostgreSQLFunctions } from './core/rpc-builder';

// Enum exports for better developer experience
export { 
  JoinType, 
  RealtimeEvent, 
  FilterOp 
} from './types';

// Type exports
export type {
  PostgRESTClient,
  ClientConfig,
  QueryResult,
  QueryError,
  QueryResponse,
  SingleQueryResponse,
  QueryState,
  Filter,
  FilterOperator,
  OrderBy,
  ExecuteOptions,
  HttpClient,
  HttpResponse,
  QueryCache,
  AuthManager,
  AuthStorage,
  JoinConfig,
  JoinBuilder,
} from './types';

export type {
  PostgRESTError,
  ValidationError,
  AuthError,
  NetworkError,
} from './types/errors';

export type {
  AuthSession,
  SignInCredentials,
  SignUpCredentials,
  ResetPasswordCredentials,
  UpdateUserCredentials,
  AuthResponse,
  AuthResult,
  AuthChangeEvent,
  AuthStateChangeCallback,
  UnsubscribeFunction,
  User,
  AuthConfig,
  AuthState,
  JWTPayload,
} from './types/auth';

// Utility exports
export { FetchHttpClient } from './utils/http';
export { validateTableName, validateColumnName } from './utils/validation';

// Version export
export const VERSION = '1.0.0';