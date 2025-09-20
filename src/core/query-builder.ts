/**
 * ORM-style query builder for PostgREST
 */

import { 
  validateTableName, 
  validateColumnName, 
  validateFilterValue,
  validateLimit,
  validateOffset 
} from '../utils/validation';
import { CacheKeyBuilder } from './cache';
import { PostgRESTError } from '../types/errors';
import type {
  QueryState,
  QueryResponse,
  Filter,
  FilterOperator,
  OrderBy,
  ExecuteOptions,
  HttpClient,
  QueryCache,
  AuthManager,
  ClientConfig,
  QueryOptions,
} from '../types';
import {
  shouldTransformColumns,
  transformColumnName,
  transformSelectExpression,
  transformKeysToSnake,
  transformKeysToCamel,
  transformArrayKeysToCamel,
  transformArrayKeysToSnake,
} from '../utils/column-transform';

/**
 * ORM-style query builder implementation
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private readonly state: QueryState<T>;
  private readonly queryOptions: QueryOptions;

  constructor(
    protected tableName: string,
    protected httpClient: HttpClient,
    protected cache: QueryCache,
    protected auth: AuthManager,
    protected config: ClientConfig,
    initialState?: QueryState<T>,
    queryOptions?: QueryOptions
  ) {
    validateTableName(tableName);
    
    this.state = initialState || {
      filters: [],
    };
    this.queryOptions = queryOptions || {};
  }

  // Selection methods - always return QueryBuilder<T> to maintain method availability
  // The selected data will be properly typed at runtime, but we keep the full QueryBuilder API
  select<K extends keyof T>(...columns: K[]): QueryBuilder<T>;
  select(query: '*'): QueryBuilder<T>;
  select(query: string): QueryBuilder<T>;
  select(columns: string[]): QueryBuilder<T>;
  select<K extends keyof T>(...args: K[] | [string] | [string[]]): QueryBuilder<T> {
    if (args.length === 1) {
      const firstArg = args[0];
      
      if (typeof firstArg === 'string') {
        // String query case
        if (!firstArg) {
          throw new Error('Select query must be a non-empty string');
        }
        
        // Process relation-aware syntax
        const processedSelect = this.processRelationAwareSelect(firstArg);
        
        return this.clone({
          ...this.state,
          select: processedSelect,
        });
      } else if (Array.isArray(firstArg)) {
        // Array of strings with potential aliases
        if (firstArg.length === 0) {
          throw new Error('At least one column must be selected');
        }
        const selectString = this.buildSelectWithAliases(firstArg);
        return this.clone({
          ...this.state,
          select: selectString,
        });
      }
    }
    
    // Typed columns array case
    const columns = args as K[];
    if (columns.length === 0) {
      throw new Error('At least one column must be selected');
    }

    // Validate column names
    columns.forEach(col => validateColumnName(String(col)));

    const selectString = columns.map(String).join(', ');
    
    return this.clone({
      ...this.state,
      select: selectString,
    });
  }

  // Column renaming/aliasing  
  selectAs<K extends keyof T>(columns: { [alias: string]: K }): QueryBuilder<Record<string, T[K]>>;
  selectAs(mapping: Record<string, string>): QueryBuilder<Record<string, unknown>>;
  selectAs(mapping: Record<string, any>): QueryBuilder<any> {
    const aliasedColumns = Object.entries(mapping)
      .map(([alias, column]) => `${column}:${alias}`)
      .join(', ');
    
    return this.clone({
      ...this.state,
      select: aliasedColumns,
    });
  }

  /**
   * Add a relation to the query for embedded resources
   * Simplifies PostgREST's embedded resource syntax
   * @example
   * // Instead of: .select('*, posts(title, content)')
   * // Use: .relation('posts', 'post').select('*, posts.title, posts.content')
   * 
   * // Basic usage
   * .relation('posts')  // Equivalent to posts(*)
   * 
   * // With alias
   * .relation('posts', 'post')  // Creates alias for easier select syntax
   * 
   * // With specific columns
   * .relation('posts', 'post', ['title', 'content'])  // Equivalent to posts(title,content)
   */
  relation(
    relationName: string, 
    alias?: string, 
    columns?: string[] | '*'
  ): QueryBuilder<T> {
    // Store relation information for later use in select()
    const newState = { ...this.state };
    
    if (!newState.relations) {
      newState.relations = [];
    }
    
    // Create relation config
    const relationConfig = {
      name: relationName,
      alias: alias || relationName,
      columns: columns || '*'
    };
    
    newState.relations.push(relationConfig);
    
    return this.clone(newState);
  }

  // Filter methods - comparison operators
  eq<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'eq', value);
  }

  neq<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'neq', value);
  }

  gt<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'gt', value);
  }

  gte<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'gte', value);
  }

  lt<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'lt', value);
  }

  lte<K extends keyof T>(column: K | string, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'lte', value);
  }

  // Filter methods - pattern matching
  like<K extends keyof T>(column: K | string, pattern: string): QueryBuilder<T> {
    return this.addFilter(column, 'like', pattern);
  }

  ilike<K extends keyof T>(column: K | string, pattern: string): QueryBuilder<T> {
    return this.addFilter(column, 'ilike', pattern);
  }

  match<K extends keyof T>(column: K | string, regex: string): QueryBuilder<T> {
    return this.addFilter(column, 'match', regex);
  }

  imatch<K extends keyof T>(column: K | string, regex: string): QueryBuilder<T> {
    return this.addFilter(column, 'imatch', regex);
  }

  // Filter methods - array operations
  in<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Values must be a non-empty array');
    }
    return this.addFilter(column, 'in', `(${values.map(v => this.formatValue(v)).join(',')})`);
  }

  contains<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T> {
    if (!Array.isArray(values)) {
      throw new Error('Values must be an array');
    }
    return this.addFilter(column, 'cs', `{${values.map(v => this.formatValue(v)).join(',')}}`);
  }

  containedBy<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T> {
    if (!Array.isArray(values)) {
      throw new Error('Values must be an array');
    }
    return this.addFilter(column, 'cd', `{${values.map(v => this.formatValue(v)).join(',')}}`);
  }

  // WHERE-style method aliases for FunctionBasedQueryBuilder compatibility
  /**
   * Filter where column value is in the provided array
   * PostgREST fully supports: ?column=in.(value1,value2,value3)
   * For subqueries: Uses a two-step execution workaround
   * @param column The column to filter
   * @param values Array of values OR a subquery (automatically handles two-step execution)
   */
  whereIn<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T>;
  whereIn<K extends keyof T>(column: K | string, subquery: QueryBuilder<any>): QueryBuilder<T>;
  whereIn<K extends keyof T>(column: K | string, valuesOrSubquery: T[K][] | QueryBuilder<any>): QueryBuilder<T> {
    if (Array.isArray(valuesOrSubquery)) {
      return this.in(column, valuesOrSubquery);
    }
  }

  /**
   * Filter where column value is NOT in the provided array
   * PostgREST fully supports: ?column=not.in.(value1,value2,value3)
   * For subqueries: Uses a two-step execution workaround
   * @param column The column to filter
   * @param values Array of values OR a subquery (automatically handles two-step execution)
   */
  whereNotIn<K extends keyof T>(column: K | string, values: T[K][]): QueryBuilder<T>;
  whereNotIn<K extends keyof T>(column: K | string, subquery: QueryBuilder<any>): QueryBuilder<T>;
  whereNotIn<K extends keyof T>(column: K | string, valuesOrSubquery: T[K][] | QueryBuilder<any>): QueryBuilder<T> {
    if (Array.isArray(valuesOrSubquery)) {
      if (!Array.isArray(valuesOrSubquery) || valuesOrSubquery.length === 0) {
        throw new Error('Values must be a non-empty array');
      }
      return this.addFilter(column, 'not.in', `(${valuesOrSubquery.map(v => this.formatValue(v)).join(',')})`);
    }
  }

  whereBetween<K extends keyof T>(column: K | string, min: T[K] | unknown, max: T[K] | unknown): QueryBuilder<T> {
    // PostgREST doesn't have a native BETWEEN operator, so we use AND with gte and lte
    return this.gte(column, min).lte(column, max);
  }

  whereNotBetween<K extends keyof T>(column: K | string, min: T[K] | unknown, max: T[K] | unknown): QueryBuilder<T> {
    // NOT BETWEEN is OR of (< min OR > max)
    return this.or(`${String(column)}.lt.${this.formatValue(min)},${String(column)}.gt.${this.formatValue(max)}`);
  }


  // Text search operations (FunctionBasedQueryBuilder compatibility)
  whereContains<K extends keyof T>(column: K | string, value: string, caseSensitive: boolean = true): QueryBuilder<T> {
    return caseSensitive ? this.like(column, `%${value}%`) : this.ilike(column, `%${value}%`);
  }

  whereStartsWith<K extends keyof T>(column: K | string, value: string, caseSensitive: boolean = true): QueryBuilder<T> {
    return caseSensitive ? this.like(column, `${value}%`) : this.ilike(column, `${value}%`);
  }

  whereEndsWith<K extends keyof T>(column: K | string, value: string, caseSensitive: boolean = true): QueryBuilder<T> {
    return caseSensitive ? this.like(column, `%${value}`) : this.ilike(column, `%${value}`);
  }

  whereMatches<K extends keyof T>(column: K | string, pattern: string): QueryBuilder<T> {
    return this.match(column, pattern);
  }

  whereFullText<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T> {
    return this.fts(column, query, config);
  }

  // HIGH PRIORITY: Additional selection methods
  addSelect<K extends keyof T>(...columns: K[]): QueryBuilder<T>;
  addSelect(query: string): QueryBuilder<T>;
  addSelect(columns: string[]): QueryBuilder<T>;
  addSelect<K extends keyof T>(...args: K[] | [string] | [string[]]): QueryBuilder<T> {
    let newColumns: string;
    
    if (args.length === 1) {
      const firstArg = args[0];
      
      if (typeof firstArg === 'string') {
        // String query case
        if (!firstArg) {
          throw new Error('Select query must be a non-empty string');
        }
        newColumns = firstArg;
      } else if (Array.isArray(firstArg)) {
        // Array of strings
        if (firstArg.length === 0) {
          throw new Error('At least one column must be selected');
        }
        newColumns = firstArg.join(', ');
      } else {
        throw new Error('Invalid argument type for addSelect');
      }
    } else {
      // Typed columns array case
      const columns = args as K[];
      if (columns.length === 0) {
        throw new Error('At least one column must be selected');
      }
      
      // Validate column names
      columns.forEach(col => validateColumnName(String(col)));
      newColumns = columns.map(String).join(', ');
    }
    
    // Add to existing selection or create new one
    const currentSelect = this.state.select || '*';
    const combinedSelect = currentSelect === '*' ? newColumns : `${currentSelect}, ${newColumns}`;
    
    return this.clone({
      ...this.state,
      select: combinedSelect,
    });
  }

  // HIGH PRIORITY: Additional aggregation methods
  countDistinct<K extends keyof T>(column: K | string): QueryBuilder<{ count: number }> {
    const query = this.clone({
      ...this.state,
      select: `count(distinct.${String(column)})`,
    });
    return query as unknown as QueryBuilder<{ count: number }>;
  }

  // HIGH PRIORITY: Additional ordering methods
  addOrderBy<K extends keyof T>(column: K | string, direction: 'asc' | 'desc' = 'asc', nulls?: 'first' | 'last'): QueryBuilder<T> {
    const orderValue = nulls ? `${String(column)}.${direction}.nulls${nulls}` : `${String(column)}.${direction}`;
    
    // Add to existing rawOrder or create new one
    const existingRawOrder = this.state.rawOrder;
    const newRawOrder = existingRawOrder ? `${existingRawOrder},${orderValue}` : orderValue;
    
    return this.clone({
      ...this.state,
      rawOrder: newRawOrder,
    });
  }

  orderByAsc<K extends keyof T>(column: K | string, nulls?: 'first' | 'last'): QueryBuilder<T> {
    return this.addOrderBy(column, 'asc', nulls);
  }

  orderByDesc<K extends keyof T>(column: K | string, nulls?: 'first' | 'last'): QueryBuilder<T> {
    return this.addOrderBy(column, 'desc', nulls);
  }

  // Filter methods - range operations
  overlaps<K extends keyof T>(column: K | string, range: string): QueryBuilder<T> {
    return this.addFilter(column, 'ov', range);
  }

  strictlyLeft<K extends keyof T>(column: K | string, range: string): QueryBuilder<T> {
    return this.addFilter(column, 'sl', range);
  }

  strictlyRight<K extends keyof T>(column: K | string, range: string): QueryBuilder<T> {
    return this.addFilter(column, 'sr', range);
  }

  notExtendsRight<K extends keyof T>(column: K | string, range: string): QueryBuilder<T> {
    return this.addFilter(column, 'nxr', range);
  }

  notExtendsLeft<K extends keyof T>(column: K | string, range: string): QueryBuilder<T> {
    return this.addFilter(column, 'nxl', range);
  }

  adjacent<K extends keyof T>(column: K | string, range: string): QueryBuilder<T> {
    return this.addFilter(column, 'adj', range);
  }

  // Filter methods - null operations
  is<K extends keyof T>(column: K | string, value: null | boolean): QueryBuilder<T> {
    if (value !== null && typeof value !== 'boolean') {
      throw new Error('Value must be null or boolean');
    }
    return this.addFilter(column, 'is', value);
  }

  // Filter methods - full-text search
  fts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T> {
    const searchValue = config ? `${query}(${config})` : query;
    return this.addFilter(column, 'fts', searchValue);
  }

  plfts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T> {
    const searchValue = config ? `${query}(${config})` : query;
    return this.addFilter(column, 'plfts', searchValue);
  }

  phfts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T> {
    const searchValue = config ? `${query}(${config})` : query;
    return this.addFilter(column, 'phfts', searchValue);
  }

  wfts<K extends keyof T>(column: K | string, query: string, config?: string): QueryBuilder<T> {
    const searchValue = config ? `${query}(${config})` : query;
    return this.addFilter(column, 'wfts', searchValue);
  }

  // Logical operations
  and(filters: string): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      filters: [
        ...this.state.filters,
        { column: 'and' as keyof T, operator: 'and', value: `(${filters})` },
      ],
    });
  }

  or(filters: string): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      filters: [
        ...this.state.filters,
        { column: 'or' as keyof T, operator: 'or', value: `(${filters})` },
      ],
    });
  }

  not<K extends keyof T>(column: K | string, operator: FilterOperator, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, 'not', `${String(operator)}.${this.formatValue(value)}`);
  }

  // ORM-style where methods
  where<K extends keyof T>(column: K | string, operator: FilterOperator, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, operator, value);
  }

  andWhere<K extends keyof T>(column: K | string, operator: FilterOperator, value: T[K] | unknown): QueryBuilder<T> {
    return this.addFilter(column, operator, value);
  }

  orWhere(condition: string): QueryBuilder<T> {
    return this.or(condition);
  }

  // JOIN operations (PostgREST embedded resources)
  
  /**
   * Inner join - only returns records where related data exists
   * Uses PostgREST's !inner hint modifier
   * @example
   * client.from('courses').innerJoin('students', { select: ['name', 'email'] })
   * // Generates: /courses?select=*,students!inner(name,email)
   */
  innerJoin<TRelated = Record<string, unknown>>(
    table: string,
    config: Omit<import('../types').JoinConfig<TRelated>, 'table' | 'type'> = {}
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }> {
    return this.join({ ...config, table, type: 'inner' }) as any;
  }

  /**
   * Left join - returns all records from main table, with related data if it exists
   * This is PostgREST's default embedded resource behavior
   * @example
   * client.from('courses').leftJoin('instructors', { select: '*' })
   * // Generates: /courses?select=*,instructors(*)
   */
  leftJoin<TRelated = Record<string, unknown>>(
    table: string,
    config: Omit<import('../types').JoinConfig<TRelated>, 'table' | 'type'> = {}
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated | null }> {
    return this.join({ ...config, table, type: 'left' }) as any;
  }

  /**
   * Right join - returns all records from related table
   * Uses PostgREST's !right hint modifier
   * @example
   * client.from('courses').rightJoin('categories', { select: ['name'] })
   * // Generates: /courses?select=*,categories!right(name)
   */
  rightJoin<TRelated = Record<string, unknown>>(
    table: string,
    config: Omit<import('../types').JoinConfig<TRelated>, 'table' | 'type'> = {}
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }> {
    return this.join({ ...config, table, type: 'right' }) as any;
  }

  /**
   * Full outer join - returns all records from both tables
   * Uses PostgREST's !full hint modifier
   * @example
   * client.from('courses').fullJoin('reviews', { select: ['rating', 'comment'] })
   * // Generates: /courses?select=*,reviews!full(rating,comment)
   */
  fullJoin<TRelated = Record<string, unknown>>(
    table: string,
    config: Omit<import('../types').JoinConfig<TRelated>, 'table' | 'type'> = {}
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated | null }> {
    return this.join({ ...config, table, type: 'full' }) as any;
  }

  /**
   * Cross join - Cartesian product of all records (use with caution!)
   * Returns every combination of records from both tables
   * @example
   * client.from('products').crossJoin('colors', { select: ['name', 'hex'] })
   * // Generates: /products?select=*,colors(name,hex)
   */
  crossJoin<TRelated = Record<string, unknown>>(
    table: string,
    config: Omit<import('../types').JoinConfig<TRelated>, 'table' | 'type' | 'foreignKey' | 'localKey'> = {}
  ): QueryBuilder<T & { [K in string]: TRelated[] }> {
    return this.join({ ...config, table, type: 'cross' }) as any;
  }

  /**
   * Generic join method - supports all join types with full configuration
   * @example
   * client.from('courses').join({
   *   table: 'students',
   *   type: 'inner',
   *   select: ['name', 'email'],
   *   foreignKey: 'course_id',
   *   filters: { active: true }
   * })
   */
  join<TRelated = Record<string, unknown>>(
    config: import('../types').JoinConfig<TRelated>
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }> {
    validateTableName(config.table);

    const currentJoins = this.state.joins || [];
    const newJoins = [...currentJoins, config];

    return this.clone({
      ...this.state,
      joins: newJoins,
    }) as any;
  }

  /**
   * Convenience method to join with a foreign key relationship
   */
  joinWith<TRelated = Record<string, unknown>>(
    table: string,
    foreignKey?: string,
    selectColumns: string | string[] = '*'
  ): QueryBuilder<T & { [K in string]: TRelated[] | TRelated }> {
    const fk = foreignKey || `${table.slice(0, -1)}_id`; // Remove 's' and add '_id'
    return this.join({
      table,
      select: selectColumns,
      foreignKey: fk,
    });
  }

  /**
   * Include related data (one-to-many relationship)
   */
  include<TRelated = Record<string, unknown>>(
    table: string,
    options: {
      select?: string | string[];
      foreignKey?: string;
      where?: Partial<TRelated>;
    } = {}
  ): QueryBuilder<T & { [K in string]: TRelated[] }> {
    const joinConfig: import('../types').JoinConfig<TRelated> = {
      table,
      select: options.select || '*',
      foreignKey: options.foreignKey || `${this.tableName.slice(0, -1)}_id`,
    };
    
    if (options.where) {
      joinConfig.filters = options.where;
    }
    
    return this.join(joinConfig) as any;
  }

  // Ordering and pagination
  order<K extends keyof T>(
    column: K | string,
    options: { ascending?: boolean; nullsFirst?: boolean } = {}
  ): QueryBuilder<T> {
    validateColumnName(String(column));

    const orderBy: OrderBy<T> = {
      column: column as keyof T,
      ascending: options.ascending ?? true,
      ...(options.nullsFirst !== undefined && { nullsFirst: options.nullsFirst }),
    };

    return this.clone({
      ...this.state,
      order: orderBy,
    });
  }

  orderBy<K extends keyof T>(column: K | string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder<T> {
    return this.order(column, { ascending: direction === 'ASC' });
  }

  limit(count: number): QueryBuilder<T> {
    validateLimit(count);
    
    return this.clone({
      ...this.state,
      limit: count,
    });
  }

  take(count: number): QueryBuilder<T> {
    return this.limit(count);
  }

  offset(count: number): QueryBuilder<T> {
    validateOffset(count);
    
    return this.clone({
      ...this.state,
      offset: count,
    });
  }

  skip(count: number): QueryBuilder<T> {
    return this.offset(count);
  }

  range(from: number, to: number): QueryBuilder<T> {
    validateOffset(from);
    validateLimit(to - from + 1);
    
    return this.clone({
      ...this.state,
      offset: from,
      limit: to - from + 1,
    });
  }

  // Pagination helpers
  paginate(options: import('../types').PaginationOptions): QueryBuilder<T> {
    const { page, pageSize, offset, limit } = options;
    
    if (page && pageSize) {
      // Page-based pagination
      const pageOffset = (page - 1) * pageSize;
      return this.clone({
        ...this.state,
        offset: pageOffset,
        limit: pageSize,
      });
    } else if (offset !== undefined && limit !== undefined) {
      // Offset-based pagination
      return this.clone({
        ...this.state,
        offset,
        limit,
      });
    } else if (limit !== undefined) {
      // Just limit
      return this.clone({
        ...this.state,
        limit,
      });
    }
    
    return this;
  }

  // Modifiers
  single(): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      single: true,
      limit: 1,
    });
  }

  maybeSingle(): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      single: true,
      limit: 1,
    });
  }

  // Role specification for this query
  withRole(role: import('../types').PostgrestRole | string): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      role: String(role),
    });
  }

  // Aggregate functions
  count(column?: keyof T | '*'): QueryBuilder<import('../types').AggregateResult> {
    const countColumn = column === '*' ? '*' : String(column || '*');
    return this.clone({
      ...this.state,
      select: `count(${countColumn})`,
    }) as any;
  }

  sum(column: keyof T): QueryBuilder<import('../types').AggregateResult> {
    return this.clone({
      ...this.state,
      select: `sum(${String(column)})`,
    }) as any;
  }

  avg(column: keyof T): QueryBuilder<import('../types').AggregateResult> {
    return this.clone({
      ...this.state,
      select: `avg(${String(column)})`,
    }) as any;
  }

  min(column: keyof T): QueryBuilder<import('../types').AggregateResult> {
    return this.clone({
      ...this.state,
      select: `min(${String(column)})`,
    }) as any;
  }

  max(column: keyof T): QueryBuilder<import('../types').AggregateResult> {
    return this.clone({
      ...this.state,
      select: `max(${String(column)})`,
    }) as any;
  }

  // Group by and having
  groupBy(...columns: (keyof T)[]): QueryBuilder<T> {
    const groupByClause = columns.map(String).join(',');
    return this.clone({
      ...this.state,
      groupBy: groupByClause,
    });
  }

  having(condition: string): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      having: condition,
    });
  }

  // ORM-style convenience methods
  async find(options?: import('../types').FindManyOptions<T>): Promise<QueryResponse<T>> {
    let query = this.clone();
    
    if (options) {
      // Parse select to separate main and relation columns
      const { mainTableColumns, relationColumns } = QueryBuilder.parseSelectWithRelations(
        options.select,
        options.relations
      );
      
      // Apply main table select
      if (options.select && typeof options.select === 'string') {
        // String select - use as is
        query = query.select(options.select) as QueryBuilder<T>;
      } else if (mainTableColumns.length > 0) {
        // Apply parsed main table columns
        query = query.select(mainTableColumns) as QueryBuilder<T>;
      }
      
      // Apply where conditions
      if (options.where) {
        for (const [key, value] of Object.entries(options.where as Record<string, unknown>)) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
      }
      
      // Apply ordering
      if (options.order) {
        for (const [column, direction] of Object.entries(options.order as Record<string, string>)) {
          const ascending = direction === 'ASC' || direction === '1';
          query = query.order(column as keyof T, { ascending });
        }
      }
      
      // Apply limit (take)
      if (options.take !== undefined) {
        query = query.limit(options.take);
      }
      
      // Apply offset (skip)
      if (options.skip !== undefined) {
        query = query.offset(options.skip);
      }
      
      // Apply relations (ORM-style)
      if (options.relations) {
        const relations: string[] = Array.isArray(options.relations) 
          ? options.relations 
          : Object.entries(options.relations)
              .filter(([_, enabled]) => enabled)
              .map(([key]) => key);
        
        // Convert ORM-style relations to PostgREST joins
        for (const relation of relations) {
          // Handle nested relations like 'user.profile'
          const parts = relation.split('.');
          const currentTable = parts[0];
          
          if (currentTable) {
            // Check if we have specific columns to select for this relation
            const columnsToSelect = relationColumns[currentTable];
            
            // Build the select for this relation
            let selectForRelation: string | string[];
            if (columnsToSelect && columnsToSelect.length > 0) {
              // Use specific columns with alias support
              selectForRelation = columnsToSelect;
            } else {
              // Default to all columns
              selectForRelation = '*';
            }
            
            // Apply the join with the appropriate select
            query = query.leftJoin(currentTable, { select: selectForRelation }) as QueryBuilder<T>;
            
            // Handle nested relations
            if (parts.length > 1) {
              // This would need more complex handling for nested relations
              // For now, we'll join the nested table as well
              for (let i = 1; i < parts.length; i++) {
                const nestedTable = parts[i];
                if (nestedTable) {
                  // Check for columns for nested table
                  const nestedColumns = relationColumns[nestedTable];
                  const nestedSelect = nestedColumns && nestedColumns.length > 0 ? nestedColumns : '*';
                  query = query.leftJoin(nestedTable, { select: nestedSelect }) as QueryBuilder<T>;
                }
              }
            }
          }
        }
      }
      
      // Apply joins (PostgREST-style with full control)
      if (options.joins) {
        for (const joinConfig of options.joins) {
          query = query.join(joinConfig) as QueryBuilder<T>;
        }
      }
      
      // Apply single/maybeSingle modifiers
      if (options.single) {
        query = query.single();
      } else if (options.maybeSingle) {
        query = query.maybeSingle();
      }
    }
    
    return query.execute();
  }

  // Method overloads for findBy - support both patterns for better UX
  async findBy(where: import('../types').FindOptionsWhere<T>): Promise<QueryResponse<T>>;
  async findBy(options: { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<QueryResponse<T>>;
  async findBy(whereOrOptions: import('../types').FindOptionsWhere<T> | { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<QueryResponse<T>> {
    // Check if it's an options object with 'where' property
    if (whereOrOptions && typeof whereOrOptions === 'object' && 'where' in whereOrOptions) {
      // Options pattern: { where: {...}, select: [...] }
      const { where, select } = whereOrOptions as { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] };
      let query = this.clone();
      
      // Apply select if provided
      if (select) {
        if (Array.isArray(select)) {
          query = query.select(select as string[]) as QueryBuilder<T>;
        } else if (typeof select === 'string') {
          query = query.select(select) as QueryBuilder<T>;
        }
      }
      
      // Apply where conditions
      for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
        query = query.eq(key as keyof T, value as T[keyof T]);
      }
      
      return query.execute();
    } else {
      // Simple where pattern: findBy({ id: '123' })
      const where = whereOrOptions as import('../types').FindOptionsWhere<T>;
      let query = this.clone();
      for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
        query = query.eq(key as keyof T, value as T[keyof T]);
      }
      return query.execute();
    }
  }

  async findOne(options?: import('../types').FindOneOptions<T>): Promise<T | null> {
    let query = this.clone().single();
    
    if (options) {
      // Parse select array to separate main table columns and relation columns
      let mainTableColumns: string[] = [];
      const relationColumns: Record<string, string[]> = {};
      
      if (options.select && Array.isArray(options.select)) {
        for (const col of options.select as string[]) {
          const cleanCol = col.trim();
          
          // Check if it's a column from a related table (contains dot)
          if (cleanCol.includes('.') && !cleanCol.toUpperCase().includes(' AS ')) {
            // It's a related table column like 'course_category.course_id'
            const [tableName, ...columnParts] = cleanCol.split('.');
            const columnName = columnParts.join('.');
            
            if (tableName && columnName) {
              if (!relationColumns[tableName]) {
                relationColumns[tableName] = [];
              }
              relationColumns[tableName].push(columnName);
            }
          } else if (cleanCol.toUpperCase().includes(' AS ')) {
            // Handle alias - check if source is from related table
            const [sourceCol, alias] = cleanCol.split(/\s+AS\s+/i).map((s: string) => s.trim());
            if (sourceCol && sourceCol.includes('.')) {
              // It's an aliased column from a related table
              const [tableName, ...columnParts] = sourceCol.split('.');
              const columnName = columnParts.join('.');
              
              if (tableName && columnName) {
                if (!relationColumns[tableName]) {
                  relationColumns[tableName] = [];
                }
                // Use the PostgREST alias syntax: alias:column
                relationColumns[tableName].push(`${alias}:${columnName}`);
              }
            } else {
              // Main table column with alias
              mainTableColumns.push(cleanCol);
            }
          } else {
            // Check if this column name matches a relation name - if so, skip it
            const isRelationName = options.relations && (
              (Array.isArray(options.relations) && options.relations.includes(cleanCol)) ||
              (!Array.isArray(options.relations) && cleanCol in options.relations)
            );
            
            if (!isRelationName) {
              // It's a main table column
              mainTableColumns.push(cleanCol);
            }
          }
        }
      } else if (options.select && typeof options.select === 'string') {
        // String select - use as is
        query = query.select(options.select) as QueryBuilder<T>;
      } else if (!options.select && !options.relations && !options.joins) {
        // No select specified and no relations - default behavior
      }
      
      // Apply main table select if we have columns
      if (mainTableColumns.length > 0) {
        query = query.select(mainTableColumns) as QueryBuilder<T>;
      }
      
      // Apply where conditions
      if (options.where) {
        for (const [key, value] of Object.entries(options.where as Record<string, unknown>)) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
      }
      
      // Apply ordering
      if (options.order) {
        for (const [column, direction] of Object.entries(options.order as Record<string, string>)) {
          const ascending = direction === 'ASC' || direction === '1';
          query = query.order(column as keyof T, { ascending });
        }
      }
      
      // Apply relations (ORM-style)
      if (options.relations) {
        const relations: string[] = Array.isArray(options.relations) 
          ? options.relations 
          : Object.entries(options.relations)
              .filter(([_, enabled]) => enabled)
              .map(([key]) => key);
        
        // Convert ORM-style relations to PostgREST joins
        for (const relation of relations) {
          // Handle nested relations like 'user.profile'
          const parts = relation.split('.');
          const currentTable = parts[0];
          
          if (currentTable) {
            // Check if we have specific columns to select for this relation
            const columnsToSelect = relationColumns[currentTable];
            
            // Build the select for this relation
            let selectForRelation: string | string[];
            if (columnsToSelect && columnsToSelect.length > 0) {
              // Use specific columns with alias support
              selectForRelation = columnsToSelect;
            } else {
              // Default to all columns
              selectForRelation = '*';
            }
            
            // Apply the join with the appropriate select
            query = query.leftJoin(currentTable, { select: selectForRelation }) as QueryBuilder<T>;
            
            // Handle nested relations
            if (parts.length > 1) {
              // This would need more complex handling for nested relations
              // For now, we'll join the nested table as well
              for (let i = 1; i < parts.length; i++) {
                const nestedTable = parts[i];
                if (nestedTable) {
                  // Check for columns for nested table
                  const nestedColumns = relationColumns[nestedTable];
                  const nestedSelect = nestedColumns && nestedColumns.length > 0 ? nestedColumns : '*';
                  query = query.leftJoin(nestedTable, { select: nestedSelect }) as QueryBuilder<T>;
                }
              }
            }
          }
        }
      }
      
      // Apply joins (PostgREST-style with full control)
      if (options.joins) {
        for (const joinConfig of options.joins) {
          query = query.join(joinConfig) as QueryBuilder<T>;
        }
      }
    }
    
    const result = await query.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return Array.isArray(result.data) ? result.data[0] || null : result.data || null;
  }

  // Method overloads for findOneBy - support both patterns for consistency
  async findOneBy(where: import('../types').FindOptionsWhere<T>): Promise<T | null>;
  async findOneBy(options: { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<T | null>;
  async findOneBy(whereOrOptions: import('../types').FindOptionsWhere<T> | { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<T | null> {
    // Check if it's an options object with 'where' property
    if (whereOrOptions && typeof whereOrOptions === 'object' && 'where' in whereOrOptions) {
      // Options pattern: { where: {...}, select: [...] }
      const { where, select } = whereOrOptions as { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] };
      const findOneOptions: import('../types').FindOneOptions<T> = { where };
      if (select) {
        findOneOptions.select = select;
      }
      return this.findOne(findOneOptions);
    } else {
      // Simple where pattern: findOneBy({ id: '123' })
      return this.findOne({ where: whereOrOptions as import('../types').FindOptionsWhere<T> });
    }
  }

  async findOneOrFail(options?: import('../types').FindOneOptions<T>): Promise<T> {
    const result = await this.findOne(options);
    if (!result) {
      throw new Error('Entity not found');
    }
    return result;
  }

  // Method overloads for findOneByOrFail - support both patterns for consistency
  async findOneByOrFail(where: import('../types').FindOptionsWhere<T>): Promise<T>;
  async findOneByOrFail(options: { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<T>;
  async findOneByOrFail(whereOrOptions: import('../types').FindOptionsWhere<T> | { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] }): Promise<T> {
    // Check if it's an options object with 'where' property
    if (whereOrOptions && typeof whereOrOptions === 'object' && 'where' in whereOrOptions) {
      // Options pattern: { where: {...}, select: [...] }
      const { where, select } = whereOrOptions as { where: import('../types').FindOptionsWhere<T>; select?: (keyof T)[] | string | string[] };
      const findOneOptions: import('../types').FindOneOptions<T> = { where };
      if (select) {
        findOneOptions.select = select;
      }
      return this.findOneOrFail(findOneOptions);
    } else {
      // Simple where pattern: findOneByOrFail({ id: '123' })
      return this.findOneOrFail({ where: whereOrOptions as import('../types').FindOptionsWhere<T> });
    }
  }

  async getMany(): Promise<QueryResponse<T>> {
    return this.execute();
  }

  async getOne(): Promise<QueryResponse<T>> {
    try {
      const result = this.single();
      return await result.execute();
    } catch (error) {
      return {
        data: null,
        error: error instanceof PostgRESTError ? error : 
          new PostgRESTError(
            error instanceof Error ? error.message : 'Unknown error',
            500,
            'query_error'
          )
      };
    }
  }

  // Bulk operations
  async bulkInsert(values: Partial<T>[], _options?: import('../types').BulkInsertOptions): Promise<import('../types').BulkOperationResult<T>> {
    // This would need to be implemented with proper batch handling
    const results: T[] = [];
    const errors: Error[] = [];
    let successful = 0;
    let failed = 0;

    for (const value of values) {
      try {
        const result = await this.clone().insert(value).single().execute();
        if (result.error) {
          throw new Error(result.error.message);
        }
        if (result.data) {
          results.push(Array.isArray(result.data) ? result.data[0] as T : result.data as T);
          successful++;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        failed++;
      }
    }

    return {
      data: results,
      count: values.length,
      successful,
      failed,
      errors,
    };
  }

  async bulkUpdate(values: Partial<T>[], _options?: import('../types').BulkUpdateOptions): Promise<import('../types').BulkOperationResult<T>> {
    // Similar implementation as bulkInsert but for updates
    const results: T[] = [];
    const errors: Error[] = [];
    let successful = 0;
    let failed = 0;

    for (const value of values) {
      try {
        const result = await this.clone().update(value).execute();
        if (result.error) {
          throw new Error(result.error.message);
        }
        if (result.data) {
          results.push(...(Array.isArray(result.data) ? result.data : [result.data]));
          successful++;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        failed++;
      }
    }

    return {
      data: results,
      count: values.length,
      successful,
      failed,
      errors,
    };
  }

  async bulkUpsert(values: Partial<T>[], _options?: import('../types').BulkInsertOptions): Promise<import('../types').BulkOperationResult<T>> {
    // Similar to bulkInsert but using upsert
    const results: T[] = [];
    const errors: Error[] = [];
    let successful = 0;
    let failed = 0;

    for (const value of values) {
      try {
        const result = await this.clone().upsert(value).single().execute();
        if (result.error) {
          throw new Error(result.error.message);
        }
        if (result.data) {
          results.push(Array.isArray(result.data) ? result.data[0] as T : result.data as T);
          successful++;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        failed++;
      }
    }

    return {
      data: results,
      count: values.length,
      successful,
      failed,
      errors,
    };
  }

  async bulkDelete(conditions: Partial<T>[]): Promise<import('../types').BulkOperationResult<T>> {
    const results: T[] = [];
    const errors: Error[] = [];
    let successful = 0;
    let failed = 0;

    for (const condition of conditions) {
      try {
        let query = this.clone().delete();
        for (const [key, value] of Object.entries(condition)) {
          query = query.eq(key as keyof T, value as T[keyof T]);
        }
        const result = await query.execute();
        if (result.error) {
          throw new Error(result.error.message);
        }
        successful++;
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        failed++;
      }
    }

    return {
      data: results,
      count: conditions.length,
      successful,
      failed,
      errors,
    };
  }

  // executeWithPagination method
  async executeWithPagination(options?: ExecuteOptions): Promise<import('../types').PaginationResult<T>> {
    const result = await this.execute(options);
    if (result.error) {
      throw new Error(result.error.message);
    }

    const data = result.data || [];
    const limit = this.state.limit || 10;
    const offset = this.state.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const totalItems = result.count || data.length;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: Array.isArray(data) ? data : [data],
      pagination: {
        page,
        pageSize: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        offset,
      },
    };
  }

  // Execution methods
  async execute(options?: ExecuteOptions): Promise<QueryResponse<T>> {
    const cacheKey = this.buildCacheKey();
    
    // Check cache first
    if (!options?.head) {
      const cached = this.cache.get<T[]>(cacheKey);
      if (cached) {
        return { data: cached, error: null };
      }
    }

    try {
      const url = this.buildUrl();
      const headers = await this.buildHeaders(options);
      
      const response = await this.httpClient.get<T[]>(url, headers);
      
      // Cache successful results
      if (response.status === 200 && !options?.head) {
        this.cache.set(cacheKey, response.data);
      }

      const count = this.extractCount(response.headers);
      
      // Transform response data if enabled
      let transformedData: any = response.data;
      if (this.isColumnTransformEnabled() && response.data) {
        // Handle both single objects and arrays
        if (Array.isArray(response.data)) {
          transformedData = transformArrayKeysToCamel(response.data as Record<string, unknown>[]);
        } else if (typeof response.data === 'object') {
          transformedData = transformKeysToCamel(response.data as Record<string, unknown>);
        }
      }
      
      return {
        data: transformedData,
        error: null,
        ...(count !== undefined && { count }),
        statusCode: response.status,
      };

    } catch (error) {
      return {
        data: null,
        error: error instanceof PostgRESTError ? error : new PostgRESTError(String(error), 500),
        statusCode: (error && typeof error === 'object' && 'statusCode' in error && typeof (error as any).statusCode === 'number') ? (error as any).statusCode : 500,
      };
    }
  }

  async getOneOrFail(): Promise<T> {
    const result = await this.getOne();
    if (result.error) {
      throw result.error;
    }
    if (!result.data) {
      throw new PostgRESTError(`No entity found for table "${this.tableName}"`, 404, 'not_found');
    }
    // Handle both single records and arrays from PostgREST response
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!data) {
      throw new PostgRESTError(`No entity found for table "${this.tableName}"`, 404, 'not_found');
    }
    return data;
  }

  async getCount(): Promise<number> {
    const result = await this.execute({ head: true, count: 'exact' });
    return result.count || 0;
  }

  // Mutation methods
  insert(values: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    const insertData = Array.isArray(values) ? values : [values];
    
    return new MutationQueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      'INSERT',
      insertData,
      undefined,
      this.queryOptions
    ) as any;
  }

  update(values: Partial<T>): QueryBuilder<T> {
    return new MutationQueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      'PATCH',
      values,
      this.state,
      this.queryOptions
    ) as any;
  }

  upsert(values: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    const upsertData = Array.isArray(values) ? values : [values];
    
    return new MutationQueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      'POST',
      upsertData,
      this.state,
      this.queryOptions
    ) as any;
  }

  delete(): QueryBuilder<T> {
    return new MutationQueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      'DELETE',
      undefined,
      this.state,
      this.queryOptions
    ) as any;
  }

  // Raw PostgREST integration methods
  /**
   * Add raw PostgREST query parameters to the current query
   * @param params - Raw PostgREST parameters as key-value pairs
   */
  rawParams(params: Record<string, string>): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      rawParams: {
        ...this.state.rawParams,
        ...params,
      },
    });
  }

  /**
   * Add raw PostgREST filter expressions
   * @param filters - Raw PostgREST filter expressions
   */
  rawFilter(filters: Record<string, string>): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      rawFilters: {
        ...this.state.rawFilters,
        ...filters,
      },
    });
  }

  /**
   * Add raw PostgREST select statement
   * @param selectExpression - Raw PostgREST select expression
   */
  rawSelect(selectExpression: string): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      rawSelect: selectExpression,
    });
  }

  /**
   * Add raw PostgREST order expression
   * @param orderExpression - Raw PostgREST order expression
   */
  rawOrder(orderExpression: string): QueryBuilder<T> {
    return this.clone({
      ...this.state,
      rawOrder: orderExpression,
    });
  }

  /**
   * Execute a completely raw PostgREST query while maintaining query builder context
   * @param rawQuery - Complete raw PostgREST query string
   * @param options - Execute options
   */
  async rawQuery<TResult = T>(rawQuery: string, options?: ExecuteOptions): Promise<import('../types').RawQueryResult<TResult[]>> {
    const headers = await this.auth.getHeaders();
    
    // Add any custom headers from options
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    // Add schema headers if configured
    if (this.config.schema && this.config.schema !== 'public') {
      headers['Accept-Profile'] = this.config.schema;
      headers['Content-Profile'] = this.config.schema;
    }

    // Add count preference if requested
    if (options?.count) {
      headers['Prefer'] = `count=${options.count}`;
    }

    try {
      const response = await this.httpClient.get<TResult[]>(`/${rawQuery}`, headers);
      
      const count = response.headers?.['content-range']?.split('/')[1];
      
      return {
        data: response.data,
        error: null,
        count: count === '*' ? null : count ? parseInt(count, 10) : null,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        count: null,
        status: (error as any)?.status || 0,
        statusText: (error as any)?.statusText || 'Unknown Error',
      };
    }
  }

  /**
   * Set column name transformation for this query (overrides global setting)
   * @param enabled - true to enable camelCase ↔ snake_case transformation, false to disable
   * @example
   * client.from('users')
   *   .transformColumns(true)  // Enable transformation for this query
   *   .select('firstName', 'lastName')
   *   .where('isActive', 'eq', true)
   */
  transformColumns(enabled: boolean): QueryBuilder<T> {
    // Create new QueryBuilder with updated queryOptions
    const newQueryOptions = { ...this.queryOptions, transformColumns: enabled };
    
    return new QueryBuilder<T>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      this.state,
      newQueryOptions
    );
  }

  /**
   * Build select clause with embedded resources for JOINs
   */
  private buildSelectWithJoins(): string {
    let baseSelect = this.state.select || '*';
    const joins = this.state.joins || [];
    
    // Transform select clause if needed
    if (this.isColumnTransformEnabled() && baseSelect !== '*') {
      baseSelect = transformSelectExpression(baseSelect, true);
    }
    
    if (joins.length === 0) {
      return baseSelect;
    }

    // Build embedded resources for PostgREST
    const embeddedResources = joins.map(join => {
      let resource = join.table;
      
      // Apply join type modifiers for PostgREST
      switch (join.type) {
        case 'inner':
          // Inner join uses !inner hint - ensures related record must exist
          resource = `${join.table}!inner`;
          break;
        case 'left':
          // Left join is default behavior in PostgREST embedded resources
          resource = join.table;
          break;
        case 'right':
          // Right join using PostgREST hint modifier
          resource = `${join.table}!right`;
          break;
        case 'full':
          // Full outer join using PostgREST hint modifier
          resource = `${join.table}!full`;
          break;
        case 'cross':
          // Cross join - use all records without foreign key constraint
          // PostgREST handles this through embedded resources without filtering
          resource = join.table;
          break;
        default:
          // Default to left join behavior
          resource = join.table;
      }
      
      // Add selected columns for the joined table with alias support
      if (join.select) {
        let selectColumns: string;
        if (Array.isArray(join.select)) {
          selectColumns = this.buildSelectWithAliases(join.select);
        } else {
          selectColumns = join.select;
        }
        resource += `(${selectColumns})`;
      } else {
        resource += `(*)`;
      }
      
      return resource;
    }).join(', ');

    // Combine base select with embedded resources
    if (baseSelect === '*') {
      return `*, ${embeddedResources}`;
    } else {
      return `${baseSelect}, ${embeddedResources}`;
    }
  }

  /**
   * Process relation-aware select syntax and convert to PostgREST embedded resources
   * Converts "*, posts.title, posts.content" to "*, posts(title,content)"
   */
  private processRelationAwareSelect(selectString: string): string {
    if (!this.state.relations || this.state.relations.length === 0) {
      return selectString; // No relations defined, return as-is
    }

    const columns = selectString.split(',').map(col => col.trim());
    const mainColumns: string[] = [];
    const relationColumns: Record<string, string[]> = {};

    // Group columns by relation
    for (const column of columns) {
      if (column === '*') {
        mainColumns.push(column);
        continue;
      }

      // Check if this is a relation column (e.g., "posts.title")
      const relationMatch = column.match(/^(\w+)\.(.+)$/);
      if (relationMatch) {
        const [, relationAlias, columnName] = relationMatch;
        
        // Find the actual relation name from the alias
        const relation = this.state.relations.find(r => r.alias === relationAlias);
        if (relation && columnName) {
          if (!relationColumns[relation.name]) {
            relationColumns[relation.name] = [];
          }
          relationColumns[relation.name]!.push(columnName);
        } else {
          // If no relation found, treat as main column
          mainColumns.push(column);
        }
      } else {
        mainColumns.push(column);
      }
    }

    // Build the final select string
    const selectParts: string[] = [];

    // Add main columns
    if (mainColumns.length > 0) {
      selectParts.push(...mainColumns);
    }

    // Add relation columns as embedded resources
    for (const relation of this.state.relations) {
      const columns = relationColumns[relation.name];
      if (columns && columns.length > 0) {
        selectParts.push(`${relation.name}(${columns.join(',')})`);
      } else if (relation.columns === '*') {
        selectParts.push(`${relation.name}(*)`);
      } else if (Array.isArray(relation.columns)) {
        selectParts.push(`${relation.name}(${relation.columns.join(',')})`);
      }
    }

    return selectParts.join(', ');
  }

  /**
   * Build select string with alias support from array of column expressions
   * Supports "column AS alias" syntax
   */
  private buildSelectWithAliases(columns: string[]): string {
    return columns.map(column => {
      // Check if column contains AS syntax
      const asMatch = column.match(/^\s*(.+?)\s+AS\s+(.+?)\s*$/i);
      if (asMatch && asMatch[1] && asMatch[2]) {
        let originalColumn = asMatch[1].trim();
        const alias = asMatch[2].trim();
        
        // Apply column transformation if enabled
        if (this.isColumnTransformEnabled()) {
          originalColumn = transformColumnName(originalColumn, true);
        }
        
        // PostgREST uses colon syntax for aliases: alias:column_name
        return `${alias}:${originalColumn}`;
      }
      
      // Apply transformation to non-aliased columns too
      let columnName = column.trim();
      if (this.isColumnTransformEnabled()) {
        columnName = transformColumnName(columnName, true);
      }
      
      return columnName;
    }).join(', ');
  }

  /**
   * Parse select array to separate main table columns and relation columns
   */
  private static parseSelectWithRelations<T>(
    select: string | string[] | (keyof T)[] | import('../types').FindOptionsSelect<T> | undefined,
    relations: string[] | Record<string, boolean> | undefined
  ): {
    mainTableColumns: string[];
    relationColumns: Record<string, string[]>;
  } {
    let mainTableColumns: string[] = [];
    const relationColumns: Record<string, string[]> = {};
    
    if (!select) {
      return { mainTableColumns, relationColumns };
    }
    
    // Handle FindOptionsSelect object
    if (typeof select === 'object' && !Array.isArray(select)) {
      mainTableColumns = Object.keys(select as Record<string, unknown>).filter(k => (select as Record<string, unknown>)[k] === true);
      return { mainTableColumns, relationColumns };
    }
    
    // Handle array of columns
    if (Array.isArray(select)) {
      for (const col of select) {
        const cleanCol = String(col).trim();
        
        // Check if it's a column from a related table (contains dot)
        if (cleanCol.includes('.') && !cleanCol.toUpperCase().includes(' AS ')) {
          // It's a related table column like 'course_category.course_id'
          const [tableName, ...columnParts] = cleanCol.split('.');
          const columnName = columnParts.join('.');
          
          if (tableName && columnName) {
            if (!relationColumns[tableName]) {
              relationColumns[tableName] = [];
            }
            relationColumns[tableName].push(columnName);
          }
        } else if (cleanCol.toUpperCase().includes(' AS ')) {
          // Handle alias - check if source is from related table
          const [sourceCol, alias] = cleanCol.split(/\s+AS\s+/i).map((s: string) => s.trim());
          if (sourceCol && sourceCol.includes('.')) {
            // It's an aliased column from a related table
            const [tableName, ...columnParts] = sourceCol.split('.');
            const columnName = columnParts.join('.');
            
            if (tableName && columnName) {
              if (!relationColumns[tableName]) {
                relationColumns[tableName] = [];
              }
              // Use the PostgREST alias syntax: alias:column
              relationColumns[tableName].push(`${alias}:${columnName}`);
            }
          } else {
            // Main table column with alias
            mainTableColumns.push(cleanCol);
          }
        } else {
          // Check if this column name matches a relation name - if so, skip it
          const isRelationName = relations && (
            (Array.isArray(relations) && relations.includes(cleanCol)) ||
            (!Array.isArray(relations) && cleanCol in relations)
          );
          
          if (!isRelationName) {
            // It's a main table column
            mainTableColumns.push(cleanCol);
          }
        }
      }
    }
    
    return { mainTableColumns, relationColumns };
  }

  // Helper methods
  private addFilter<K extends keyof T>(
    column: K | string,
    operator: FilterOperator,
    value: unknown
  ): QueryBuilder<T> {
    validateColumnName(String(column));
    validateFilterValue(value);

    const filter: Filter<T> = {
      column,
      operator,
      value,
    };

    return this.clone({
      ...this.state,
      filters: [...this.state.filters, filter],
    });
  }

  private clone<U = T>(newState?: QueryState<U>): QueryBuilder<U> {
    return new QueryBuilder<U>(
      this.tableName,
      this.httpClient,
      this.cache,
      this.auth,
      this.config,
      newState as QueryState<U>,
      this.queryOptions
    );
  }

  /**
   * Check if column transformation is enabled (query-level overrides global)
   */
  protected isColumnTransformEnabled(): boolean {
    return shouldTransformColumns(this.config.transformColumns, this.queryOptions.transformColumns);
  }

  private buildUrl(): string {
    const parts: string[] = [];

    // Add select with embedded resources (JOINs) or raw select
    const selectClause = this.state.rawSelect || this.buildSelectWithJoins();
    if (selectClause) {
      parts.push(`select=${encodeURIComponent(selectClause)}`);
    }

    // Add filters
    this.state.filters.forEach(filter => {
      if (filter.operator === 'and' || filter.operator === 'or') {
        parts.push(`${filter.operator}=${encodeURIComponent(String(filter.value))}`);
      } else {
        const value = this.formatValue(filter.value);
        const columnName = this.isColumnTransformEnabled() 
          ? transformColumnName(String(filter.column), true)
          : String(filter.column);
        parts.push(`${columnName}=${filter.operator}.${encodeURIComponent(value)}`);
      }
    });

    // Add raw filters
    if (this.state.rawFilters) {
      Object.entries(this.state.rawFilters).forEach(([key, value]) => {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
    }

    // Add ordering (raw order takes precedence)
    const orderClause = this.state.rawOrder;
    if (orderClause) {
      parts.push(`order=${encodeURIComponent(orderClause)}`);
    } else if (this.state.order) {
      const direction = this.state.order.ascending ? 'asc' : 'desc';
      const nullsOrder = this.state.order.nullsFirst ? '.nullsfirst' : '.nullslast';
      const columnName = this.isColumnTransformEnabled() 
        ? transformColumnName(String(this.state.order.column), true)
        : String(this.state.order.column);
      parts.push(`order=${columnName}.${direction}${nullsOrder}`);
    }

    // Add pagination
    if (this.state.limit !== undefined) {
      parts.push(`limit=${this.state.limit}`);
    }

    if (this.state.offset !== undefined) {
      parts.push(`offset=${this.state.offset}`);
    }

    // Add groupBy
    if (this.state.groupBy) {
      parts.push(`group_by=${encodeURIComponent(this.state.groupBy)}`);
    }

    // Add having
    if (this.state.having) {
      parts.push(`having=${encodeURIComponent(this.state.having)}`);
    }

    // Add raw parameters (these take precedence and can override existing params)
    if (this.state.rawParams) {
      Object.entries(this.state.rawParams).forEach(([key, value]) => {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
    }

    const queryString = parts.length > 0 ? `?${parts.join('&')}` : '';
    return `/${this.tableName}${queryString}`;
  }

  private async buildHeaders(options?: ExecuteOptions): Promise<Record<string, string>> {
    const headers = await this.auth.getHeaders();

    // Add count header
    if (options?.count) {
      headers['Prefer'] = `count=${options.count}`;
    }

    // Add single resource header
    if (this.state.single) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    // Add role header if specified
    if (this.state.role) {
      headers['X-PostgREST-Role'] = this.state.role;
    }

    return headers;
  }

  private buildCacheKey(): string {
    const keyBuilder = CacheKeyBuilder.create()
      .table(this.tableName);

    if (this.state.select) {
      keyBuilder.select(this.state.select);
    }

    this.state.filters.forEach(filter => {
      keyBuilder.filter(String(filter.column), filter.operator, filter.value);
    });

    if (this.state.order) {
      keyBuilder.order(String(this.state.order.column), this.state.order.ascending);
    }

    if (this.state.limit) {
      keyBuilder.limit(this.state.limit);
    }

    if (this.state.offset) {
      keyBuilder.offset(this.state.offset);
    }

    if (this.state.groupBy) {
      keyBuilder.groupBy(this.state.groupBy);
    }

    if (this.state.having) {
      keyBuilder.having(this.state.having);
    }

    if (this.state.role) {
      keyBuilder.role(this.state.role);
    }

    // Add user context if available
    const user = this.auth.getUser();
    if (user) {
      keyBuilder.user(user.id);
    }

    return keyBuilder.build();
  }

  protected formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  }

  private extractCount(headers: Record<string, string>): number | undefined {
    const contentRange = headers['content-range'];
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      return match?.[1] ? parseInt(match[1], 10) : undefined;
    }
    return undefined;
  }
}

/**
 * Mutation query builder for INSERT, UPDATE, DELETE operations
 */
class MutationQueryBuilder<T> extends QueryBuilder<T> {
  constructor(
    tableName: string,
    httpClient: HttpClient,
    cache: QueryCache,
    auth: AuthManager,
    config: ClientConfig,
    private operation: 'INSERT' | 'PATCH' | 'POST' | 'DELETE',
    private data?: unknown,
    initialState?: QueryState<T>,
    queryOptions?: QueryOptions
  ) {
    super(tableName, httpClient, cache, auth, config, initialState, queryOptions);
  }



  override async execute(options?: ExecuteOptions): Promise<QueryResponse<T>> {
    try {
      const url = this.buildMutationUrl();
      const headers = await this.buildMutationHeaders(options);
      
      // Transform outbound data (JS -> DB) if needed
      let transformedData = this.data;
      if (this.isColumnTransformEnabled() && this.data && this.operation !== 'DELETE') {
        if (Array.isArray(this.data)) {
          transformedData = transformArrayKeysToSnake(this.data as Record<string, unknown>[]);
        } else if (typeof this.data === 'object' && this.data !== null) {
          transformedData = transformKeysToSnake(this.data as Record<string, unknown>);
        }
      }
      
      let response;
      switch (this.operation) {
        case 'INSERT':
        case 'POST':
          response = await this.httpClient.post<T[]>(url, transformedData, headers);
          break;
        case 'PATCH':
          response = await this.httpClient.patch<T[]>(url, transformedData, headers);
          break;
        case 'DELETE':
          response = await this.httpClient.delete<T[]>(url, headers);
          break;
      }

      // Invalidate cache for this table
      this.cache.invalidate(`table:${this.tableName}*`);

      // Transform response data (DB -> JS) if needed
      let transformedResponseData: any = response.data;
      if (this.isColumnTransformEnabled() && response.data) {
        // Handle both single objects and arrays
        if (Array.isArray(response.data)) {
          transformedResponseData = transformArrayKeysToCamel(response.data as Record<string, unknown>[]);
        } else if (typeof response.data === 'object') {
          transformedResponseData = transformKeysToCamel(response.data as Record<string, unknown>);
        }
      }

      return {
        data: transformedResponseData,
        error: null,
        statusCode: response.status,
      };

    } catch (error) {
      return {
        data: null,
        error: error instanceof PostgRESTError ? error : new PostgRESTError(String(error), 500),
        statusCode: (error && typeof error === 'object' && 'statusCode' in error && typeof (error as any).statusCode === 'number') ? (error as any).statusCode : 500,
      };
    }
  }

  private buildMutationUrl(): string {
    // For INSERT operations, we don't need filters in the URL
    if (this.operation === 'INSERT' || this.operation === 'POST') {
      return `/${this.tableName}`;
    }
    
    // For UPDATE/DELETE, we need to build the filter part
    const filters = this.getFilters();
    const queryString = filters.length > 0 ? `?${filters.join('&')}` : '';
    return `/${this.tableName}${queryString}`;
  }

  private async buildMutationHeaders(options?: ExecuteOptions): Promise<Record<string, string>> {
    const headers = await this.auth.getHeaders();

    // Add return preference
    const preferences = [];
    
    // For INSERT operations, always return the newly created data
    if (this.operation === 'INSERT' || this.operation === 'POST') {
      preferences.push('return=representation');
    } else if (this.getSelect()) {
      // For UPDATE/DELETE, only return representation if select is specified
      preferences.push('return=representation');
    }
    
    if (options?.count) {
      preferences.push(`count=${options.count}`);
    }
    
    if (preferences.length > 0) {
      headers['Prefer'] = preferences.join(',');
    }

    // Add single resource header for single operations
    if (this.isSingle()) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    return headers;
  }

  private getFilters(): string[] {
    const state = this.getState();
    const parts: string[] = [];

    state.filters.forEach(filter => {
      if (filter.operator === 'and' || filter.operator === 'or') {
        parts.push(`${filter.operator}=${encodeURIComponent(String(filter.value))}`);
      } else {
        const value = this.formatValue(filter.value);
        parts.push(`${String(filter.column)}=${filter.operator}.${encodeURIComponent(value)}`);
      }
    });

    return parts;
  }

  private getState(): QueryState<T> {
    return (this as any).state;
  }

  private getSelect(): string | undefined {
    return this.getState().select;
  }

  private isSingle(): boolean {
    return this.getState().single || false;
  }
}