import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { extractDatabaseConnection as extractConnectionCentralized, createConnectionPool, testDatabaseConnection, type DatabaseConnection } from './database-connection.js';
import { getPostgRESTConfig } from './postgrest-config.js';

// Re-export the DatabaseConnection interface from the centralized utility
export type { DatabaseConnection } from './database-connection.js';

export class DatabaseManager {
  constructor(private projectPath: string) {}

  /**
   * Extract database connection from project files using centralized utility
   */
  async extractConnection(): Promise<DatabaseConnection | null> {
    return await extractConnectionCentralized({ 
      projectPath: this.projectPath, 
      verbose: true 
    });
  }

  /**
   * Test database connection using centralized utility
   */
  async testConnection(connection: DatabaseConnection): Promise<boolean> {
    return await testDatabaseConnection(connection);
  }

  /**
   * Execute SQL file
   */
  async executeSQLFile(filePath: string, connection: DatabaseConnection): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`SQL file not found: ${filePath}`);
    }
    
    console.log(chalk.blue(`📄 Executing SQL file: ${filePath}`));
    const sql = readFileSync(filePath, 'utf8');
    await this.executeSQL(sql, connection);
  }

  /**
   * Execute SQL string
   */
  async executeSQL(sql: string, connection: DatabaseConnection): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      ...connection,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 5000,
    });
    
    try {
      // Split SQL into individual statements
      const statements = this.splitSQLStatements(sql);
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(chalk.gray(`Executing: ${statement.slice(0, 50)}...`));
          await pool.query(statement);
        }
      }
      
      console.log(chalk.green('✅ SQL executed successfully'));
    } catch (error) {
      console.error(chalk.red('❌ SQL execution failed:'), error.message);
      throw error;
    } finally {
      await pool.end();
    }
  }

  /**
   * Execute SQL with transaction support
   */
  async executeSQLTransaction(sql: string, connection: DatabaseConnection): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 5000,
    });
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const statements = this.splitSQLStatements(sql);
      
      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }
      
      await client.query('COMMIT');
      console.log(chalk.green('✅ SQL transaction completed successfully'));
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(chalk.red('❌ SQL transaction failed and rolled back:'), error.message);
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  }

  /**
   * Check if database schema exists
   */
  async schemaExists(schemaName: string, connection: DatabaseConnection): Promise<boolean> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const result = await pool.query(
        'SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)',
        [schemaName]
      );
      return result.rows[0].exists;
    } finally {
      await pool.end();
    }
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName: string, schemaName: string = 'api', connection: DatabaseConnection): Promise<boolean> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const result = await pool.query(
        'SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
        [schemaName, tableName]
      );
      return result.rows[0].exists;
    } finally {
      await pool.end();
    }
  }

  /**
   * Get database version and extensions
   */
  async getDatabaseInfo(connection: DatabaseConnection): Promise<{
    version: string;
    extensions: string[];
  }> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const versionResult = await pool.query('SELECT version()');
      const extensionsResult = await pool.query(
        'SELECT extname FROM pg_extension ORDER BY extname'
      );
      
      return {
        version: versionResult.rows[0].version,
        extensions: extensionsResult.rows.map(row => row.extname)
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Create backup of database structure
   */
  async createSchemaBackup(connection: DatabaseConnection, outputPath: string): Promise<void> {
    // This would require pg_dump - for now, create a simple SQL backup
    const postgrestConfig = await getPostgRESTConfig(connection);
    const schema = postgrestConfig.dbSchemas;
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 5000,
    });
    
    try {
      // Get tables
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        ORDER BY table_name
      `, [schema]);
      
      let backup = `-- Database schema backup\n`;
      backup += `-- Generated on ${new Date().toISOString()}\n\n`;
      
      for (const { table_name } of tablesResult.rows) {
        // Get table DDL (simplified)
        const columnsResult = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, [schema, table_name]);
        
        backup += `-- Table: ${table_name}\n`;
        backup += `CREATE TABLE ${schema}.${table_name} (\n`;
        backup += columnsResult.rows.map(col => 
          `  ${col.column_name} ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
        ).join(',\n');
        backup += `\n);\n\n`;
      }
      
      // Write backup
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, backup);
      
      console.log(chalk.green(`✅ Schema backup saved to: ${outputPath}`));
    } finally {
      await pool.end();
    }
  }

  /**
   * Split SQL string into individual statements
   * Handles DO blocks, stored procedures, and complex statements properly
   */
  private splitSQLStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inDollarQuote = false;
    let dollarTag = '';
    let depth = 0;
    
    // Split by lines for processing
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('--')) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check for dollar quoting (like $$ or $tag$)
      const dollarMatches = line.match(/\$(\w*)\$/g);
      if (dollarMatches) {
        for (const match of dollarMatches) {
          if (!inDollarQuote) {
            inDollarQuote = true;
            dollarTag = match;
          } else if (match === dollarTag) {
            inDollarQuote = false;
            dollarTag = '';
          }
        }
      }
      
      // If we're inside dollar quotes, continue accumulating
      if (inDollarQuote) {
        continue;
      }
      
      // Track DO block depth
      if (trimmedLine.match(/\bDO\b/i)) {
        depth++;
      }
      if (trimmedLine.match(/\bEND\b/i) && depth > 0) {
        depth--;
      }
      
      // Check for statement end (semicolon not inside quotes and not in DO block)
      if (trimmedLine.endsWith(';') && depth === 0) {
        const statement = currentStatement.trim();
        if (statement) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    const remaining = currentStatement.trim();
    if (remaining) {
      statements.push(remaining);
    }
    
    return statements.filter(stmt => stmt && stmt.length > 0);
  }
}

