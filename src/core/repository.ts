/**
 * Complete Repository Pattern and Query Builder for PGRestify
 * Full ORM-style implementation that works alongside the original client.from() syntax
 */

import { QueryBuilder as PostgRESTQueryBuilder } from './query-builder';
import type { 
  PostgRESTClient,
  HttpClient, 
  QueryCache, 
  AuthManager, 
  ClientConfig,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from '../types';

// ============================================================================
// Advanced SelectQueryBuilder (ORM-style)
// ============================================================================

/**
 * Complete ORM-style SelectQueryBuilder with all standard ORM methods
 */
export class SelectQueryBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
  private selectFields: string[] = ['*'];
  private fromTable: string = '';
  private whereConditions: Array<{
    type: 'WHERE' | 'AND' | 'OR';
    condition: string;
    parameters?: Record<string, any>;
  }> = [];
  private orderByFields: Array<{
    column: string;
    direction: 'ASC' | 'DESC';
  }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private parameters: Record<string, any> = {};

  constructor(
    private client: PostgRESTClient,
    tableName?: string
  ) {
    if (tableName) {
      this.fromTable = tableName;
    }
  }

  // ============================================================================
  // SELECT methods
  // ============================================================================

  /**
   * Select specific columns
   */
  select(selection?: string | string[]): this {
    if (typeof selection === 'string') {
      this.selectFields = selection.split(',').map(s => s.trim());
    } else if (Array.isArray(selection)) {
      this.selectFields = selection;
    }
    return this;
  }

  /**
   * Add columns to selection
   */
  addSelect(selection: string | string[]): this {
    if (typeof selection === 'string') {
      this.selectFields.push(...selection.split(',').map(s => s.trim()));
    } else if (Array.isArray(selection)) {
      this.selectFields.push(...selection);
    }
    return this;
  }

  // ============================================================================
  // FROM methods
  // ============================================================================

  /**
   * Set the table to query from
   */
  from(table: string | Function, _alias?: string): this {
    if (typeof table === 'string') {
      this.fromTable = table;
    } else {
      this.fromTable = table.name.toLowerCase() + 's';
    }
    return this;
  }

  // ============================================================================
  // JOIN methods (PostgREST embedded resources)
  // ============================================================================

  /**
   * Left join with select (PostgREST embedded resources)
   */
  leftJoinAndSelect(
    relation: string,
    _alias: string,
    _condition?: string,
    parameters?: Record<string, any>
  ): this {
    const tableName = this.extractTableFromRelation(relation);
    if (!this.selectFields.includes('*')) {
      this.selectFields.push(`${tableName}(*)`);
    } else {
      this.selectFields = ['*', `${tableName}(*)`];
    }

    if (parameters) {
      Object.assign(this.parameters, parameters);
    }

    return this;
  }

  /**
   * Inner join with select
   */
  innerJoinAndSelect(
    relation: string,
    alias: string,
    condition?: string,
    parameters?: Record<string, any>
  ): this {
    return this.leftJoinAndSelect(relation, alias, condition, parameters);
  }

  /**
   * Left join (without select)
   */
  leftJoin(
    relation: string,
    alias: string,
    condition?: string,
    parameters?: Record<string, any>
  ): this {
    return this.leftJoinAndSelect(relation, alias, condition, parameters);
  }

  /**
   * Inner join (without select)
   */
  innerJoin(
    relation: string,
    alias: string,
    condition?: string,
    parameters?: Record<string, any>
  ): this {
    return this.leftJoinAndSelect(relation, alias, condition, parameters);
  }

  // ============================================================================
  // WHERE methods
  // ============================================================================

  /**
   * Add WHERE condition with parameter binding
   */
  where(condition: string, parameters?: Record<string, any>): this {
    this.whereConditions = [{ 
      type: 'WHERE', 
      condition, 
      ...(parameters && { parameters })
    }];
    
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }

    return this;
  }

  /**
   * Add AND WHERE condition
   */
  andWhere(condition: string, parameters?: Record<string, any>): this {
    this.whereConditions.push({ 
      type: 'AND', 
      condition, 
      ...(parameters && { parameters })
    });
    
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }

    return this;
  }

  /**
   * Add OR WHERE condition
   */
  orWhere(condition: string, parameters?: Record<string, any>): this {
    this.whereConditions.push({ 
      type: 'OR', 
      condition, 
      ...(parameters && { parameters })
    });
    
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }

    return this;
  }

  /**
   * WHERE IN condition
   */
  whereIn(column: string, values: any[]): this {
    const condition = `${column} IN (${values.map((_, i) => `:value${i}`).join(',')})`;
    const parameters: Record<string, any> = {};
    values.forEach((value, i) => {
      parameters[`value${i}`] = value;
    });

    return this.where(condition, parameters);
  }

  /**
   * WHERE NOT IN condition
   */
  whereNotIn(column: string, values: any[]): this {
    const condition = `${column} NOT IN (${values.map((_, i) => `:value${i}`).join(',')})`;
    const parameters: Record<string, any> = {};
    values.forEach((value, i) => {
      parameters[`value${i}`] = value;
    });

    return this.where(condition, parameters);
  }

  /**
   * WHERE NULL condition
   */
  whereNull(column: string): this {
    return this.where(`${column} IS NULL`);
  }

  /**
   * WHERE NOT NULL condition
   */
  whereNotNull(column: string): this {
    return this.where(`${column} IS NOT NULL`);
  }

  /**
   * WHERE LIKE condition
   */
  whereLike(column: string, value: string): this {
    return this.where(`${column} LIKE :likeValue`, { likeValue: value });
  }

  /**
   * WHERE ILIKE condition (case-insensitive)
   */
  whereILike(column: string, value: string): this {
    return this.where(`${column} ILIKE :ilikeValue`, { ilikeValue: value });
  }

  /**
   * WHERE BETWEEN condition
   */
  whereBetween(column: string, values: [any, any]): this {
    return this.where(`${column} BETWEEN :start AND :end`, { start: values[0], end: values[1] });
  }

  /**
   * WHERE EXISTS subquery
   */
  whereExists(subQuery: (qb: SelectQueryBuilder<T>) => void): this {
    const subQb = new SelectQueryBuilder<T>(this.client);
    subQuery(subQb);
    
    this.whereConditions.push({ 
      type: this.whereConditions.length === 0 ? 'WHERE' : 'AND', 
      condition: `EXISTS (${subQb.getQuery()})` 
    });

    return this;
  }

  // ============================================================================
  // ORDER BY methods
  // ============================================================================

  /**
   * Order by column
   */
  orderBy(column: string | Record<string, 'ASC' | 'DESC'>, direction?: 'ASC' | 'DESC'): this {
    this.orderByFields = [];

    if (typeof column === 'string') {
      this.orderByFields.push({
        column,
        direction: direction || 'ASC'
      });
    } else {
      Object.entries(column).forEach(([col, dir]) => {
        this.orderByFields.push({
          column: col,
          direction: dir
        });
      });
    }

    return this;
  }

  /**
   * Add order by column
   */
  addOrderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByFields.push({ column, direction });
    return this;
  }

  // ============================================================================
  // GROUP BY and HAVING methods
  // ============================================================================

  /**
   * Group by column
   */
  groupBy(_column: string): this {
    // PostgREST doesn't support GROUP BY directly, but we can add this for interface compatibility
    return this;
  }

  /**
   * Add group by column
   */
  addGroupBy(_column: string): this {
    // PostgREST doesn't support GROUP BY directly, but we can add this for interface compatibility
    return this;
  }

  /**
   * Having condition
   */
  having(_condition: string, parameters?: Record<string, any>): this {
    // PostgREST doesn't support HAVING directly, but we can add this for interface compatibility
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }
    return this;
  }

  /**
   * And having condition
   */
  andHaving(condition: string, parameters?: Record<string, any>): this {
    return this.having(condition, parameters);
  }

  // ============================================================================
  // LIMIT and OFFSET methods
  // ============================================================================

  /**
   * Limit results (take)
   */
  take(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  /**
   * Skip results (offset)
   */
  skip(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  /**
   * Limit results
   */
  limit(limit: number): this {
    return this.take(limit);
  }

  /**
   * Offset results
   */
  offset(offset: number): this {
    return this.skip(offset);
  }

  // ============================================================================
  // Execution methods
  // ============================================================================

  /**
   * Get many results
   */
  async getMany(): Promise<T[]> {
    const query = this.buildQuery();
    const result = await query.execute();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    return Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
  }

  /**
   * Get single result or null
   */
  async getOne(): Promise<T | null> {
    const query = this.buildQuery().single();
    const result = await query.execute();
    
    if (result.error) {
      return null;
    }

    return Array.isArray(result.data) ? (result.data[0] || null) : result.data;
  }

  /**
   * Get single result or throw error
   */
  async getOneOrFail(): Promise<T> {
    const result = await this.getOne();
    
    if (!result) {
      throw new Error('Could not find any entity matching the query');
    }

    return result;
  }

  /**
   * Get count of results
   */
  async getCount(): Promise<number> {
    const query = this.buildQuery();
    const result = await query.execute();
    return result.count || 0;
  }

  /**
   * Get many results and count
   */
  async getManyAndCount(): Promise<[T[], number]> {
    const [entities, count] = await Promise.all([
      this.getMany(),
      this.getCount()
    ]);

    return [entities, count];
  }

  /**
   * Get raw many (alias for getMany)
   */
  async getRawMany(): Promise<any[]> {
    return this.getMany();
  }

  /**
   * Get raw one (alias for getOne)
   */
  async getRawOne(): Promise<any> {
    return this.getOne();
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  /**
   * Build PostgREST query
   */
  private buildQuery(): PostgRESTQueryBuilder<T> {
    if (!this.fromTable) {
      throw new Error('FROM table is required');
    }

    let query = this.client.from<T>(this.fromTable) as any as PostgRESTQueryBuilder<T>;

    // Handle SELECT
    if (this.selectFields.length > 0 && !this.selectFields.includes('*')) {
      query = query.select(this.selectFields.join(', '));
    }

    // Handle WHERE conditions
    this.whereConditions.forEach(whereClause => {
      const condition = this.replaceParameters(whereClause.condition);
      this.applyCondition(query, condition);
    });

    // Handle ORDER BY
    this.orderByFields.forEach(orderClause => {
      const column = this.extractColumnName(orderClause.column);
      if (column !== null) {
        query = query.order(
          column as keyof T,
          { ascending: orderClause.direction === 'ASC' }
        );
      }
    });

    // Handle LIMIT and OFFSET
    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue);
    }

    if (this.offsetValue !== undefined) {
      query = query.offset(this.offsetValue);
    }

    return query as PostgRESTQueryBuilder<T>;
  }

  /**
   * Replace parameters in condition
   */
  private replaceParameters(condition: string): string {
    let result = condition;
    
    Object.entries(this.parameters).forEach(([key, value]) => {
      const paramPattern = new RegExp(`:${key}\\b`, 'g');
      const escapedValue = this.escapeValue(value);
      result = result.replace(paramPattern, escapedValue);
    });

    return result;
  }

  /**
   * Apply condition to query
   */
  private applyCondition(query: PostgRESTQueryBuilder<T>, condition: string): void {
    const trimmedCondition = condition.trim();
    
    // Handle equality
    if (trimmedCondition.includes(' = ')) {
      const parts = trimmedCondition.split(' = ').map(s => s.trim());
      if (parts.length === 2) {
        const [column, value] = parts;
        const cleanColumn = this.extractColumnName(column!);
        const cleanValue = this.extractValue(value!);
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.eq(cleanColumn as keyof T, cleanValue);
        }
      }
    }
    // Handle inequality
    else if (trimmedCondition.includes(' <> ') || trimmedCondition.includes(' != ')) {
      const separator = trimmedCondition.includes(' <> ') ? ' <> ' : ' != ';
      const parts = trimmedCondition.split(separator).map(s => s.trim());
      if (parts.length === 2) {
        const [column, value] = parts;
        const cleanColumn = this.extractColumnName(column!);
        const cleanValue = this.extractValue(value!);
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.neq(cleanColumn as keyof T, cleanValue);
        }
      }
    }
    // Handle greater than
    else if (trimmedCondition.includes(' > ')) {
      const parts = trimmedCondition.split(' > ').map(s => s.trim());
      if (parts.length === 2) {
        const [column, value] = parts;
        const cleanColumn = this.extractColumnName(column!);
        const cleanValue = this.extractValue(value!);
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.gt(cleanColumn as keyof T, cleanValue);
        }
      }
    }
    // Handle greater than or equal
    else if (trimmedCondition.includes(' >= ')) {
      const parts = trimmedCondition.split(' >= ').map(s => s.trim());
      if (parts.length === 2) {
        const [column, value] = parts;
        const cleanColumn = this.extractColumnName(column!);
        const cleanValue = this.extractValue(value!);
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.gte(cleanColumn as keyof T, cleanValue);
        }
      }
    }
    // Handle less than
    else if (trimmedCondition.includes(' < ')) {
      const parts = trimmedCondition.split(' < ').map(s => s.trim());
      if (parts.length === 2) {
        const [column, value] = parts;
        const cleanColumn = this.extractColumnName(column!);
        const cleanValue = this.extractValue(value!);
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.lt(cleanColumn as keyof T, cleanValue);
        }
      }
    }
    // Handle less than or equal
    else if (trimmedCondition.includes(' <= ')) {
      const parts = trimmedCondition.split(' <= ').map(s => s.trim());
      if (parts.length === 2) {
        const [column, value] = parts;
        const cleanColumn = this.extractColumnName(column!);
        const cleanValue = this.extractValue(value!);
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.lte(cleanColumn as keyof T, cleanValue);
        }
      }
    }
    // Handle LIKE
    else if (trimmedCondition.toUpperCase().includes(' LIKE ')) {
      const parts = trimmedCondition.split(/\s+LIKE\s+/i);
      if (parts.length === 2 && parts[0] && parts[1]) {
        const cleanColumn = this.extractColumnName(parts[0].trim());
        const cleanValue = this.extractValue(parts[1].trim());
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.like(cleanColumn as keyof T, cleanValue as string);
        }
      }
    }
    // Handle ILIKE
    else if (trimmedCondition.toUpperCase().includes(' ILIKE ')) {
      const parts = trimmedCondition.split(/\s+ILIKE\s+/i);
      if (parts.length === 2 && parts[0] && parts[1]) {
        const cleanColumn = this.extractColumnName(parts[0].trim());
        const cleanValue = this.extractValue(parts[1].trim());
        if (cleanColumn !== null && cleanValue !== undefined) {
          query.ilike(cleanColumn as keyof T, cleanValue as string);
        }
      }
    }
    // Handle IN
    else if (trimmedCondition.toUpperCase().includes(' IN ')) {
      const parts = trimmedCondition.split(/\s+IN\s+/i);
      if (parts.length === 2 && parts[0] && parts[1]) {
        const cleanColumn = this.extractColumnName(parts[0].trim());
        const valuesPart = parts[1].trim();
        if (cleanColumn && valuesPart.startsWith('(') && valuesPart.endsWith(')')) {
          const valuesStr = valuesPart.slice(1, -1);
          const values = valuesStr.split(',').map(v => this.extractValue(v.trim())).filter(v => v !== undefined);
          if (values.length > 0) {
            query.in(cleanColumn as keyof T, values as any[]);
          }
        }
      }
    }
    // Handle IS NULL
    else if (trimmedCondition.toUpperCase().includes(' IS NULL')) {
      const column = trimmedCondition.replace(/\s+IS\s+NULL$/i, '').trim();
      const cleanColumn = this.extractColumnName(column);
      if (cleanColumn !== null) {
        query.is(cleanColumn as keyof T, null);
      }
    }
    // Handle IS NOT NULL  
    else if (trimmedCondition.toUpperCase().includes(' IS NOT NULL')) {
      const column = trimmedCondition.replace(/\s+IS\s+NOT\s+NULL$/i, '').trim();
      const cleanColumn = this.extractColumnName(column);
      if (cleanColumn !== null) {
        query.not(cleanColumn as keyof T, 'is', null);
      }
    }
  }

  /**
   * Extract column name from qualified name
   */
  private extractColumnName(column: string): string | null {
    if (!column) return null;
    const parts = column.split('.');
    return parts.length > 1 ? (parts[parts.length - 1] || null) : column;
  }

  /**
   * Extract table name from relation
   */
  private extractTableFromRelation(relation: string): string {
    const parts = relation.split('.');
    if (parts.length === 2 && parts[1]) {
      const tableName = parts[1];
      return tableName.endsWith('s') ? tableName : `${tableName}s`;
    }
    return relation;
  }

  /**
   * Extract value from string
   */
  private extractValue(value: string): any {
    if (!value) return undefined;
    
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    if (value.toLowerCase() === 'null') return null;
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    const num = Number(value);
    if (!isNaN(num)) return num;
    
    return value;
  }

  /**
   * Escape value for condition
   */
  private escapeValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    return `'${JSON.stringify(value)}'`;
  }

  /**
   * Get raw query string (for debugging)
   */
  getQuery(): string {
    return `SELECT ${this.selectFields.join(', ')} FROM ${this.fromTable}`;
  }

  /**
   * Get parameters
   */
  getParameters(): Record<string, any> {
    return { ...this.parameters };
  }

  /**
   * Clone query builder
   */
  clone(): SelectQueryBuilder<T> {
    const clone = new SelectQueryBuilder<T>(this.client, this.fromTable);
    clone.selectFields = [...this.selectFields];
    clone.whereConditions = [...this.whereConditions];
    clone.orderByFields = [...this.orderByFields];
    if (this.limitValue !== undefined) {
      clone.limitValue = this.limitValue;
    }
    if (this.offsetValue !== undefined) {
      clone.offsetValue = this.offsetValue;
    }
    clone.parameters = { ...this.parameters };
    return clone;
  }
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Complete repository interface with all ORM methods
 */
