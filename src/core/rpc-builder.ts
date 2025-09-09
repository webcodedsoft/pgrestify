/**
 * RPC (Remote Procedure Call) builder for PostgreSQL functions
 */

import { PostgRESTError } from '../types/errors';
import { validateTableName } from '../utils/validation';
import type {
  RPCBuilder as IRPCBuilder,
  QueryResponse,
  ExecuteOptions,
  HttpClient,
  AuthManager,
  ClientConfig,
} from '../types';

/**
 * Builder for calling PostgreSQL functions via PostgREST RPC
 */
export class RPCBuilder<TArgs = Record<string, unknown>, TReturn = unknown> 
  implements IRPCBuilder<TArgs, TReturn> {
  
  private _returnSingle = false;

  constructor(
    private readonly functionName: string,
    private readonly httpClient: HttpClient,
    private readonly auth: AuthManager,
    private readonly config: ClientConfig,
    private readonly args?: TArgs
  ) {
    validateTableName(functionName); // Functions follow same naming rules
  }

  /**
   * Expect single result instead of array
   */
  single(): RPCBuilder<TArgs, TReturn> {
    const newBuilder = this.clone();
    newBuilder._returnSingle = true;
    return newBuilder;
  }

  /**
   * Execute the RPC call
   */
  async execute(options?: ExecuteOptions): Promise<QueryResponse<TReturn>> {
    try {
      const url = this.buildUrl();
      const headers = await this.buildHeaders(options);
      const body = this.buildRequestBody();

      const response = await this.httpClient.post<TReturn | TReturn[]>(url, body, headers);

      let data: TReturn | TReturn[];
      
      if (this._returnSingle) {
        // For single mode, expect single object or first element of array
        if (Array.isArray(response.data)) {
          data = response.data[0] as TReturn;
        } else {
          data = response.data as TReturn;
        }
      } else {
        // For array mode, ensure we return an array
        if (Array.isArray(response.data)) {
          data = response.data as TReturn[];
        } else {
          data = response.data ? [response.data as TReturn] : [] as TReturn[];
        }
      }

      return {
        data: data as any,
        error: null,
        statusCode: response.status,
      };

    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error as PostgRESTError : new PostgRESTError(String(error), 500),
        statusCode: (error && typeof error === 'object' && 'statusCode' in error && typeof (error as any).statusCode === 'number') ? (error as any).statusCode : 500,
      };
    }
  }

  /**
   * Build URL for RPC call
   */
  private buildUrl(): string {
    return `/rpc/${this.functionName}`;
  }

  /**
   * Build request headers
   */
  private async buildHeaders(options?: ExecuteOptions): Promise<Record<string, string>> {
    const headers = await this.auth.getHeaders();

    // Add count header if requested
    if (options?.count) {
      headers['Prefer'] = `count=${options.count}`;
    }

    // Add single resource header for single mode
    if (this._returnSingle) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    return headers;
  }

  /**
   * Build request body with function arguments
   */
  private buildRequestBody(): Record<string, unknown> | null {
    if (!this.args) {
      return null;
    }

    // PostgREST expects function arguments as JSON object
    return this.args as Record<string, unknown>;
  }

  /**
   * Create a copy of this builder
   */
  private clone(): RPCBuilder<TArgs, TReturn> {
    const newBuilder = new RPCBuilder<TArgs, TReturn>(
      this.functionName,
      this.httpClient,
      this.auth,
      this.config,
      this.args
    );
    newBuilder._returnSingle = this._returnSingle;
    return newBuilder;
  }
}

/**
 * Type-safe RPC builder with function signature inference
 */
export class TypedRPCBuilder<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TReturn = unknown
> extends RPCBuilder<TArgs, TReturn> {

  /**
   * Set function arguments with type checking
   */
  withArgs<T extends TArgs>(args: T): TypedRPCBuilder<T, TReturn> {
    return new TypedRPCBuilder<T, TReturn>(
      (this as any).functionName,
      (this as any).httpClient,
      (this as any).auth,
      (this as any).config,
      args
    );
  }

  /**
   * Set expected return type
   */
  returns<T>(): TypedRPCBuilder<TArgs, T> {
    return new TypedRPCBuilder<TArgs, T>(
      (this as any).functionName,
      (this as any).httpClient,
      (this as any).auth,
      (this as any).config,
      (this as any).args
    );
  }
}

/**
 * Utility functions for RPC operations
 */
export class RPCUtils {
  /**
   * Validate function name for PostgreSQL compatibility
   */
  static validateFunctionName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // PostgreSQL function names follow same rules as table names
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 63;
  }

  /**
   * Serialize arguments for RPC call
   */
  static serializeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (value instanceof Date) {
        serialized[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        serialized[key] = JSON.parse(JSON.stringify(value));
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Build function signature string for documentation
   */
  static buildSignature(
    functionName: string,
    args?: Record<string, unknown>,
    returnType?: string
  ): string {
    const argsList = args ? 
      Object.keys(args).map(key => `${key}: ${typeof args[key]}`).join(', ') : 
      '';
    
    const returns = returnType ? ` -> ${returnType}` : '';
    
    return `${functionName}(${argsList})${returns}`;
  }
}

/**
 * Common PostgreSQL function helpers
 */
export class PostgreSQLFunctions {
  /**
   * Helper for common aggregate functions
   */
  static count(tableName: string, column = '*'): string {
    return `SELECT count(${column}) FROM ${tableName}`;
  }

  static sum(tableName: string, column: string): string {
    return `SELECT sum(${column}) FROM ${tableName}`;
  }

  static avg(tableName: string, column: string): string {
    return `SELECT avg(${column}) FROM ${tableName}`;
  }

  static min(tableName: string, column: string): string {
    return `SELECT min(${column}) FROM ${tableName}`;
  }

  static max(tableName: string, column: string): string {
    return `SELECT max(${column}) FROM ${tableName}`;
  }

  /**
   * Helper for JSON operations
   */
  static jsonExtract(column: string, path: string): string {
    return `${column}->>'${path}'`;
  }

  static jsonPath(column: string, path: string): string {
    return `${column}#>>'{${path}}'`;
  }

  /**
   * Helper for array operations
   */
  static arrayContains(column: string, value: unknown): string {
    return `${column} @> '[${JSON.stringify(value)}]'`;
  }

  static arrayLength(column: string): string {
    return `array_length(${column}, 1)`;
  }

  /**
   * Helper for text search
   */
  static fullTextSearch(column: string, query: string, config = 'english'): string {
    return `to_tsvector('${config}', ${column}) @@ plainto_tsquery('${config}', '${query}')`;
  }
}