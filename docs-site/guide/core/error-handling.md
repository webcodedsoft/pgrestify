# Error Handling

Learn how to handle errors effectively when working with PGRestify and PostgREST APIs.

## Overview

Robust error handling is essential for building reliable applications. PGRestify provides comprehensive error handling capabilities, including custom error types, detailed error information, and patterns for gracefully handling different types of failures that can occur during database operations.

## Error Types

### PGRestifyError

The primary error type for all PGRestify operations:

```typescript
import { PGRestifyError } from '@webcoded/pgrestify';

try {
  const user = await client
    .from('users')
    .select('*')
    .eq('id', 999)
    .single()
    .execute();
} catch (error) {
  if (error instanceof PGRestifyError) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('HTTP status:', error.status);
    console.log('Details:', error.details);
  }
}
```

### Error Properties

PGRestifyError provides detailed information about what went wrong:

```typescript
interface PGRestifyError extends Error {
  // PostgREST error code (e.g., 'PGRST116')
  code: string;
  
  // HTTP status code (e.g., 404, 500)
  status: number;
  
  // Detailed error information
  details?: string;
  
  // Additional context
  hint?: string;
  
  // Original PostgREST response
  response?: Response;
}
```

## Common Error Scenarios

### Record Not Found

Handle cases where expected records don't exist:

```typescript
// Using single() - throws error if no record found
const getUserById = async (id: number) => {
  try {
    const result = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
      .execute();
      
    return { success: true, user: result.data };
  } catch (error) {
    if (error instanceof PGRestifyError && error.code === 'PGRST116') {
      return { success: false, error: 'User not found' };
    }
    throw error; // Re-throw unexpected errors
  }
};

// Using maybeSingle() - returns null if no record found
const getUserByIdSafe = async (id: number) => {
  const result = await client
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .execute();
    
  if (result.data) {
    return { success: true, user: result.data };
  } else {
    return { success: false, error: 'User not found' };
  }
};
```

### Multiple Records Found

Handle cases where single() finds multiple records:

```typescript
const getUserByEmail = async (email: string) => {
  try {
    const result = await client
      .from('users')
      .select('*')
      .eq('email', email)
      .single()
      .execute();
      
    return { success: true, user: result.data };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'User not found' };
      } else if (error.code === 'PGRST117') {
        return { success: false, error: 'Multiple users found with this email' };
      }
    }
    throw error;
  }
};
```

### Database Constraint Violations

Handle database-level constraint errors:

```typescript
const createUser = async (userData: any) => {
  try {
    const result = await client
      .from('users')
      .insert(userData)
      .select('*')
      .single()
      .execute();
      
    return { success: true, user: result.data };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      switch (error.code) {
        case '23505': // Unique violation
          if (error.details?.includes('email')) {
            return { success: false, error: 'Email address already exists' };
          }
          return { success: false, error: 'Duplicate value not allowed' };
          
        case '23502': // Not null violation
          return { success: false, error: 'Required field is missing' };
          
        case '23514': // Check constraint violation
          return { success: false, error: 'Invalid data provided' };
          
        case '23503': // Foreign key violation
          return { success: false, error: 'Referenced record does not exist' };
          
        default:
          return { success: false, error: `Database error: ${error.message}` };
      }
    }
    throw error;
  }
};
```

### Permission and Authentication Errors

Handle access control and authentication issues:

```typescript
const handleAuthErrors = async (operation: () => Promise<any>) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PGRestifyError) {
      switch (error.status) {
        case 401:
          return { success: false, error: 'Authentication required' };
        case 403:
          return { success: false, error: 'Access denied' };
        case 404:
          return { success: false, error: 'Resource not found' };
        default:
          return { success: false, error: 'Operation failed' };
      }
    }
    throw error;
  }
};

// Usage
const result = await handleAuthErrors(() =>
  client
    .from('admin_users')
    .select('*')
    .execute()
);
```

## Error Handling Patterns

### Result Pattern

Use a consistent result pattern for all operations:

```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

const executeQuery = async <T>(queryFn: () => Promise<any>): Promise<Result<T>> => {
  try {
    const result = await queryFn();
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred'
    };
  }
};

// Usage
const userResult = await executeQuery(() =>
  client
    .from('users')
    .select('*')
    .eq('id', 123)
    .single()
    .execute()
);

if (userResult.success) {
  console.log('User:', userResult.data);
} else {
  console.error('Error:', userResult.error);
}
```