export interface SimpleRepository<T extends Record<string, unknown>> {
  // Basic CRUD operations
  find(options?: FindManyOptions<T>): Promise<T[]>;
  findOne(options?: FindOneOptions<T>): Promise<T | null>;
  findOneOrFail(options?: FindOneOptions<T>): Promise<T>;
  findBy(where: FindOptionsWhere<T>): Promise<T[]>;
  findOneBy(where: FindOptionsWhere<T>): Promise<T | null>;
  findByIds(ids: any[]): Promise<T[]>;
  
  // Count operations
  count(options?: FindManyOptions<T>): Promise<number>;
  countBy(where: FindOptionsWhere<T>): Promise<number>;
  
  // Save operations
  save(entity: Partial<T>): Promise<T>;
  save(entities: Partial<T>[]): Promise<T[]>;
  
  // Insert operations
  insert(entity: Partial<T>): Promise<T>;
  insert(entities: Partial<T>[]): Promise<T[]>;
  
  // Update operations
  update(criteria: FindOptionsWhere<T>, partialEntity: Partial<T>): Promise<T[]>;
  
  // Delete operations
  delete(criteria: FindOptionsWhere<T>): Promise<T[]>;
  remove(entity: T): Promise<void>;
  
  // Soft delete operations
  softDelete?(criteria: FindOptionsWhere<T>): Promise<T[]>;
  restore?(criteria: FindOptionsWhere<T>): Promise<T[]>;
  
