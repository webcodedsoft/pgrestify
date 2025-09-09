/**
 * TypeORM-style Repository pattern for PostgREST
 */

import { QueryBuilder } from './query-builder';
import type { 
  HttpClient, 
  QueryCache, 
  AuthManager, 
  ClientConfig,
} from '../types';

/**
 * Base repository class providing TypeORM-like interface
 */
export abstract class Repository<T extends Record<string, unknown>> {
  protected queryBuilder: QueryBuilder<T>;

  constructor(
    protected tableName: string,
    protected httpClient: HttpClient,
    protected cache: QueryCache,
    protected auth: AuthManager,
    protected config: ClientConfig
  ) {
    this.queryBuilder = new QueryBuilder<T>(
      tableName,
      httpClient,
      cache,
      auth,
      config
    );
  }

  /**
   * Create a new query builder instance
   */
  createQueryBuilder(_alias?: string): QueryBuilder<T> {
    const builder = new QueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config
    );
    
    // If alias provided, we could potentially use it for more complex queries
    return builder;
  }

  /**
   * Find all entities
   */
  async find(): Promise<T[]> {
    const result = await this.queryBuilder.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data || [];
  }

  /**
   * Find entities with options
   */
  async findBy(where: Partial<T>): Promise<T[]> {
    let builder = this.queryBuilder;
    
    // Apply where conditions
    for (const [key, value] of Object.entries(where)) {
      builder = builder.eq(key as keyof T, value);
    }

    const result = await builder.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data || [];
  }

  /**
   * Find one entity by conditions
   */
  async findOne(where?: Partial<T>): Promise<T | null> {
    let builder = this.queryBuilder;
    
    if (where) {
      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        builder = builder.eq(key as keyof T, value);
      }
    }

    const result = await builder.single().execute();
    if (result.error) {
      throw result.error;
    }
    // Handle both single records and arrays from PostgREST response
    if (!result.data) {
      return null;
    }
    return Array.isArray(result.data) ? (result.data[0] || null) : result.data;
  }

  /**
   * Find one entity by conditions or fail
   */
  async findOneOrFail(where?: Partial<T>): Promise<T> {
    let builder = this.queryBuilder;
    
    if (where) {
      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        builder = builder.eq(key as keyof T, value);
      }
    }

    return builder.getOneOrFail();
  }

  /**
   * Find by ID
   */
  async findById(id: string | number): Promise<T | null> {
    const result = await this.queryBuilder.eq('id' as keyof T, id as T[keyof T]).single().execute();
    if (result.error) {
      throw result.error;
    }
    // Handle both single records and arrays from PostgREST response
    if (!result.data) {
      return null;
    }
    return Array.isArray(result.data) ? (result.data[0] || null) : result.data;
  }

  /**
   * Find by IDs
   */
  async findByIds(ids: (string | number)[]): Promise<T[]> {
    const result = await this.queryBuilder.in('id' as keyof T, ids as T[keyof T][]).execute();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data || [];
  }

  /**
   * Count entities
   */
  async count(where?: Partial<T>): Promise<number> {
    let builder = this.queryBuilder;
    
    if (where) {
      // Apply where conditions
      for (const [key, value] of Object.entries(where)) {
        builder = builder.eq(key as keyof T, value);
      }
    }

    return builder.getCount();
  }

  /**
   * Save (insert or update) entity
   */
  async save(entity: Partial<T>): Promise<T[]> {
    const result = await this.queryBuilder.upsert(entity).execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Insert new entity
   */
  async insert(entity: Partial<T>): Promise<T[]> {
    const result = await this.queryBuilder.insert(entity).execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Insert multiple entities
   */
  async insertMany(entities: Partial<T>[]): Promise<T[]> {
    const result = await this.queryBuilder.insert(entities).execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Update entities
   */
  async update(where: Partial<T>, updateData: Partial<T>): Promise<T[]> {
    let builder = this.queryBuilder;
    
    // Apply where conditions
    for (const [key, value] of Object.entries(where)) {
      builder = builder.eq(key as keyof T, value);
    }

    const result = await builder.update(updateData).execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Delete entities
   */
  async delete(where: Partial<T>): Promise<T[]> {
    let builder = this.queryBuilder;
    
    // Apply where conditions
    for (const [key, value] of Object.entries(where)) {
      builder = builder.eq(key as keyof T, value);
    }

    const result = await builder.delete().execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Soft delete (if your schema supports it)
   */
  async softDelete(where: Partial<T>): Promise<T[]> {
    return this.update(where, { deleted_at: new Date().toISOString() } as unknown as Partial<T>);
  }

  /**
   * Restore soft deleted entities
   */
  async restore(where: Partial<T>): Promise<T[]> {
    return this.update(where, { deleted_at: null } as unknown as Partial<T>);
  }

  /**
   * Remove entity
   */
  async remove(entity: T | Partial<T>): Promise<void> {
    // Use the entity's id or all provided fields to identify the record to delete
    const whereClause = entity;
    let query = this.queryBuilder.delete();
    
    // Apply all properties as equality filters
    for (const [key, value] of Object.entries(whereClause)) {
      query = query.eq(key as keyof T, value as T[keyof T]);
    }
    
    await query.execute();
  }

  /**
   * Check if entity exists
   */
  async exists(where: Partial<T>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Clear all entities (use with caution!)
   */
  async clear(): Promise<void> {
    await this.queryBuilder.delete().execute();
  }

  /**
   * Execute raw query
   */
  async query(_sql: string): Promise<unknown> {
    // This would need to be implemented based on PostgREST's RPC capabilities
    throw new Error('Raw SQL queries are not supported. Use RPC functions instead.');
  }

  /**
   * Get the underlying query builder
   */
  getQueryBuilder(): QueryBuilder<T> {
    return new QueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config
    );
  }
}

/**
 * Manager class for handling multiple repositories (TypeORM EntityManager style)
 */
export class DataManager {
  private repositories = new Map<string, Repository<any>>();

  constructor(
    private httpClient: HttpClient,
    private cache: QueryCache,
    private auth: AuthManager,
    private config: ClientConfig
  ) {}

  /**
   * Get repository for a table
   */
  getRepository<T extends Record<string, unknown>>(
    tableName: string
  ): Repository<T> {
    if (!this.repositories.has(tableName)) {
      const repository = new GenericRepository<T>(
        tableName,
        this.httpClient,
        this.cache,
        this.auth,
        this.config
      );
      this.repositories.set(tableName, repository);
    }

    return this.repositories.get(tableName)!;
  }

  /**
   * Get custom repository instance
   */
  getCustomRepository<T extends Repository<any>>(
    repositoryClass: new (...args: any[]) => T,
    tableName: string
  ): T {
    const key = `${tableName}_${repositoryClass.name}`;
    
    if (!this.repositories.has(key)) {
      const repository = new repositoryClass(
        tableName,
        this.httpClient,
        this.cache,
        this.auth,
        this.config
      );
      this.repositories.set(key, repository);
    }

    return this.repositories.get(key)! as T;
  }

  /**
   * Transaction support (if PostgREST supports it)
   */
  async transaction<T>(
    runInTransaction: (manager: DataManager) => Promise<T>
  ): Promise<T> {
    // PostgREST doesn't support transactions in the traditional sense
    // This would need to be handled at the database level
    // For now, just execute the function
    return runInTransaction(this);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Generic repository implementation
 */
class GenericRepository<T extends Record<string, unknown>> extends Repository<T> {
  constructor(
    tableName: string,
    httpClient: HttpClient,
    cache: QueryCache,
    auth: AuthManager,
    config: ClientConfig
  ) {
    super(tableName, httpClient, cache, auth, config);
  }
}

/**
 * Decorator for creating custom repositories
 */
export function EntityRepository<T extends Record<string, unknown>>(tableName: string) {
  return function<U extends new (...args: any[]) => Repository<T>>(constructor: U): U {
    const RepositoryClass = class extends constructor {
      constructor(...args: any[]) {
        super(tableName, ...args);
      }
    };
    
    // Return the constructor with the same signature
    return RepositoryClass as U;
  };
}

/**
 * Example custom repository
 */
export class UserRepository extends Repository<{
  id: number;
  email: string;
  name: string;
  active: boolean;
}> {
  /**
   * Find active users
   */
  async findActiveUsers(): Promise<any[]> {
    return this.findBy({ active: true });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<any | null> {
    return this.findOne({ email });
  }

  /**
   * Deactivate user
   */
  async deactivate(id: number): Promise<any[]> {
    return this.update({ id }, { active: false });
  }
}