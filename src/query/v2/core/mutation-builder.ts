/**
 * V2 MutationBuilder - Fluent API for INSERT, UPDATE, DELETE operations
 * Extends QueryBuilder functionality with mutation-specific methods
 */

import { QueryBuilder } from '../../../core/query-builder';
import type { 
  PGRestifyClient
} from '../../core/types';
import type { FilterOperator } from '../../../types';

export type MutationOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Raw SQL expression for use in mutations
 */
export class RawExpression {
  constructor(public expression: string) {}
  toString(): string {
    return this.expression;
  }
}

/**
 * Parameter expression for use in mutations
 */
export class ParameterExpression {
  constructor(public name: string) {}
  toString(): string {
    return `$${this.name}`;
  }
}

/**
 * Subquery builder for complex WHERE conditions
 */
export class SubqueryBuilder<T = Record<string, unknown>> {
  constructor(
    public column: string,
    public operator: string,
    public subquery: QueryBuilder<T>
  ) {}
  
  toPostgRESTFilter(): string {
    // Convert subquery to PostgREST filter format
    // This would need proper implementation based on your PostgREST setup
    return `${this.column}.${this.operator}.(subquery)`;
  }
}

/**
 * MutationBuilder provides fluent API for database mutations
 * Supports INSERT, UPDATE, DELETE operations with method chaining
 */
export class MutationBuilder<T = Record<string, unknown>> {
  private client: PGRestifyClient;
  private operation?: MutationOperation;
  private tableName?: string;
  private data?: any;
  private updateValues: Record<string, any> = {};
  private conditions: Array<{
    type?: 'OR' | 'OR_SUBQUERY';
    column?: string;
    operator?: string;
    value?: any;
    expression?: string;
    subquery?: SubqueryBuilder;
  }> = [];
  private returnColumns: string[] = [];
  private parameters: Record<string, any> = {};

  constructor(client: PGRestifyClient) {
    this.client = client;
  }

  // ===============================
  // INSERT OPERATIONS
  // ===============================

  /**
   * Start an INSERT operation
   * @param table The table to insert into
   * @returns MutationBuilder for chaining
   * 
   * @example
   * mutation().insertInto('users')
   */
  insertInto(table: string): MutationBuilder<T> {
    this.operation = 'INSERT';
    this.tableName = table;
    return this;
  }

  /**
   * Set values to insert
   * @param data Single object or array of objects to insert
   * @returns MutationBuilder for chaining
   * 
   * @example
   * .values({ name: 'John', email: 'john@example.com' })
   * .values([{ name: 'John' }, { name: 'Jane' }])
   */
  values(data: T | T[]): MutationBuilder<T> {
    this.data = data;
    return this;
  }

  // ===============================
  // UPDATE OPERATIONS
  // ===============================

  /**
   * Start an UPDATE operation
   * @param table The table to update
   * @returns MutationBuilder for chaining
   * 
   * @example
   * mutation().update('posts')
   */
  update(table: string): MutationBuilder<T> {
    this.operation = 'UPDATE';
    this.tableName = table;
    return this;
  }

  /**
   * Set a column value for UPDATE operations
   * @param column Column name
   * @param value Value to set (can be RawExpression for SQL)
   * @returns MutationBuilder for chaining
   * 
   * @example
   * .set('price', 100)
   * .set('updated_at', mutation.raw('NOW()'))
   */
  set(column: string, value: any | RawExpression | ParameterExpression): MutationBuilder<T> {
    if (!this.updateValues) {
      this.updateValues = {};
    }
    this.updateValues[column] = value;
    return this;
  }

  // ===============================
  // DELETE OPERATIONS
  // ===============================

  /**
   * Start a DELETE operation
   * @param table The table to delete from
   * @returns MutationBuilder for chaining
   * 
   * @example
   * mutation().deleteFrom('posts')
   */
  deleteFrom(table: string): MutationBuilder<T> {
    this.operation = 'DELETE';
    this.tableName = table;
    return this;
  }