  // Utility operations
  exists(options: FindOptionsWhere<T>): Promise<boolean>;
  clear(): Promise<void>;
  
  // Query builder
  createQueryBuilder(alias?: string): SelectQueryBuilder<T>;
}

// ============================================================================
// Base Repository Implementation
// ============================================================================

/**
 * Base repository class providing complete ORM-like interface
 */
export abstract class BaseRepository<T extends Record<string, unknown>> implements SimpleRepository<T> {
  protected queryBuilder: PostgRESTQueryBuilder<T>;

  constructor(
    protected tableName: string,
    protected httpClient: HttpClient,
    protected cache: QueryCache,
    protected auth: AuthManager,
    protected config: ClientConfig
  ) {
    this.queryBuilder = new PostgRESTQueryBuilder<T>(
      tableName,
      httpClient,
      cache,
      auth,
      config
    );
  }

  /**
   * Create new SelectQueryBuilder for advanced ORM operations
   */
  createQueryBuilder(_alias?: string): SelectQueryBuilder<T> {
    // Use the client from the existing infrastructure
    const client = {
      from: <U>(table: string) => new PostgRESTQueryBuilder<U>(table, this.httpClient, this.cache, this.auth, this.config)
    } as unknown as PostgRESTClient;
    
    return new SelectQueryBuilder<T>(client, this.tableName);
  }

