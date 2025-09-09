/**
 * Validation utilities for PGRestify
 */

import { ValidationError } from '../types/errors';

/**
 * Validate table name according to PostgreSQL naming rules
 */
export function validateTableName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Table name must be a non-empty string', 'tableName', name);
  }

  // PostgreSQL identifier rules: start with letter or underscore, followed by letters, digits, underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new ValidationError(
      'Table name must start with a letter or underscore and contain only letters, digits, and underscores',
      'tableName',
      name
    );
  }

  if (name.length > 63) {
    throw new ValidationError('Table name cannot exceed 63 characters', 'tableName', name);
  }

  // Check for PostgreSQL reserved keywords
  const reservedWords = [
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join', 'inner',
    'left', 'right', 'full', 'outer', 'on', 'group', 'by', 'order', 'having',
    'limit', 'offset', 'distinct', 'union', 'all', 'case', 'when', 'then',
    'else', 'end', 'as', 'and', 'or', 'not', 'in', 'exists', 'between',
    'like', 'ilike', 'similar', 'to', 'null', 'is', 'true', 'false'
  ];

  if (reservedWords.includes(name.toLowerCase())) {
    throw new ValidationError(
      `Table name "${name}" is a reserved PostgreSQL keyword`,
      'tableName',
      name
    );
  }
}

/**
 * Validate column name according to PostgreSQL naming rules
 */
export function validateColumnName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Column name must be a non-empty string', 'columnName', name);
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new ValidationError(
      'Column name must start with a letter or underscore and contain only letters, digits, and underscores',
      'columnName',
      name
    );
  }

  if (name.length > 63) {
    throw new ValidationError('Column name cannot exceed 63 characters', 'columnName', name);
  }
}

/**
 * Validate and sanitize URL
 */
export function validateUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL must be a non-empty string', 'url', url);
  }

  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ValidationError('URL must use HTTP or HTTPS protocol', 'url', url);
    }

    // Remove trailing slash
    return url.replace(/\/+$/, '');
  } catch {
    throw new ValidationError('Invalid URL format', 'url', url);
  }
}

/**
 * Validate filter value
 */
export function validateFilterValue(value: unknown): void {
  if (value === undefined) {
    throw new ValidationError('Filter value cannot be undefined', 'filterValue', value);
  }

  // Allow null, boolean, string, number, Date
  const allowedTypes = ['boolean', 'string', 'number'];
  const valueType = typeof value;

  if (
    value !== null &&
    !allowedTypes.includes(valueType) &&
    !(value instanceof Date) &&
    !Array.isArray(value)
  ) {
    throw new ValidationError(
      'Filter value must be null, boolean, string, number, Date, or array',
      'filterValue',
      value
    );
  }
}

/**
 * Sanitize string value for SQL safety
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return String(value);
  }

  // Basic sanitization - remove potentially dangerous characters
  return value.replace(/[\x00\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case '\x00': return '\\0';
      case '\x08': return '\\b';
      case '\x09': return '\\t';
      case '\x1a': return '\\z';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '"':
      case "'":
      case '\\':
      case '%': return '\\' + char;
      default: return char;
    }
  });
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate JWT token format (basic check)
 */
export function validateJWTFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

/**
 * Validate limit value for queries
 */
export function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new ValidationError('Limit must be a non-negative integer', 'limit', limit);
  }

  if (limit > 10000) {
    throw new ValidationError('Limit cannot exceed 10000 for performance reasons', 'limit', limit);
  }
}

/**
 * Validate offset value for queries
 */
export function validateOffset(offset: number): void {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError('Offset must be a non-negative integer', 'offset', offset);
  }
}

/**
 * Validate schema name
 */
export function validateSchemaName(schema: string): void {
  if (!schema || typeof schema !== 'string') {
    throw new ValidationError('Schema name must be a non-empty string', 'schema', schema);
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new ValidationError(
      'Schema name must start with a letter or underscore and contain only letters, digits, and underscores',
      'schema',
      schema
    );
  }

  if (schema.length > 63) {
    throw new ValidationError('Schema name cannot exceed 63 characters', 'schema', schema);
  }
}