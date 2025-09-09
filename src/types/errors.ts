/**
 * Error types for PGRestify
 */

/**
 * Base PostgREST error class
 */
export class PostgRESTError extends Error {
  public override readonly name: string = 'PostgRESTError';
  
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly hint?: string
  ) {
    super(message);
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PostgRESTError);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      hint: this.hint,
    };
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends PostgRESTError {
  public override readonly name: string = 'ValidationError';
  
  constructor(
    message: string, 
    public readonly field: string, 
    public readonly value: unknown
  ) {
    super(message, 400, 'PGRST_VALIDATION_ERROR', { field, value });
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends PostgRESTError {
  public override readonly name: string = 'AuthError';
  
  constructor(message: string, details?: unknown) {
    super(message, 401, 'PGRST_AUTH_ERROR', details);
  }
}

/**
 * Network-related errors (timeouts, connectivity issues, etc.)
 */
export class NetworkError extends PostgRESTError {
  public override readonly name: string = 'NetworkError';
  
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly isTimeout: boolean = false
  ) {
    super(message, 0, 'NETWORK_ERROR', { originalError, isTimeout });
  }
}

/**
 * Permission/authorization errors
 */
export class PermissionError extends PostgRESTError {
  public override readonly name: string = 'PermissionError';
  
  constructor(message: string, details?: unknown) {
    super(message, 403, 'PGRST_PERMISSION_ERROR', details);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends PostgRESTError {
  public override readonly name: string = 'NotFoundError';
  
  constructor(message: string = 'Resource not found', details?: unknown) {
    super(message, 404, 'PGRST_NOT_FOUND', details);
  }
}

/**
 * Conflict errors (e.g., unique constraint violations)
 */
export class ConflictError extends PostgRESTError {
  public override readonly name: string = 'ConflictError';
  
  constructor(message: string, details?: unknown) {
    super(message, 409, 'PGRST_CONFLICT_ERROR', details);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends PostgRESTError {
  public override readonly name: string = 'RateLimitError';
  
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
  }
}

/**
 * Server errors (5xx status codes)
 */
export class ServerError extends PostgRESTError {
  public override readonly name: string = 'ServerError';
  
  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message, statusCode, 'SERVER_ERROR', details);
  }
}

/**
 * Parse and create appropriate error from HTTP response
 */
export async function createErrorFromResponse(response: Response): Promise<PostgRESTError> {
  let errorData: any;
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json') || contentType?.includes('application/vnd.pgrst')) {
      errorData = await response.json();
    } else {
      const text = await response.text();
      errorData = { message: text || response.statusText };
    }
  } catch {
    errorData = { message: response.statusText || 'Unknown error' };
  }

  const message = errorData.message || errorData.details || 'Unknown error';
  const code = errorData.code;
  const details = errorData.details;
  const hint = errorData.hint;

  // Create specific error types based on status code
  switch (response.status) {
    case 400:
      if (code === 'PGRST_VALIDATION_ERROR' || code?.includes('validation')) {
        return new ValidationError(message, errorData.field || 'unknown', errorData.value);
      }
      return new PostgRESTError(message, response.status, code, details, hint);
      
    case 401:
      return new AuthError(message, details);
      
    case 403:
      return new PermissionError(message, details);
      
    case 404:
      return new NotFoundError(message, details);
      
    case 409:
      return new ConflictError(message, details);
      
    case 429:
      const retryAfter = response.headers.get('retry-after');
      return new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : undefined);
      
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, response.status, details);
      
    default:
      return new PostgRESTError(message, response.status, code, details, hint);
  }
}

/**
 * Type guard to check if an error is a PostgREST error
 */
export function isPostgRESTError(error: unknown): error is PostgRESTError {
  return error instanceof PostgRESTError;
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is an auth error
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Type guard to check if an error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard to check if an error is retriable
 */
export function isRetriableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }
  
  if (error instanceof PostgRESTError) {
    // Retry on server errors and rate limits
    return error.statusCode >= 500 || error.statusCode === 429;
  }
  
  return false;
}