  /**
   * Find all entities
   */
  async find(options?: FindManyOptions<T>): Promise<T[]> {
    let query = new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config);

    if (options) {
      // Apply where conditions
      if (options.where) {
        for (const [key, value] of Object.entries(options.where as Record<string, unknown>)) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
      }

      // Apply select
      if (options.select && Array.isArray(options.select)) {
        query = query.select(options.select as string[]);
      }

      // Apply ordering
      if (options.order) {
        for (const [column, direction] of Object.entries(options.order as Record<string, string>)) {
          const ascending = direction === 'ASC' || direction === '1';
          query = query.order(column as keyof T, { ascending });
        }
      }

      // Apply pagination
      if (options.take !== undefined) {
        query = query.limit(options.take);
      }
      if (options.skip !== undefined) {
        query = query.offset(options.skip);
      }

      // Apply relations (joins)
      if (options.relations) {
        const relationsArray = Array.isArray(options.relations) ? options.relations : [options.relations];
        for (const relation of relationsArray) {
          if (typeof relation === 'string') {
            query = query.select(`*, ${relation}(*)`);
          }
        }
      }
    }

    const result = await query.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data || [];
  }

  /**
   * Find one entity
   */
  async findOne(options?: FindOneOptions<T>): Promise<T | null> {
    let query = new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config);

    if (options) {
      // Apply where conditions
      if (options.where) {
        for (const [key, value] of Object.entries(options.where as Record<string, unknown>)) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
      }

      // Apply select
      if (options.select && Array.isArray(options.select)) {
        query = query.select(options.select as string[]);
      }

      // Apply ordering
      if (options.order) {
        for (const [column, direction] of Object.entries(options.order as Record<string, string>)) {
          const ascending = direction === 'ASC' || direction === '1';
          query = query.order(column as keyof T, { ascending });
        }
      }

      // Apply relations (joins)
      if (options.relations) {
        const relationsArray = Array.isArray(options.relations) ? options.relations : [options.relations];
        for (const relation of relationsArray) {
          if (typeof relation === 'string') {
            query = query.select(`*, ${relation}(*)`);
          }
        }
      }
    }

    const result = await query.single().execute();
    if (result.error) {
      return null;
    }
    return Array.isArray(result.data) ? (result.data[0] || null) : result.data;
  }

  /**
   * Find one entity or throw error
   */
  async findOneOrFail(options?: FindOneOptions<T>): Promise<T> {
    const result = await this.findOne(options);
    if (!result) {
      throw new Error('Could not find any entity matching the query');
    }
    return result;
  }

  /**
   * Find entities by simple where conditions
   */
  async findBy(where: FindOptionsWhere<T>): Promise<T[]> {
    return this.find({ where });
  }

  /**
   * Find one entity by simple where conditions
   */
  async findOneBy(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.findOne({ where });
  }

  /**
   * Find entities by array of IDs
   */
  async findByIds(ids: any[]): Promise<T[]> {
    const result = await new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config)
      .in('id' as keyof T, ids as T[keyof T][])
      .execute();
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data || [];
  }

  /**
   * Count entities with optional filtering
   */
  async count(options?: FindManyOptions<T>): Promise<number> {
    let query = new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config);

    if (options?.where) {
      for (const [key, value] of Object.entries(options.where as Record<string, unknown>)) {
        query = query.eq(key as keyof T, value as T[keyof T]);
      }
    }

    const result = await query.execute();
    return result.count || 0;
  }

  /**
   * Count entities by simple where conditions
   */
  async countBy(where: FindOptionsWhere<T>): Promise<number> {
    return this.count({ where });
  }

  /**
   * Save (upsert) entity or entities
   */
  async save(entity: Partial<T>): Promise<T>;
  async save(entities: Partial<T>[]): Promise<T[]>;
  async save(entityOrEntities: Partial<T> | Partial<T>[]): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      const results: T[] = [];
      for (const entity of entityOrEntities) {
        const result = await new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config)
          .upsert(entity)
          .single()
          .execute();
        
        if (result.error) {
          throw result.error;
        }
        if (result.data) {
          const data = Array.isArray(result.data) ? result.data[0] : result.data;
          if (data) {
            results.push(data);
          }
        }
      }
      return results;
    } else {
      const result = await new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config)
        .upsert(entityOrEntities)
        .single()
        .execute();
      
      if (result.error) {
        throw result.error;
      }
      
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!data) {
        throw new Error('Save operation failed: no data returned');
      }
      return data;
    }
  }

  /**
   * Insert new entity or entities
   */
  async insert(entity: Partial<T>): Promise<T>;
  async insert(entities: Partial<T>[]): Promise<T[]>;
  async insert(entityOrEntities: Partial<T> | Partial<T>[]): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      const result = await new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config)
        .insert(entityOrEntities)
        .execute();
      
      if (result.error) {
        throw result.error;
      }
      return result.data as T[];
    } else {
      const result = await new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config)
        .insert(entityOrEntities)
        .single()
        .execute();
      
      if (result.error) {
        throw result.error;
      }
      
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!data) {
        throw new Error('Insert operation failed: no data returned');
      }
      return data;
    }
  }

  /**
   * Update entities matching criteria
   */
  async update(criteria: FindOptionsWhere<T>, partialEntity: Partial<T>): Promise<T[]> {
    let query = new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config);
    
    // Apply where conditions
    for (const [key, value] of Object.entries(criteria as Record<string, unknown>)) {
      query = query.eq(key as keyof T, value as T[keyof T]);
    }

    const result = await query.update(partialEntity).execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Delete entities matching criteria
   */
  async delete(criteria: FindOptionsWhere<T>): Promise<T[]> {
    let query = new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config);
    
    // Apply where conditions
    for (const [key, value] of Object.entries(criteria as Record<string, unknown>)) {
      query = query.eq(key as keyof T, value as T[keyof T]);
    }

    const result = await query.delete().execute();
    if (result.error) {
      throw result.error;
    }
    return result.data as T[];
  }

  /**
   * Remove entity
   */
  async remove(entity: T): Promise<void> {
    // Use the entity's properties to identify the record to delete
    let query = new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config).delete();
    
    // Apply all properties as equality filters
    for (const [key, value] of Object.entries(entity)) {
      query = query.eq(key as keyof T, value as T[keyof T]);
    }
    
    const result = await query.execute();
    if (result.error) {
      throw result.error;
    }
  }

  /**
   * Soft delete entities (if your schema supports it)
   */
  async softDelete(criteria: FindOptionsWhere<T>): Promise<T[]> {
    return this.update(criteria, { deleted_at: new Date().toISOString() } as unknown as Partial<T>);
  }

  /**
   * Restore soft deleted entities
   */
  async restore(criteria: FindOptionsWhere<T>): Promise<T[]> {
    return this.update(criteria, { deleted_at: null } as unknown as Partial<T>);
  }

  /**
   * Check if entity exists
   */
  async exists(options: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.countBy(options);
    return count > 0;
  }

  /**
   * Clear all entities (use with caution!)
   */
  async clear(): Promise<void> {
    const result = await new PostgRESTQueryBuilder<T>(this.tableName, this.httpClient, this.cache, this.auth, this.config)
      .delete()
      .execute();
    if (result.error) {
      throw result.error;
    }
  }
}

