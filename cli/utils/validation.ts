import chalk from 'chalk';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * SQL injection protection utility
 */
export class SQLSafetyChecker {
  private static readonly DANGEROUS_PATTERNS = [
    // SQL injection patterns
    /;\s*(drop|delete|truncate|alter|create)\s+/i,
    /union\s+select/i,
    /'.*;\s*(drop|delete|truncate|alter|create)/i,
    /exec\s*\(/i,
    /sp_executesql/i,
    /xp_cmdshell/i,
    // Script injection
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    // Command injection
    /[;&|`$(){}]/,
  ];

  private static readonly ALLOWED_SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING',
    'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'DISTINCT',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF'
  ];

  static isSafe(input: string): boolean {
    if (!input || typeof input !== 'string') return true;
    
    return !this.DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
  }

  static sanitizeCondition(condition: string): string {
    if (!this.isSafe(condition)) {
      throw new ValidationError('Potentially unsafe SQL condition detected');
    }
    
    return condition.trim();
  }

  static validateWhereClause(whereClause: string): boolean {
    // Allow common WHERE clause patterns
    const safePatterns = [
      /^\w+\s*=\s*[\w'"\$\?]+$/,  // column = value
      /^\w+\s*IN\s*\([^)]+\)$/i,  // column IN (...)
      /^\w+\s*LIKE\s*'[^']*'$/i,  // column LIKE '...'
      /^\w+\s*IS\s*(NOT\s+)?NULL$/i,  // column IS [NOT] NULL
      /^\w+\s*(>|<|>=|<=|!=|<>)\s*[\w'"\$\?]+$/,  // comparison operators
    ];
    
    return this.isSafe(whereClause) && 
           safePatterns.some(pattern => pattern.test(whereClause.trim()));
  }
}

/**
 * PostgreSQL naming convention validators
 */
export const validators = {
  /**
   * Validate PostgreSQL identifier (table, column, function names)
   */
  identifier(name: string, type: string = 'identifier'): boolean {
    if (!name || typeof name !== 'string') {
      throw new ValidationError(`${type} must be a non-empty string`, type);
    }
    
    // PostgreSQL identifier rules
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new ValidationError(`${type} must start with a letter or underscore and contain only letters, numbers, and underscores`, type);
    }
    
    if (name.length > 63) {
      throw new ValidationError(`${type} must be 63 characters or less`, type);
    }
    
    // Check against PostgreSQL reserved words
    if (this.isReservedWord(name)) {
      console.log(chalk.yellow(`⚠️  "${name}" is a PostgreSQL reserved word. Consider using a different name.`));
    }
    
    return true;
  },

  /**
   * Validate table name
   */
  tableName(name: string): boolean {
    return this.identifier(name, 'Table name');
  },

  /**
   * Validate column name
   */
  columnName(name: string): boolean {
    return this.identifier(name, 'Column name');
  },

  /**
   * Validate function name
   */
  functionName(name: string): boolean {
    return this.identifier(name, 'Function name');
  },

  /**
   * Validate view name
   */
  viewName(name: string): boolean {
    return this.identifier(name, 'View name');
  },

  /**
   * Validate index name
   */
  indexName(name: string): boolean {
    return this.identifier(name, 'Index name');
  },

  /**
   * Validate schema name
   */
  schemaName(name: string): boolean {
    return this.identifier(name, 'Schema name');
  },

  /**
   * Validate SQL condition/expression
   */
  sqlCondition(condition: string): boolean {
    if (!condition || typeof condition !== 'string') {
      throw new ValidationError('SQL condition must be a non-empty string');
    }
    
    if (!SQLSafetyChecker.isSafe(condition)) {
      throw new ValidationError('SQL condition contains potentially dangerous statements');
    }
    
    return true;
  },

  /**
   * Validate PostgreSQL data type
   */
  dataType(type: string): boolean {
    if (!type || typeof type !== 'string') {
      throw new ValidationError('Data type must be a non-empty string');
    }
    
    const normalizedType = type.toUpperCase();
    const baseType = normalizedType.split('(')[0].trim();
    
    const validTypes = [
      // Numeric types
      'SMALLINT', 'INTEGER', 'BIGINT', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
      'SMALLSERIAL', 'SERIAL', 'BIGSERIAL',
      
      // Monetary types
      'MONEY',
      
      // Character types
      'VARCHAR', 'CHAR', 'CHARACTER', 'CHARACTER VARYING', 'TEXT',
      
      // Binary data types
      'BYTEA',
      
      // Date/time types
      'TIMESTAMP', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE',
      'DATE', 'TIME', 'TIMETZ', 'TIME WITH TIME ZONE', 'TIME WITHOUT TIME ZONE',
      'INTERVAL',
      
      // Boolean type
      'BOOLEAN', 'BOOL',
      
      // Enumerated types
      'ENUM',
      
      // Geometric types
      'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
      
      // Network address types
      'CIDR', 'INET', 'MACADDR', 'MACADDR8',
      
      // Bit string types
      'BIT', 'BIT VARYING', 'VARBIT',
      
      // Text search types
      'TSVECTOR', 'TSQUERY',
      
      // UUID type
      'UUID',
      
      // XML type
      'XML',
      
      // JSON types
      'JSON', 'JSONB',
      
      // Arrays (handled separately)
      'ARRAY',
      
      // Range types
      'INT4RANGE', 'INT8RANGE', 'NUMRANGE', 'TSRANGE', 'TSTZRANGE', 'DATERANGE',
      
      // Object identifier types
      'OID', 'REGPROC', 'REGPROCEDURE', 'REGOPER', 'REGOPERATOR', 'REGCLASS', 'REGTYPE'
    ];
    
    if (!validTypes.includes(baseType)) {
      console.log(chalk.yellow(`⚠️  "${type}" might not be a standard PostgreSQL data type`));
    }
    
    return true;
  },

  /**
   * Validate email address
   */
  email(email: string): boolean {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email must be a non-empty string');
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Email must be a valid email address');
    }
    
    return true;
  },

  /**
   * Validate URL
   */
  url(url: string): boolean {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL must be a non-empty string');
    }
    
    try {
      new URL(url);
      return true;
    } catch {
      throw new ValidationError('URL must be a valid URL');
    }
  },

  /**
   * Validate JSON string
   */
  json(jsonString: string): boolean {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new ValidationError('JSON must be a non-empty string');
    }
    
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      throw new ValidationError('Must be valid JSON');
    }
  },

  /**
   * Validate UUID
   */
  uuid(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      throw new ValidationError('UUID must be a non-empty string');
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new ValidationError('UUID must be a valid UUID format');
    }
    
    return true;
  },

  /**
   * Validate port number
   */
  port(port: number | string): boolean {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
    
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new ValidationError('Port must be a number between 1 and 65535');
    }
    
    return true;
  },

  /**
   * Validate password strength
   */
  password(password: string): boolean {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password must be a non-empty string');
    }
    
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      throw new ValidationError('Password must contain at least one lowercase letter, uppercase letter, number, and special character');
    }
    
    return true;
  },

  /**
   * Check if string is a PostgreSQL reserved word
   */
  isReservedWord(word: string): boolean {
    const reservedWords = [
      'ALL', 'ANALYSE', 'ANALYZE', 'AND', 'ANY', 'ARRAY', 'AS', 'ASC', 'ASYMMETRIC',
      'BOTH', 'CASE', 'CAST', 'CHECK', 'COLLATE', 'COLUMN', 'CONSTRAINT', 'CREATE',
      'CURRENT_CATALOG', 'CURRENT_DATE', 'CURRENT_ROLE', 'CURRENT_TIME',
      'CURRENT_TIMESTAMP', 'CURRENT_USER', 'DEFAULT', 'DEFERRABLE', 'DESC',
      'DISTINCT', 'DO', 'ELSE', 'END', 'EXCEPT', 'FALSE', 'FETCH', 'FOR',
      'FOREIGN', 'FROM', 'GRANT', 'GROUP', 'HAVING', 'IN', 'INITIALLY',
      'INTERSECT', 'INTO', 'LEADING', 'LIMIT', 'LOCALTIME', 'LOCALTIMESTAMP',
      'NOT', 'NULL', 'OFFSET', 'ON', 'ONLY', 'OR', 'ORDER', 'PLACING',
      'PRIMARY', 'REFERENCES', 'RETURNING', 'SELECT', 'SESSION_USER', 'SOME',
      'SYMMETRIC', 'TABLE', 'THEN', 'TO', 'TRAILING', 'TRUE', 'UNION',
      'UNIQUE', 'USER', 'USING', 'VARIADIC', 'WHEN', 'WHERE', 'WINDOW', 'WITH'
    ];
    
    return reservedWords.includes(word.toUpperCase());
  }
};

/**
 * Sanitization utilities
 */
export const sanitizers = {
  /**
   * Sanitize SQL identifier
   */
  identifier(identifier: string): string {
    return identifier
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .toLowerCase()
      .slice(0, 63);
  },

  /**
   * Sanitize file name
   */
  fileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  },

  /**
   * Sanitize SQL string literal
   */
  sqlString(str: string): string {
    return str.replace(/'/g, "''");
  },

  /**
   * Remove SQL comments from string
   */
  removeSqlComments(sql: string): string {
    return sql
      .replace(/--.*$/gm, '')  // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove block comments
      .trim();
  }
};

/**
 * Validate and sanitize user input
 */
export function validateAndSanitize(
  input: string, 
  validator: keyof typeof validators, 
  sanitize: boolean = true
): string {
  const trimmed = input.trim();
  
  // Validate first
  if (validators[validator](trimmed)) {
    // Sanitize if requested
    if (sanitize && validator in sanitizers) {
      return (sanitizers as any)[validator](trimmed);
    }
    return trimmed;
  }
  
  throw new ValidationError(`Invalid ${validator}: ${input}`);
}

/**
 * Batch validation utility
 */
export interface ValidationRule {
  field: string;
  value: any;
  validator: keyof typeof validators;
  required?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

export function validateBatch(rules: ValidationRule[]): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  
  for (const rule of rules) {
    try {
      // Check if required field is missing
      if (rule.required && (rule.value === null || rule.value === undefined || rule.value === '')) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is required`
        });
        continue;
      }
      
