import { join } from 'path';
import chalk from 'chalk';
import { extractDatabaseConnection, createConnectionPool, type DatabaseConnection } from '../utils/database-connection.js';
import { parsePostgreSQLArray } from '../utils/postgres-array-parser.js';

// Re-export DatabaseConnection for backward compatibility
export type { DatabaseConnection } from '../utils/database-connection.js';


export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  defaultValue?: string;
  isUnique?: boolean;
  maxLength?: number;
}

export interface TableRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
  constraintType: 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
}

export interface PolicyInfo {
  name: string;
  table: string;
  command: string;
  using: string;
  withCheck?: string;
}

export interface TableIndex {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'gin' | 'gist' | 'hash';
  isUnique: boolean;
  isPrimary: boolean;
  condition?: string;
}

export interface SchemaAnalysis {
  tables: Record<string, TableColumn[]>;
  relations: TableRelation[];
  indexes: TableIndex[];
  views: string[];
  functions: string[];
  triggers: string[];
}

export class SchemaInspector {
  constructor(private projectPath: string) {}

  /**
   * Extract database connection from project configuration files
   */
  async extractDatabaseConnection(): Promise<DatabaseConnection | null> {
    return await extractDatabaseConnection({ 
      projectPath: this.projectPath,
      verbose: true 
    });
  }

  /**
   * Test database connection
   */
  async testConnection(connection: DatabaseConnection): Promise<boolean> {
    try {
      console.log(chalk.blue('🔗 Testing database connection...'));
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        user: connection.user,
        password: connection.password,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 1000,
      });
      
      await pool.query('SELECT 1');
      await pool.end();
      