// ============================================================================
// Repository (keeping old name for compatibility)
// ============================================================================

/**
 * Alias for BaseRepository to maintain compatibility
 */
export abstract class Repository<T extends Record<string, unknown>> extends BaseRepository<T> {}

// ============================================================================
// Custom Repository Base
// ============================================================================

/**
 * Base class for custom repositories with advanced query capabilities
 */
export abstract class CustomRepositoryBase<T extends Record<string, unknown>> extends BaseRepository<T> {
  constructor(tableName: string, client: PostgRESTClient) {
    // Extract the needed dependencies from the client
    const httpClient = (client as any).httpClient;
    const cache = (client as any).cache;
    const auth = (client as any).auth;
    const config = (client as any).config;
    
    super(tableName, httpClient, cache, auth, config);
  }

  /**
   * Create an advanced query with full ORM capabilities
   */
  createAdvancedQuery(): SelectQueryBuilder<T> {
    const client = {
      from: <U>(table: string) => new PostgRESTQueryBuilder<U>(table, this.httpClient, this.cache, this.auth, this.config)
    } as unknown as PostgRESTClient;
    
    return new SelectQueryBuilder<T>(client, this.tableName);
  }
}

// ============================================================================
// Repository Factory
// ============================================================================

/**
 * Factory for creating repository instances
 */