### Try-Catch with Specific Handling

Structure error handling for different scenarios:

```typescript
const performUserOperation = async (operation: string, userId: number) => {
  try {
    switch (operation) {
      case 'fetch':
        return await client
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
          .execute();
          
      case 'delete':
        return await client
          .from('users')
          .delete()
          .eq('id', userId)
          .execute();
          
      default:
        throw new Error('Unknown operation');
    }
  } catch (error) {
    // Handle PGRestify errors
    if (error instanceof PGRestifyError) {
      console.error(`PostgREST Error [${error.code}]:`, error.message);
      
      // Log additional context
      if (error.details) {
        console.error('Details:', error.details);
      }
      if (error.hint) {
        console.error('Hint:', error.hint);
      }
      
      throw new Error(`Database operation failed: ${error.message}`);
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error:', error.message);
      throw new Error('Unable to connect to database');
    }
    
    // Handle other errors
    console.error('Unexpected error:', error);
    throw error;
  }
};
```

### Async Error Boundary

Create reusable error handling utilities:

```typescript
class DatabaseErrorHandler {
  static async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  static handleError(error: any): never {
    if (error instanceof PGRestifyError) {
      // Log error for monitoring
      this.logError(error);
      
      // Throw user-friendly error
      throw new Error(this.getUserFriendlyMessage(error));
    }
    
    // Log and re-throw unexpected errors
    console.error('Unexpected error:', error);
    throw error;
  }
  
  static logError(error: PGRestifyError): void {
    console.error('Database Error:', {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    });
  }
  
  static getUserFriendlyMessage(error: PGRestifyError): string {
    const friendlyMessages: Record<string, string> = {
      'PGRST116': 'Record not found',
      'PGRST117': 'Multiple records found where one was expected',
      '23505': 'This record already exists',
      '23502': 'Required information is missing',
      '23514': 'The provided data is invalid',
      '23503': 'Cannot complete operation due to data relationships'
    };
    
    return friendlyMessages[error.code] || 'Database operation failed';
  }
}

// Usage
const user = await DatabaseErrorHandler.execute(() =>
  client
    .from('users')
    .select('*')
    .eq('id', 123)
    .single()
    .execute()
);
```

## Validation and Error Prevention

### Input Validation

Prevent errors by validating input before database operations:

```typescript
interface CreateUserInput {
  name: string;
  email: string;
  age?: number;
}

class UserValidator {
  static validate(input: CreateUserInput): string[] {
    const errors: string[] = [];
    
    if (!input.name || input.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    
    if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('Valid email address is required');
    }
    
    if (input.age !== undefined && (input.age < 0 || input.age > 150)) {
      errors.push('Age must be between 0 and 150');
    }
    
    return errors;
  }
}

const createUserSafely = async (input: CreateUserInput) => {
  // Validate input first
  const validationErrors = UserValidator.validate(input);
  if (validationErrors.length > 0) {
    return {
      success: false,
      errors: validationErrors
    };
  }
  
  // Proceed with database operation
  try {
    const result = await client
      .from('users')
      .insert(input)
      .select('*')
      .single()
      .execute();
      
    return { success: true, user: result.data };
  } catch (error) {
    if (error instanceof PGRestifyError && error.code === '23505') {
      return { success: false, errors: ['Email address already exists'] };
    }
    throw error;
  }
};
```

### Existence Checks

Verify record existence before operations:

```typescript
const updateUserSafely = async (id: number, updates: any) => {
  // Check if user exists first
  const existingUser = await client
    .from('users')
    .select('id')
    .eq('id', id)
    .maybeSingle()
    .execute();
    
  if (!existingUser.data) {
    return { success: false, error: 'User not found' };
  }
  
  // Proceed with update
  try {
    const result = await client
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
      .execute();
      
    return { success: true, user: result.data };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
};
```

## Network and Connection Errors

### Timeout Handling

Configure and handle request timeouts:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  fetch: {
    timeout: 10000 // 10 seconds
  }
});

const fetchWithTimeout = async (queryFn: () => Promise<any>) => {
  try {
    return await queryFn();
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Request timed out. Please try again.');
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network connection failed');
    }
    throw error;
  }
};
```

### Retry Logic

Implement retry mechanisms for transient failures:

```typescript
const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error instanceof PGRestifyError && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Don't retry on constraint violations
      if (error instanceof PGRestifyError && ['23505', '23502', '23514'].includes(error.code)) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Retry attempt ${attempt} after ${delay}ms delay`);
    }
  }
  
  throw lastError;
};

// Usage
const result = await executeWithRetry(() =>
  client
    .from('users')
    .select('*')
    .execute(),
  3,
  1000
);
```