  // ===============================
  // WHERE CONDITIONS
  // ===============================

  /**
   * Add WHERE condition
   * @param column Column name
   * @param operator Comparison operator
   * @param value Value to compare
   * @returns MutationBuilder for chaining
   * 
   * @example
   * .where('id', '=', 123)
   * .where('status', 'in', ['active', 'pending'])
   */
  where(column: string, operator: string, value: any): MutationBuilder<T> {
    this.conditions.push({ column, operator, value });
    return this;
  }

  /**
   * Add AND WHERE condition (alias for where)
   * @param column Column name
   * @param operator Comparison operator
   * @param value Value to compare
   * @returns MutationBuilder for chaining
   */
  andWhere(column: string, operator: string, value: any): MutationBuilder<T> {
    return this.where(column, operator, value);
  }

  /**
   * Add OR WHERE condition
   * @param condition PostgREST filter expression OR SubqueryBuilder
   * @returns MutationBuilder for chaining
   * 
   * @example
   * .orWhere('status.eq.deleted,status.eq.archived')
   * .orWhere(mutation.subquery('author_id', 'IN', subquery))
   */
  orWhere(condition: string | SubqueryBuilder): MutationBuilder<T> {
    if (typeof condition === 'string') {
      this.conditions.push({ type: 'OR', expression: condition });
    } else {
      this.conditions.push({ type: 'OR_SUBQUERY', subquery: condition });
    }
    return this;
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Specify columns to return from the mutation
   * @param columns Array of column names or '*'
   * @returns MutationBuilder for chaining
   * 
   * @example
   * .returning(['id', 'name', 'created_at'])
   * .returning('*')
   */
  returning(columns: string[] | string): MutationBuilder<T> {
    if (Array.isArray(columns)) {
      this.returnColumns = columns;
    } else {
      this.returnColumns = [columns];
    }
    return this;
  }

  /**
   * Create a raw SQL expression
   * @param expression SQL expression
   * @returns RawExpression instance
   * 
   * @example
   * .set('updated_at', mutation.raw('NOW()'))
   * .set('price', mutation.raw('price * 1.1'))
   */
  raw(expression: string): RawExpression {
    return new RawExpression(expression);
  }

  /**
   * Create a parameter expression
   * @param name Parameter name
   * @returns ParameterExpression instance
   * 
   * @example
   * .where('author_id', '=', mutation.param('currentUserId'))
   */
  param(name: string): ParameterExpression {
    return new ParameterExpression(name);
  }

  /**
   * Create a subquery for WHERE conditions
   * @param column Column to filter
   * @param operator SQL operator (IN, EXISTS, etc.)
   * @param subquery QueryBuilder instance
   * @returns SubqueryBuilder instance
   * 
   * @example
   * .orWhere(mutation.subquery('author_id', 'IN', 
   *   mutation.query().from('users').select('id').where('banned', '=', true)
   * ))
   */
  subquery<TSubquery = Record<string, unknown>>(
    column: string, 
    operator: string, 
    subquery: QueryBuilder<TSubquery>
  ): SubqueryBuilder<TSubquery> {
    return new SubqueryBuilder<TSubquery>(column, operator, subquery);
  }

  /**
   * Create a new QueryBuilder for subqueries
   * @returns QueryBuilder instance
   * 
   * @example
   * const subquery = mutation.query()
   *   .from('users')
   *   .select('id')
   *   .where('banned', '=', true);
   */
  query<TQuery = Record<string, unknown>>(): QueryBuilder<TQuery> {
    // Use the client's from method to create a proper QueryBuilder
    return this.client.from('') as QueryBuilder<TQuery>;
  }

  /**
   * Set parameter values for use with param() expressions
   * @param params Object with parameter name/value pairs
   * @returns MutationBuilder for chaining
   * 
   * @example
   * .setParams({ currentUserId: user.id, timestamp: Date.now() })
   */
  setParams(params: Record<string, any>): MutationBuilder<T> {
    this.parameters = { ...this.parameters, ...params };
    return this;
  }

  // ===============================
  // EXECUTION
  // ===============================

  /**
   * Execute the mutation
   * @returns Promise with mutation results
   * 
   * @example
   * const result = await mutation()
   *   .insertInto('users')
   *   .values({ name: 'John' })
   *   .returning(['id'])
   *   .execute();
   */
  async execute(): Promise<T[]> {
    if (!this.operation || !this.tableName) {
      throw new Error('Invalid mutation: operation and table name are required');
    }

    // Get base QueryBuilder for the table
    const queryBuilder = this.client.from(this.tableName);

    switch (this.operation) {
      case 'INSERT':
        return this.executeInsert(queryBuilder);
      case 'UPDATE':
        return this.executeUpdate(queryBuilder);
      case 'DELETE':
        return this.executeDelete(queryBuilder);
      default:
        throw new Error(`Unsupported mutation operation: ${this.operation}`);
    }
  }

  private async executeInsert(queryBuilder: QueryBuilder<T>): Promise<T[]> {
    if (!this.data) {
      throw new Error('INSERT operation requires data via .values()');
    }

    // Process data to handle raw expressions and parameters
    const processedData = this.processDataForExecution(this.data);

    let query = queryBuilder.insert(processedData);

    // Add return columns if specified
    if (this.returnColumns.length > 0) {
      query = query.select(this.returnColumns.join(', '));
    }

    const result = await query.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }

    return Array.isArray(result.data) ? result.data : [result.data as T];
  }