export class RepositoryFactory {
  constructor(private readonly client: PostgRESTClient) {}

  /**
   * Get repository for a table
   */
  getRepository<T extends Record<string, unknown>>(tableName: string): SimpleRepository<T> {
    return new GenericRepository<T>(tableName, this.client);
  }

  /**
   * Get custom repository instance
   */
  getCustomRepository<T extends CustomRepositoryBase<any>>(
    repositoryClass: new (tableName: string, client: PostgRESTClient) => T,
    tableName: string
  ): T {
    return new repositoryClass(tableName, this.client);
  }

  /**
   * Create query builder for any table
   */
  createQueryBuilder<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string): SelectQueryBuilder<T> {
    return new SelectQueryBuilder<T>(this.client, tableName);
  }
}

/**
 * Generic repository implementation
 */
class GenericRepository<T extends Record<string, unknown>> extends BaseRepository<T> {
  constructor(tableName: string, client: PostgRESTClient) {
    // Extract the needed dependencies from the client
    const httpClient = (client as any).httpClient;
    const cache = (client as any).cache;
    const auth = (client as any).auth;
    const config = (client as any).config;
    
    super(tableName, httpClient, cache, auth, config);
  }
}

// ============================================================================
// Manager class for handling multiple repositories
// ============================================================================

