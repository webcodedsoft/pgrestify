/**
 * Structural Sharing Utilities
 * Maintains reference equality for unchanged data to prevent unnecessary re-renders
 * Based on TanStack Query's structural sharing implementation
 */

/**
 * Get the type of a value for comparison
 */
function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/**
 * Deeply replaces equal values to maintain reference equality
 * This is the core of structural sharing - unchanged objects keep their references
 */
export function replaceEqualDeep<T>(a: unknown, b: T): T {
  // If references are equal, return the original
  if (a === b) return a as T;
  
  const aType = getType(a);
  const bType = getType(b);
  
  // If types don't match, return the new value
  if (aType !== bType) return b;
  
  // Handle objects
  if (aType === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    let hasChanged = false;
    
    // Check all keys in the new object
    for (const key in bObj) {
      const oldValue = aObj[key];
      const newValue = bObj[key];
      
      // Recursively apply structural sharing
      const sharedValue = replaceEqualDeep(oldValue, newValue);
      result[key] = sharedValue;
      
      // Track if any values changed
      if (sharedValue !== oldValue) {
        hasChanged = true;
      }
    }
    
    // If nothing changed, return the original object
    return hasChanged ? (result as T) : (a as T);
  }
  
  // Handle arrays
  if (aType === 'array') {
    const aArr = a as unknown[];
    const bArr = b as unknown[];
    const result: unknown[] = [];
    let hasChanged = false;
    
    // Different lengths means the array changed
    if (aArr.length !== bArr.length) {
      hasChanged = true;
    }
    
    // Process each element
    for (let i = 0; i < bArr.length; i++) {
      const oldValue = i < aArr.length ? aArr[i] : undefined;
      const newValue = bArr[i];
      
      const sharedValue = replaceEqualDeep(oldValue, newValue);
      result[i] = sharedValue;
      
      if (sharedValue !== oldValue) {
        hasChanged = true;
      }
    }
    
    return hasChanged ? (result as T) : (a as T);
  }
  
  // For primitives, if they're not equal, return the new value
  return b;
}

/**
 * Create a structural sharing function with custom comparison
 */
export function createStructuralSharing<T>(
  isEqual?: (a: unknown, b: unknown) => boolean
): (oldData: unknown, newData: T) => T {
  if (!isEqual) {
    return replaceEqualDeep;
  }
  
  return function structuralSharingWithCustomEquality(oldData: unknown, newData: T): T {
    if (isEqual(oldData, newData)) {
      return oldData as T;
    }
    
    return replaceEqualDeep(oldData, newData);
  };
}

/**
 * Deep equality check for complex objects
 * Used by structural sharing to determine if values are equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle regular expressions
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual((a as any)[key], (b as any)[key])) return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Shallow equality check for simple comparisons
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  
  if (Array.isArray(a) || Array.isArray(b)) return false;
  
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if ((a as any)[key] !== (b as any)[key]) return false;
  }
  
  return true;
}

/**
 * Optimized structural sharing for arrays of objects (common in PostgREST responses)
 */
export function replaceEqualArray<T extends Record<string, unknown>>(
  oldArray: T[] | undefined,
  newArray: T[],
  keyField: keyof T = 'id'
): T[] {
  if (!oldArray || oldArray.length === 0) return newArray;
  if (newArray.length === 0) return newArray;
  
  // Create a map for O(1) lookups
  const oldItemsMap = new Map<unknown, T>();
  for (const item of oldArray) {
    const key = item[keyField];
    if (key !== undefined) {
      oldItemsMap.set(key, item);
    }
  }
  
  // Process new array
  const result: T[] = [];
  let hasChanged = false;
  
  for (const newItem of newArray) {
    const key = newItem[keyField];
    const oldItem = key !== undefined ? oldItemsMap.get(key) : undefined;
    
    if (oldItem) {
      const sharedItem = replaceEqualDeep(oldItem, newItem);
      result.push(sharedItem);
      if (sharedItem !== oldItem) {
        hasChanged = true;
      }
    } else {
      result.push(newItem);
      hasChanged = true;
    }
  }
  
  // If arrays have different lengths, it definitely changed
  if (oldArray.length !== newArray.length) {
    hasChanged = true;
  }
  
  return hasChanged ? result : oldArray;
}

/**
 * Stable merge function that preserves object references when possible
 */
export function stableMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  let hasChanged = false;
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const oldValue = target[key];
      const newValue = source[key];
      
      if (newValue !== undefined) {
        const sharedValue = replaceEqualDeep(oldValue, newValue);
        (result as any)[key] = sharedValue;
        
        if (sharedValue !== oldValue) {
          hasChanged = true;
        }
      }
    }
  }
  
  return hasChanged ? result : target;
}