### Circuit Breaker Pattern

Prevent cascading failures with circuit breaker:

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 30000 // 30 seconds
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
           Date.now() - this.lastFailureTime >= this.recoveryTimeout;
  }
}

// Usage
const circuitBreaker = new CircuitBreaker(5, 30000);

const fetchWithCircuitBreaker = async () => {
  return circuitBreaker.execute(() =>
    client
      .from('users')
      .select('*')
      .execute()
  );
};
```

## Error Logging and Monitoring

### Structured Error Logging

Implement comprehensive error logging:

```typescript
interface ErrorLog {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  operation: string;
  error: {
    code?: string;
    message: string;
    status?: number;
    details?: string;
  };
  context?: any;
}

class ErrorLogger {
  static log(level: ErrorLog['level'], operation: string, error: any, context?: any): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      level,
      operation,
      error: {
        message: error.message
      },
      context
    };
    
    if (error instanceof PGRestifyError) {
      errorLog.error.code = error.code;
      errorLog.error.status = error.status;
      errorLog.error.details = error.details;
    }
    
    // Send to logging service
    console.error('ERROR_LOG:', JSON.stringify(errorLog));
    
    // In production, send to monitoring service
    // await sendToMonitoringService(errorLog);
  }
}

// Usage in operations
const performDatabaseOperation = async () => {
  try {
    return await client
      .from('users')
      .select('*')
      .execute();
  } catch (error) {
    ErrorLogger.log('error', 'fetch-users', error, { operation: 'list-users' });
    throw error;
  }
};
```

### Error Metrics

Track error patterns for monitoring:

```typescript
class ErrorMetrics {
  private static errorCounts = new Map<string, number>();
  
  static recordError(errorCode: string): void {
    const count = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, count + 1);
  }
  
  static getErrorMetrics(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }
  
  static resetMetrics(): void {
    this.errorCounts.clear();
  }
}

// Usage
const handleErrorWithMetrics = (error: any) => {
  if (error instanceof PGRestifyError) {
    ErrorMetrics.recordError(error.code);
  }
  // Handle error...
};
```

## User-Friendly Error Messages

### Error Message Translation

Provide user-friendly error messages:

```typescript
class ErrorTranslator {
  private static messages: Record<string, string> = {
    'PGRST116': 'The requested item could not be found.',
    'PGRST117': 'Multiple items were found when only one was expected.',
    '23505': 'This information already exists in our system.',
    '23502': 'Please fill in all required fields.',
    '23514': 'The information provided is not valid.',
    '23503': 'This action cannot be completed due to existing relationships.',
    'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
    'TIMEOUT_ERROR': 'The request took too long to complete. Please try again.',
    'PERMISSION_ERROR': 'You do not have permission to perform this action.',
    'VALIDATION_ERROR': 'Please check your input and try again.'
  };
  
  static translate(error: any): string {
    if (error instanceof PGRestifyError) {
      return this.messages[error.code] || 'An unexpected error occurred. Please try again.';
    }
    
    if (error.name === 'TimeoutError') {
      return this.messages['TIMEOUT_ERROR'];
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return this.messages['NETWORK_ERROR'];
    }
    
    return 'An unexpected error occurred. Please try again.';
  }
}

// Usage in UI components
const displayError = (error: any) => {
  const userFriendlyMessage = ErrorTranslator.translate(error);
  // Display to user in UI
  showNotification(userFriendlyMessage, 'error');
};
```

---

## Summary

Effective error handling in PGRestify applications involves:

- **Understanding Error Types**: Familiarize yourself with PGRestifyError and its properties
- **Specific Error Handling**: Handle different error scenarios appropriately
- **Validation**: Prevent errors through input validation and existence checks
- **Resilience**: Implement retry logic, timeouts, and circuit breakers
- **Monitoring**: Log errors systematically for debugging and monitoring
- **User Experience**: Provide clear, actionable error messages to users
- **Recovery**: Implement graceful fallback mechanisms when possible

Good error handling makes your application more reliable, easier to debug, and provides better user experience when things go wrong.