/**
 * Manager class for handling multiple repositories (kept for compatibility)
 */
export class DataManager {
  private repositories = new Map<string, BaseRepository<any>>();

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
  ): BaseRepository<T> {
    if (!this.repositories.has(tableName)) {
      const repository = new GenericRepositoryForManager<T>(
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
  getCustomRepository<T extends BaseRepository<any>>(
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
 * Generic repository implementation for DataManager
 */
class GenericRepositoryForManager<T extends Record<string, unknown>> extends BaseRepository<T> {
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

// ============================================================================
// Brackets for complex conditions
// ============================================================================

/**
 * Brackets for complex WHERE expressions
 */
export class Brackets<T = Record<string, unknown>> {
  constructor(private readonly expression: (qb: BracketsQueryBuilder<T>) => void) {}

  build(): { condition: string; parameters: Record<string, any> } {
    const qb = new BracketsQueryBuilder<T>();
    this.expression(qb);
    
    const { conditions, parameters } = qb.getConditionsAndParameters();
    const condition = conditions.length > 0 ? `(${conditions.join(' ')})` : '';
    
    return { condition, parameters };
  }
}

class BracketsQueryBuilder<_T = Record<string, unknown>> {
  private readonly conditions: string[] = [];
  private readonly parameters: Record<string, any> = {};

  where(condition: string, parameters?: Record<string, any>): this {
    this.conditions.push(condition);
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }
    return this;
  }

  andWhere(condition: string, parameters?: Record<string, any>): this {
    if (this.conditions.length > 0) {
      this.conditions.push('AND');
    }
    this.conditions.push(condition);
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }
    return this;
  }

  orWhere(condition: string, parameters?: Record<string, any>): this {
    if (this.conditions.length > 0) {
      this.conditions.push('OR');
    }
    this.conditions.push(condition);
    if (parameters) {
      Object.assign(this.parameters, parameters);
    }
    return this;
  }

  getConditionsAndParameters(): { conditions: string[]; parameters: Record<string, any> } {
    return {
      conditions: this.conditions,
      parameters: this.parameters,
    };
  }
}

// ============================================================================
// Entity Repository Decorator (for compatibility)
// ============================================================================

/**
 * Decorator for creating custom repositories
 */
export function EntityRepository<T extends Record<string, unknown>>(tableName: string) {
  return function<U extends new (...args: any[]) => BaseRepository<T>>(constructor: U): U {
    const RepositoryClass = class extends constructor {
      constructor(...args: any[]) {
        super(tableName, ...args);
      }
    };
    
    // Return the constructor with the same signature
    return RepositoryClass as U;
  };
}