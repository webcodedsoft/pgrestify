/**
 * Utility for parsing PostgreSQL array types
 * 
 * PostgreSQL array columns return strings in format {item1,item2,item3}
 * This utility converts them to proper JavaScript arrays.
 */

/**
 * Parse PostgreSQL array format {item1,item2} to JavaScript array
 * Handles both string arrays and already parsed arrays
 */
export function parsePostgreSQLArray(pgArray: string | string[] | null | undefined): string[] {
  if (!pgArray) return [];
  if (Array.isArray(pgArray)) return pgArray;
  if (typeof pgArray === 'string') {
    // Remove curly braces and split by comma, filtering empty strings
    return pgArray.replace(/^{|}$/g, '').split(',').filter(item => item.trim());
  }
  return [];
}

/**
 * Parse PostgreSQL text array that may contain quoted values
 * Handles cases like {"role name","another role"}
 */
export function parsePostgreSQLTextArray(pgArray: string | string[] | null | undefined): string[] {
  if (!pgArray) return [];
  if (Array.isArray(pgArray)) return pgArray;
  if (typeof pgArray === 'string') {
    // Handle quoted strings within arrays
    const cleaned = pgArray.replace(/^{|}$/g, '');
    if (!cleaned) return [];
    
    // Simple parsing for quoted strings - could be enhanced for complex cases
    const items: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (char === '"' && (i === 0 || cleaned[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        if (current.trim()) {
          items.push(current.trim().replace(/^"|"$/g, ''));
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last item
    if (current.trim()) {
      items.push(current.trim().replace(/^"|"$/g, ''));
    }
    
    return items.filter(item => item);
  }
  return [];
}