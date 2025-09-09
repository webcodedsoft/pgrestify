/**
 * Column name transformation utilities
 * Handles bidirectional conversion between camelCase (JavaScript) and snake_case (database)
 */

/**
 * Convert camelCase to snake_case
 * Examples: firstName -> first_name, userId -> user_id, isActive -> is_active
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * Examples: first_name -> firstName, user_id -> userId, is_active -> isActive
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform object keys from camelCase to snake_case
 * Used for outbound data (JS -> DB)
 */
export function transformKeysToSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const transformed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    
    // Handle nested objects and arrays
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      transformed[snakeKey] = transformKeysToSnake(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      transformed[snakeKey] = value.map(item => 
        item && typeof item === 'object' && !Array.isArray(item)
          ? transformKeysToSnake(item as Record<string, unknown>)
          : item
      );
    } else {
      transformed[snakeKey] = value;
    }
  }
  
  return transformed;
}

/**
 * Transform object keys from snake_case to camelCase
 * Used for inbound data (DB -> JS)
 */
export function transformKeysToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const transformed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    
    // Handle nested objects and arrays
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      transformed[camelKey] = transformKeysToCamel(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      transformed[camelKey] = value.map(item => 
        item && typeof item === 'object' && !Array.isArray(item)
          ? transformKeysToCamel(item as Record<string, unknown>)
          : item
      );
    } else {
      transformed[camelKey] = value;
    }
  }
  
  return transformed;
}

/**
 * Transform array of objects keys from snake_case to camelCase
 * Used for inbound data arrays (DB -> JS)
 */
export function transformArrayKeysToCamel<T extends Record<string, unknown>>(arr: T[]): Record<string, unknown>[] {
  if (!Array.isArray(arr)) {
    return arr;
  }
  
  return arr.map(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return transformKeysToCamel(item) as Record<string, unknown>;
    }
    return item;
  });
}

/**
 * Transform array of objects keys from camelCase to snake_case
 * Used for outbound data arrays (JS -> DB)
 */
export function transformArrayKeysToSnake<T extends Record<string, unknown>>(arr: T[]): Record<string, unknown>[] {
  if (!Array.isArray(arr)) {
    return arr;
  }
  
  return arr.map(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return transformKeysToSnake(item) as Record<string, unknown>;
    }
    return item;
  });
}

/**
 * Transform a column name reference (for WHERE, ORDER BY, SELECT clauses)
 * JS -> DB: firstName -> first_name
 */
export function transformColumnName(columnName: string, enabled: boolean): string {
  if (!enabled) return columnName;
  return camelToSnake(columnName);
}

/**
 * Transform multiple column names (for SELECT clauses)
 * JS -> DB: ['firstName', 'lastName'] -> ['first_name', 'last_name']
 */
export function transformColumnNames(columnNames: string[], enabled: boolean): string[] {
  if (!enabled) return columnNames;
  return columnNames.map(name => camelToSnake(name));
}

/**
 * Transform a PostgREST select expression with embedded resources
 * Handles complex selects like: 'id,firstName,author(id,firstName,profile(id,bio))'
 * Converts to: 'id,first_name,author(id,first_name,profile(id,bio))'
 */
export function transformSelectExpression(selectExpr: string, enabled: boolean): string {
  if (!enabled) return selectExpr;
  
  // Handle embedded resources with parentheses
  // This regex matches column names but preserves PostgREST syntax
  return selectExpr.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?![()])/g, (match, columnName) => {
    // Don't transform if it's already snake_case or contains special characters
    if (columnName.includes('_') || columnName === match.toLowerCase()) {
      return match;
    }
    return camelToSnake(columnName);
  });
}

/**
 * Determine if column transformation should be applied
 * Query-level setting overrides global setting
 */
export function shouldTransformColumns(globalSetting: boolean = false, queryLevelSetting?: boolean): boolean {
  return queryLevelSetting !== undefined ? queryLevelSetting : globalSetting;
}