  private async executeUpdate(queryBuilder: QueryBuilder<T>): Promise<T[]> {
    if (Object.keys(this.updateValues).length === 0) {
      throw new Error('UPDATE operation requires values via .set()');
    }

    let query = queryBuilder;

    // Apply WHERE conditions
    this.applyConditions(query);

    // Process update values to handle raw expressions
    const processedValues = this.processDataForExecution(this.updateValues);
    query = query.update(processedValues);

    // Add return columns if specified
    if (this.returnColumns.length > 0) {
      query = query.select(this.returnColumns.join(', '));
    }

    const result = await query.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }

    return Array.isArray(result.data) ? result.data : [result.data as T];
  }

  private async executeDelete(queryBuilder: QueryBuilder<T>): Promise<T[]> {
    let query = queryBuilder;

    // Apply WHERE conditions
    this.applyConditions(query);

    query = query.delete();

    // Add return columns if specified
    if (this.returnColumns.length > 0) {
      query = query.select(this.returnColumns.join(', '));
    }

    const result = await query.execute();
    if (result.error) {
      throw new Error(result.error.message);
    }

    return Array.isArray(result.data) ? result.data : [result.data as T];
  }

  private applyConditions(query: QueryBuilder<T>): void {
    this.conditions.forEach(condition => {
      if (condition.type === 'OR') {
        query = query.or(condition.expression!);
      } else if (condition.type === 'OR_SUBQUERY') {
        query = query.or(condition.subquery!.toPostgRESTFilter());
      } else if (condition.column && condition.operator) {
        // Apply regular WHERE condition using existing QueryBuilder methods
        const value = this.processValueForExecution(condition.value);
        query = query.where(condition.column, condition.operator as FilterOperator, value);
      }
    });
  }

  private processDataForExecution(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.processDataForExecution(item));
    }

    if (data && typeof data === 'object') {
      const processed: any = {};
      for (const [key, value] of Object.entries(data)) {
        processed[key] = this.processValueForExecution(value);
      }
      return processed;
    }

    return this.processValueForExecution(data);
  }

  private processValueForExecution(value: any): any {
    if (value instanceof RawExpression) {
      // Handle raw SQL expressions
      // This would need proper implementation based on your PostgREST setup
      return value.expression;
    }

    if (value instanceof ParameterExpression) {
      // Resolve parameter values
      if (this.parameters.hasOwnProperty(value.name)) {
        return this.parameters[value.name];
      }
      throw new Error(`Parameter '${value.name}' not found. Use .setParams() to provide parameter values.`);
    }

    return value;
  }
}