      console.log(chalk.green('✅ Database connection successful'));
      return true;
    } catch (error) {
      console.log(chalk.red(`❌ Database connection failed: ${error.message}`));
      return false;
    }
  }

  /**
   * Analyze complete database schema
   */
  async analyzeSchema(connection: DatabaseConnection): Promise<SchemaAnalysis> {
    console.log(chalk.blue('📊 Analyzing database schema...'));
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const [tables, relations, indexes, views, functions, triggers] = await Promise.all([
        this.analyzeTables(pool, connection.schema),
        this.analyzeRelations(pool, connection.schema),
        this.analyzeIndexes(pool, connection.schema),
        this.analyzeViews(pool, connection.schema),
        this.analyzeFunctions(pool, connection.schema),
        this.analyzeTriggers(pool, connection.schema)
      ]);

      const analysis: SchemaAnalysis = {
        tables,
        relations,
        indexes,
        views,
        functions,
        triggers
      };

      console.log(chalk.green(`✅ Schema analysis complete:`));
      console.log(chalk.gray(`   Tables: ${Object.keys(tables).length}`));
      console.log(chalk.gray(`   Relations: ${relations.length}`));
      console.log(chalk.gray(`   Indexes: ${indexes.length}`));
      console.log(chalk.gray(`   Views: ${views.length}`));
      console.log(chalk.gray(`   Functions: ${functions.length}`));
      console.log(chalk.gray(`   Triggers: ${triggers.length}`));

      return analysis;
    } finally {
      await pool.end();
    }
  }

  /**
   * Analyze specific table structure
   */
  async analyzeTable(tableName: string, connection: DatabaseConnection): Promise<TableColumn[]> {
    console.log(chalk.blue(`🔍 Analyzing table: ${tableName}`));
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const query = `
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.is_nullable,
          c.column_default,
          CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
          CASE WHEN tc.constraint_type = 'FOREIGN KEY' THEN true ELSE false END as is_foreign_key,
          CASE WHEN tc.constraint_type = 'UNIQUE' THEN true ELSE false END as is_unique,
          ccu.table_name as referenced_table,
          ccu.column_name as referenced_column
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu 
          ON c.table_name = kcu.table_name 
          AND c.column_name = kcu.column_name 
          AND c.table_schema = kcu.table_schema
        LEFT JOIN information_schema.table_constraints tc 
          ON kcu.constraint_name = tc.constraint_name 
          AND kcu.table_schema = tc.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name 
          AND tc.table_schema = ccu.table_schema
        WHERE c.table_schema = $2 
          AND c.table_name = $1
        ORDER BY c.ordinal_position;
      `;
      
      const result = await pool.query(query, [tableName, connection.schema]);
      
      if (result.rows.length === 0) {
        throw new Error(`Table '${connection.schema}.${tableName}' not found`);
      }

      const columns: TableColumn[] = result.rows.map(row => ({
        name: row.column_name,
        type: this.normalizeDataType(row.data_type),
        nullable: row.is_nullable === 'YES',
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        isUnique: row.is_unique,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column,
        defaultValue: row.column_default,
        maxLength: row.character_maximum_length
      }));

      console.log(chalk.green(`✅ Found ${columns.length} columns in ${tableName}`));
      return columns;
    } finally {
      await pool.end();
    }
  }

  /**
   * Get all table names in the api schema
   */
  async getTableNames(connection: DatabaseConnection): Promise<string[]> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [connection.schema]);
      
      return result.rows.map(row => row.table_name);
    } finally {
      await pool.end();
    }
  }

  /**
   * Detect user ownership patterns in tables
   */
  async detectUserOwnershipPatterns(connection: DatabaseConnection): Promise<Record<string, string>> {
    const tables = await this.getTableNames(connection);
    const patterns: Record<string, string> = {};
    
    for (const table of tables) {
      const columns = await this.analyzeTable(table, connection);
      const userColumn = columns.find(col => 
        ['user_id', 'owner_id', 'created_by', 'author_id'].includes(col.name) && 
        col.isForeignKey
      );
      
      if (userColumn) {
        patterns[table] = userColumn.name;
      }
    }
    
    return patterns;
  }

  /**
   * Check if RLS is enabled on tables
   */
  async checkRLSStatus(connection: DatabaseConnection): Promise<Record<string, boolean>> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const result = await pool.query(`
        SELECT schemaname, tablename, rowsecurity
        FROM pg_tables 
        WHERE schemaname = $1
        ORDER BY tablename
      `, [connection.schema]);
      
      const rlsStatus: Record<string, boolean> = {};
      result.rows.forEach(row => {
        rlsStatus[row.tablename] = row.rowsecurity;
      });
      
      return rlsStatus;
    } finally {
      await pool.end();
    }
  }

  // Database analysis methods

  /**
   * Get existing policies for a specific table
   */
  async getTablePolicies(tableName: string, connection: DatabaseConnection): Promise<PolicyInfo[]> {
    const pool = await createConnectionPool(connection);
    
    try {
      const result = await pool.query(`
        SELECT 
          polname as name,
          CASE polcmd 
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT' 
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
            ELSE 'UNKNOWN'
          END as command,
          pg_get_expr(polqual, polrelid) as using_clause,
          pg_get_expr(polwithcheck, polrelid) as with_check_clause
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = $2 AND c.relname = $1
        ORDER BY polname
      `, [tableName, connection.schema]);
      
      return result.rows.map(row => ({
        name: row.name,
        table: tableName,
        command: row.command,
        using: row.using_clause,
        withCheck: row.with_check_clause
      }));
    } finally {
      await pool.end();
    }
  }

  private async analyzeTables(pool: any, schema: string): Promise<Record<string, TableColumn[]>> {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    `, [schema]);
    
    const tables: Record<string, TableColumn[]> = {};
    
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const columnsResult = await pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.is_nullable,
          c.column_default,
          COALESCE(pk.is_primary, false) as is_primary_key,
          COALESCE(fk.is_foreign, false) as is_foreign_key,
          COALESCE(uq.is_unique, false) as is_unique,
          fk.referenced_table,
          fk.referenced_column
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT kcu.column_name, true as is_primary
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT 
            kcu.column_name, 
            true as is_foreign,
            ccu.table_name as referenced_table,
            ccu.column_name as referenced_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.column_name = fk.column_name
        LEFT JOIN (
          SELECT kcu.column_name, true as is_unique
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'UNIQUE'
        ) uq ON c.column_name = uq.column_name
        WHERE c.table_name = $1 AND c.table_schema = $2
        ORDER BY c.ordinal_position
      `, [tableName, schema]);

      tables[tableName] = columnsResult.rows.map(col => ({
        name: col.column_name,
        type: this.normalizeDataType(col.data_type),
        nullable: col.is_nullable === 'YES',
        isPrimaryKey: col.is_primary_key,
        isForeignKey: col.is_foreign_key,
        isUnique: col.is_unique,
        referencedTable: col.referenced_table,
        referencedColumn: col.referenced_column,
        defaultValue: col.column_default,
        maxLength: col.character_maximum_length
      }));
    }
    
    return tables;
  }

  private async analyzeRelations(pool: any, schema: string): Promise<TableRelation[]> {
    const result = await pool.query(`
      SELECT 
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column,
        tc.constraint_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = $1
        AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE', 'CHECK')
    `, [schema]);
    
    return result.rows.map(row => ({
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toColumn: row.to_column,
      constraintName: row.constraint_name,
      constraintType: row.constraint_type
    }));
  }

  private async analyzeIndexes(pool: any, schema: string): Promise<TableIndex[]> {
    const result = await pool.query(`
      SELECT 
        i.relname as index_name,
        t.relname as table_name,
        array_agg(a.attname ORDER BY c.ordinality) as columns,
        am.amname as index_type,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        pg_get_expr(ix.indpred, ix.indrelid) as condition
      FROM pg_class i
      JOIN pg_index ix ON i.oid = ix.indexrelid
      JOIN pg_class t ON ix.indrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      JOIN pg_am am ON i.relam = am.oid
      JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE n.nspname = $1
        AND i.relkind = 'i'
      GROUP BY i.relname, t.relname, am.amname, ix.indisunique, ix.indisprimary, ix.indpred
      ORDER BY t.relname, i.relname
    `, [schema]);
    
    return result.rows.map(row => ({
      name: row.index_name,
      table: row.table_name,
      columns: parsePostgreSQLArray(row.columns),
      type: row.index_type,
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      condition: row.condition
    }));
  }

  private async analyzeViews(pool: any, schema: string): Promise<string[]> {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = $1
      ORDER BY table_name
    `, [schema]);
    
    return result.rows.map(row => row.table_name);
  }

  private async analyzeFunctions(pool: any, schema: string): Promise<string[]> {
    const result = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = $1
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `, [schema]);
    
    return result.rows.map(row => row.routine_name);
  }

  private async analyzeTriggers(pool: any, schema: string): Promise<string[]> {
    const result = await pool.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_schema = $1
      ORDER BY trigger_name
    `, [schema]);
    
    return result.rows.map(row => row.trigger_name);
  }

  private normalizeDataType(pgType: string): string {
    const typeMapping: Record<string, string> = {
      'character varying': 'VARCHAR',
      'character': 'CHAR',
      'text': 'TEXT',
      'integer': 'INTEGER',
      'bigint': 'BIGINT',
      'smallint': 'SMALLINT',
      'boolean': 'BOOLEAN',
      'uuid': 'UUID',
      'timestamp without time zone': 'TIMESTAMP',
      'timestamp with time zone': 'TIMESTAMPTZ',
      'date': 'DATE',
      'time without time zone': 'TIME',
      'jsonb': 'JSONB',
      'json': 'JSON',
      'numeric': 'NUMERIC',
      'decimal': 'DECIMAL',
      'real': 'REAL',
      'double precision': 'DOUBLE PRECISION',
      'bytea': 'BYTEA'
    };
    
    return typeMapping[pgType.toLowerCase()] || pgType.toUpperCase();
  }
}