/**
 * Optimized structural sharing for PostgREST pagination responses
 */
export function replaceEqualPaginatedData<T>(
  oldData: { data: T[]; count?: number } | undefined,
  newData: { data: T[]; count?: number }
): { data: T[]; count?: number } {
  if (!oldData) return newData;
  
  const sharedData = replaceEqualDeep(oldData.data, newData.data);
  const sharedCount = oldData.count === newData.count ? oldData.count : newData.count;
  
  // If nothing changed, return the old object
  if (sharedData === oldData.data && sharedCount === oldData.count) {
    return oldData;
  }
  
  return {
    data: sharedData,
    ...(sharedCount !== undefined && { count: sharedCount }),
  };
}

/**
 * Structural sharing for infinite query data
 */
export function replaceEqualInfiniteData<TData>(
  oldData: { pages: TData[]; pageParams: unknown[] } | undefined,
  newData: { pages: TData[]; pageParams: unknown[] }
): { pages: TData[]; pageParams: unknown[] } {
  if (!oldData) return newData;
  
  const sharedPages = replaceEqualDeep(oldData.pages, newData.pages);
  const sharedPageParams = replaceEqualDeep(oldData.pageParams, newData.pageParams);
  
  if (sharedPages === oldData.pages && sharedPageParams === oldData.pageParams) {
    return oldData;
  }
  
  return {
    pages: sharedPages,
    pageParams: sharedPageParams,
  };
}

/**
 * Utility to determine if structural sharing should be applied
 */
export function shouldApplyStructuralSharing<T>(
  data: T,
  options?: {
    maxDepth?: number;
    maxSize?: number;
  }
): boolean {
  const { maxDepth = 10, maxSize = 1000 } = options || {};
  
  // Don't apply structural sharing to primitives
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  // Check size constraint
  if (Array.isArray(data) && data.length > maxSize) {
    return false;
  }
  
  // Check depth constraint by using maxDepth in a simple depth check
  const checkDepth = (obj: any, depth: number = 0): boolean => {
    if (depth >= maxDepth) return false;
    if (typeof obj !== 'object' || obj === null) return true;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (!checkDepth(obj[key], depth + 1)) return false;
      }
    }
    return true;
  };
  
  try {
    return checkDepth(data);
  } catch (error) {
    // Circular reference or other error
    return false;
  }
}

/**
 * Performance-optimized structural sharing for specific PostgREST patterns
 */
export class PostgRESTStructuralSharing {
  /**
   * Optimized sharing for table data responses
   */
  static replaceTableData<T extends Record<string, unknown>>(
    oldResponse: { data: T[] | null; error: unknown; count?: number } | undefined,
    newResponse: { data: T[] | null; error: unknown; count?: number },
    keyField: keyof T = 'id'
  ): { data: T[] | null; error: unknown; count?: number } {
    if (!oldResponse) return newResponse;
    
    // Handle error cases
    if (newResponse.error || !newResponse.data) {
      return newResponse;
    }
    
    if (oldResponse.error || !oldResponse.data) {
      return newResponse;
    }
    
    // Apply structural sharing to data array
    const sharedData = replaceEqualArray(oldResponse.data, newResponse.data, keyField);
    const sharedCount = oldResponse.count === newResponse.count ? oldResponse.count : newResponse.count;
    const sharedError = replaceEqualDeep(oldResponse.error, newResponse.error);
    
    // Return old response if nothing changed
    if (
      sharedData === oldResponse.data &&
      sharedCount === oldResponse.count &&
      sharedError === oldResponse.error
    ) {
      return oldResponse;
    }
    
    return {
      data: sharedData,
      error: sharedError,
      ...(sharedCount !== undefined && { count: sharedCount }),
    };
  }
  
  /**
   * Optimized sharing for single item responses
   */
  static replaceSingleData<T>(
    oldResponse: { data: T | null; error: unknown } | undefined,
    newResponse: { data: T | null; error: unknown }
  ): { data: T | null; error: unknown } {
    if (!oldResponse) return newResponse;
    
    const sharedData = replaceEqualDeep(oldResponse.data, newResponse.data);
    const sharedError = replaceEqualDeep(oldResponse.error, newResponse.error);
    
    if (sharedData === oldResponse.data && sharedError === oldResponse.error) {
      return oldResponse;
    }
    
    return {
      data: sharedData,
      error: sharedError,
    };
  }
}