      // Skip validation if field is not required and empty
      if (!rule.required && (rule.value === null || rule.value === undefined || rule.value === '')) {
        continue;
      }
      
      // Run validator
      validators[rule.validator](rule.value);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push({
          field: rule.field,
          message: error.message
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Environment-specific validation
 */
export const envValidators = {
  /**
   * Validate database connection string
   */
  databaseUrl(url: string): boolean {
    if (!url) {
      throw new ValidationError('Database URL is required');
    }
    
    const dbUrlRegex = /^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
    if (!dbUrlRegex.test(url)) {
      throw new ValidationError('Database URL must be in format: postgresql://user:password@host:port/database');
    }
    
    return true;
  },

  /**
   * Validate JWT secret
   */
  jwtSecret(secret: string): boolean {
    if (!secret) {
      throw new ValidationError('JWT secret is required');
    }
    
    if (secret.length < 32) {
      throw new ValidationError('JWT secret must be at least 32 characters long');
    }
    
    return true;
  },

  /**
   * Validate environment name
   */
  environment(env: string): boolean {
    const validEnvs = ['development', 'staging', 'production', 'test'];
    
    if (!validEnvs.includes(env)) {
      throw new ValidationError(`Environment must be one of: ${validEnvs.join(', ')}`);
    }
    
    return true;
  }
};

/**
 * Schema validation utilities
 */
export const schemaValidators = {
  /**
   * Validate table schema definition
   */
  tableSchema(schema: any): boolean {
    if (!schema || typeof schema !== 'object') {
      throw new ValidationError('Table schema must be an object');
    }
    
    if (!schema.name || typeof schema.name !== 'string') {
      throw new ValidationError('Table schema must have a name');
    }
    
    if (!schema.columns || !Array.isArray(schema.columns)) {
      throw new ValidationError('Table schema must have columns array');
    }
    
    // Validate each column
    schema.columns.forEach((column: any, index: number) => {
      if (!column.name || typeof column.name !== 'string') {
        throw new ValidationError(`Column ${index + 1} must have a name`);
      }
      
      if (!column.type || typeof column.type !== 'string') {
        throw new ValidationError(`Column ${column.name} must have a type`);
      }
      
      validators.columnName(column.name);
      validators.dataType(column.type);
    });
    
    return true;
  },

  /**
   * Validate RLS policy definition
   */
  rlsPolicy(policy: any): boolean {
    if (!policy || typeof policy !== 'object') {
      throw new ValidationError('RLS policy must be an object');
    }
    
    if (!policy.name || typeof policy.name !== 'string') {
      throw new ValidationError('RLS policy must have a name');
    }
    
    if (!policy.table || typeof policy.table !== 'string') {
      throw new ValidationError('RLS policy must specify a table');
    }
    
    const validCommands = ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    if (policy.command && !validCommands.includes(policy.command.toUpperCase())) {
      throw new ValidationError(`RLS policy command must be one of: ${validCommands.join(', ')}`);
    }
    
    if (policy.using && typeof policy.using !== 'string') {
      throw new ValidationError('RLS policy USING clause must be a string');
    }
    
    if (policy.withCheck && typeof policy.withCheck !== 'string') {
      throw new ValidationError('RLS policy WITH CHECK clause must be a string');
    }
    
    return true;
  }
};

/**
 * Validate SQL safety for schema operations
 */
export async function validateSQLSafety(config: any): Promise<void> {
  // Validate table names
  if (config.tableName) {
    validators.tableName(config.tableName);
  }
  
  // Validate column names
  if (config.columnName) {
    validators.columnName(config.columnName);
  }
  
  // Validate SQL conditions
  if (config.checkExpression) {
    validators.sqlCondition(config.checkExpression);
  }
  
  if (config.usingClause) {
    validators.sqlCondition(config.usingClause);
  }
  
  // Validate data types
  if (config.columnType) {
    validators.dataType(config.columnType);
  }
  
  if (config.newType) {
    validators.dataType(config.newType);
  }
}