/**
 * Intelligent caching system for PostgREST queries
 */

import type { QueryCache, CacheEntry } from '../types';

export interface CacheOptions {
  enabled?: boolean;
  ttl?: number;
  maxSize?: number;
  gcInterval?: number;
}

/**
 * Memory-based query cache with TTL and garbage collection
 */
export class MemoryQueryCache implements QueryCache {
  private readonly cache = new Map<string, CacheEntry>();
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private readonly enabled: boolean;
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly gcInterval: number;

  constructor(options: CacheOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.defaultTTL = options.ttl ?? 300000; // 5 minutes
    this.maxSize = options.maxSize ?? 1000; // Max 1000 entries
    this.gcInterval = options.gcInterval ?? 60000; // GC every minute

    if (this.enabled && this.gcInterval > 0) {
      this.startGarbageCollection();
    }
  }

  get<T = unknown>(key: string): T | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T = unknown>(key: string, data: T, ttl?: number): void {
    if (!this.enabled) return;

    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    
    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt,
    });
  }

  invalidate(pattern: string): void {
    if (!this.enabled) return;

    const regex = this.createPatternRegex(pattern);
    
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need hit/miss tracking
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Prune expired entries manually
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    this.clear();
    
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null as unknown as ReturnType<typeof setInterval>;
    }
  }

  private startGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      this.prune();
    }, this.gcInterval);

    // Cleanup on process exit (Node.js only)
    if (typeof process !== 'undefined' && process.on) {
      process.on('exit', () => this.destroy());
      process.on('SIGINT', () => this.destroy());
      process.on('SIGTERM', () => this.destroy());
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Number.MAX_SAFE_INTEGER;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private createPatternRegex(pattern: string): RegExp {
    // Convert glob-like pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.'); // Convert ? to .

    return new RegExp(`^${escaped}$`);
  }

  private estimateMemoryUsage(): number {
    let bytes = 0;
    
    for (const [key, entry] of this.cache) {
      // Rough estimate: key size + data size (JSON) + metadata
      bytes += key.length * 2; // UTF-16 string
      bytes += JSON.stringify(entry.data).length * 2; // Serialized data
      bytes += 24; // Metadata overhead (timestamp, expiresAt)
    }

    return bytes;
  }
}

/**
 * Cache key builder for consistent key generation
 */
export class CacheKeyBuilder {
  private readonly parts: string[] = [];

  table(name: string): this {
    this.parts.push(`table:${name}`);
    return this;
  }

  select(columns: string): this {
    this.parts.push(`select:${columns}`);
    return this;
  }

  filter(column: string, operator: string, value: unknown): this {
    this.parts.push(`filter:${column}:${operator}:${this.serializeValue(value)}`);
    return this;
  }

  order(column: string, ascending: boolean): this {
    this.parts.push(`order:${column}:${ascending ? 'asc' : 'desc'}`);
    return this;
  }

  limit(count: number): this {
    this.parts.push(`limit:${count}`);
    return this;
  }

  offset(count: number): this {
    this.parts.push(`offset:${count}`);
    return this;
  }

  user(userId?: string): this {
    if (userId) {
      this.parts.push(`user:${userId}`);
    }
    return this;
  }

  role(role: string): this {
    this.parts.push(`role:${role}`);
    return this;
  }

  groupBy(columns: string): this {
    this.parts.push(`groupBy:${columns}`);
    return this;
  }

  having(condition: string): this {
    this.parts.push(`having:${condition}`);
    return this;
  }

  custom(key: string, value: string): this {
    this.parts.push(`${key}:${value}`);
    return this;
  }

  build(): string {
    return this.parts.join('|');
  }

  static create(): CacheKeyBuilder {
    return new CacheKeyBuilder();
  }

  private serializeValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(v => this.serializeValue(v)).join(',');
    return JSON.stringify(value);
  }
}

/**
 * Cache with automatic invalidation on mutations
 */
export class SmartQueryCache extends MemoryQueryCache {
  private readonly tableDependencies = new Map<string, Set<string>>();

  override set<T = unknown>(key: string, data: T, ttl?: number): void {
    super.set(key, data, ttl);
    
    // Track table dependencies
    const tableName = this.extractTableFromKey(key);
    if (tableName) {
      if (!this.tableDependencies.has(tableName)) {
        this.tableDependencies.set(tableName, new Set());
      }
      this.tableDependencies.get(tableName)!.add(key);
    }
  }

  /**
   * Invalidate all queries for a specific table
   */
  invalidateTable(tableName: string): void {
    const keys = this.tableDependencies.get(tableName);
    if (keys) {
      for (const key of keys) {
        this.delete(key);
      }
      this.tableDependencies.delete(tableName);
    }
  }

  /**
   * Invalidate queries that might be affected by a mutation
   */
  invalidateOnMutation(tableName: string, _operation: 'insert' | 'update' | 'delete'): void {
    // For now, invalidate all queries for the table
    // Could be made smarter based on the specific operation and conditions
    this.invalidateTable(tableName);
    
    // Also invalidate related tables if we had foreign key information
    // This would require schema introspection
  }

  override delete(key: string): void {
    super.delete(key);
    
    // Clean up table dependencies
    const tableName = this.extractTableFromKey(key);
    if (tableName) {
      const keys = this.tableDependencies.get(tableName);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tableDependencies.delete(tableName);
        }
      }
    }
  }

  override clear(): void {
    super.clear();
    this.tableDependencies.clear();
  }

  private extractTableFromKey(key: string): string | null {
    const match = RegExp(/table:([^|]+)/).exec(key);
    return match ? match[1] ?? null : null;
  }
}