/**
 * Connection pool manager for reusing connections
 */
export class ConnectionPool {
  private static pools = new Map<string, any>();

  static async getPool(connection: DatabaseConnection): Promise<any> {
    const key = `${connection.host}:${connection.port}:${connection.database}:${connection.user}`;
    
    if (!this.pools.has(key)) {
      const { Pool } = await import('pg');
      const pool = new Pool({
        ...connection,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      
      this.pools.set(key, pool);
    }
    
    return this.pools.get(key);
  }

  static async closeAll(): Promise<void> {
    const promises = Array.from(this.pools.values()).map(pool => pool.end());
    await Promise.all(promises);
    this.pools.clear();
  }
}

/**
 * Database migration utilities
 */
export class MigrationManager {
  constructor(
    private connection: DatabaseConnection,
    private migrationsPath: string = 'sql/migrations'
  ) {}

  async createMigrationsTable(): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: this.connection.user,
      password: this.connection.password,
      host: this.connection.host,
      port: this.connection.port,
      database: this.connection.database,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS utils.migrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename TEXT NOT NULL UNIQUE,
          executed_at TIMESTAMPTZ DEFAULT NOW(),
          checksum TEXT,
          success BOOLEAN DEFAULT TRUE
        )
      `);
      
      console.log(chalk.green('✅ Migrations table ready'));
    } finally {
      await pool.end();
    }
  }

  async getExecutedMigrations(): Promise<string[]> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: this.connection.user,
      password: this.connection.password,
      host: this.connection.host,
      port: this.connection.port,
      database: this.connection.database,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      const result = await pool.query(
        'SELECT filename FROM utils.migrations WHERE success = TRUE ORDER BY executed_at'
      );
      return result.rows.map(row => row.filename);
    } finally {
      await pool.end();
    }
  }

  async recordMigration(filename: string, success: boolean = true): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: this.connection.user,
      password: this.connection.password,
      host: this.connection.host,
      port: this.connection.port,
      database: this.connection.database,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });
    
    try {
      await pool.query(
        'INSERT INTO utils.migrations (filename, success) VALUES ($1, $2)',
        [filename, success]
      );
    } finally {
      await pool.end();
    }
  }
}