import chalk from 'chalk';
import { SchemaInspector, DatabaseConnection, TableColumn, TableIndex } from './SchemaInspector.js';
import { getPostgRESTConfig, PostgRESTConfig } from '../utils/postgrest-config.js';
import { parsePostgreSQLArray } from '../utils/postgres-array-parser.js';

export interface IndexConfig {
  tableName: string;
  columns: string[];
  type: 'btree' | 'gin' | 'gist' | 'hash' | 'spgist' | 'brin';
  unique?: boolean;
  where?: string;
  name?: string;
  concurrent?: boolean;
  include?: string[];
  indexName?: string;
  indexType?: string;
  reason?: string;
  impact?: string;
  // PostgREST configuration
  schema?: string;
  anonRole?: string;
  jwtSecret?: string;
  serverHost?: string;
  serverPort?: number;
  preRequest?: string;
}

export interface IndexAnalysis {
  existingIndexes: TableIndex[];
  missingIndexes: IndexConfig[];
  redundantIndexes: TableIndex[];
  performanceIssues: string[];
  recommendations: IndexConfig[];
}

export class IndexGenerator {
  private schemaInspector: SchemaInspector;

  constructor(private projectPath: string) {
    this.schemaInspector = new SchemaInspector(projectPath);
  }

  /**
   * Generate performance indexes for a specific table
   */
  async generateTableIndexes(tableName: string): Promise<string> {
    console.log(chalk.blue(`🔍 Analyzing indexes for table: ${tableName}`));
    
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      return await this.generateTemplateIndexes(tableName);
    }

    try {
      const columns = await this.schemaInspector.analyzeTable(tableName, connection);
      const analysis = await this.analyzeTableIndexes(tableName, connection);
      
      let indexes = `-- Performance indexes for ${tableName}\n`;
      indexes += `-- Generated on ${new Date().toISOString()}\n`;
      indexes += `-- Analysis: ${analysis.missingIndexes.length} missing, ${analysis.redundantIndexes.length} redundant\n\n`;
      
      // Add performance issues as comments
      if (analysis.performanceIssues.length > 0) {
        indexes += `-- Performance Issues Detected:\n`;
        analysis.performanceIssues.forEach(issue => {
          indexes += `-- • ${issue}\n`;
        });
        indexes += '\n';
      }

      // Generate missing indexes
      if (analysis.missingIndexes.length > 0) {
        indexes += `-- Missing Recommended Indexes\n`;
        for (const indexConfig of analysis.missingIndexes) {
          indexes += await this.generateCustomIndex(indexConfig);
        }
      }

      // Standard performance indexes
      indexes += await this.generateStandardIndexes(tableName, columns, connection);
      
      // Foreign key indexes
      indexes += await this.generateForeignKeyIndexes(tableName, columns, connection);
      
      // Search indexes
      indexes += await this.generateSearchIndexes(tableName, columns, connection);
      
      // Composite indexes for common patterns
      indexes += await this.generateCompositeIndexes(tableName, columns, connection);

      // Query-specific indexes
      indexes += await this.generateQuerySpecificIndexes(tableName, connection);

      console.log(chalk.green(`✅ Generated index recommendations for ${tableName}`));
      return indexes;
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Database analysis failed, using template: ${error.message}`));
      return await this.generateTemplateIndexes(tableName);
    }
  }

  /**
   * Analyze existing indexes and suggest improvements
   */
  async analyzeTableIndexes(tableName: string, connection: DatabaseConnection): Promise<IndexAnalysis> {
    const { Pool } = await import('pg');
    const pool = new Pool(connection);
    
    try {
      // Get existing indexes
      const existingResult = await pool.query(`
        SELECT 
          i.relname as index_name,
          t.relname as table_name,
          array_agg(a.attname ORDER BY c.ordinality) as columns,
          am.amname as index_type,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary,
          pg_get_expr(ix.indpred, ix.indrelid) as condition,
          pg_relation_size(i.oid) as size_bytes
        FROM pg_class i
        JOIN pg_index ix ON i.oid = ix.indexrelid
        JOIN pg_class t ON ix.indrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_am am ON i.relam = am.oid
        JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
        WHERE n.nspname = $1
          AND t.relname = $1
          AND i.relkind = 'i'
        GROUP BY i.relname, t.relname, am.amname, ix.indisunique, ix.indisprimary, ix.indpred, i.oid
        ORDER BY i.relname
      `, [tableName]);

      const existingIndexes: TableIndex[] = existingResult.rows.map(row => ({
        name: row.index_name,
        table: row.table_name,
        columns: parsePostgreSQLArray(row.columns),
        type: row.index_type,
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
        condition: row.condition
      }));

      // Get table columns for analysis
      const columns = await this.schemaInspector.analyzeTable(tableName, connection);
      
      // Analyze missing indexes
      const missingIndexes = this.findMissingIndexes(tableName, columns, existingIndexes);
      
      // Find redundant indexes
      const redundantIndexes = this.findRedundantIndexes(existingIndexes);
      
      // Detect performance issues
      const performanceIssues = await this.detectPerformanceIssues(tableName, columns, connection);

      return {
        existingIndexes,
        missingIndexes,
        redundantIndexes,
        performanceIssues,
        recommendations: missingIndexes
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Generate all recommended indexes for multiple tables
   */
  async generateRecommendedIndexes(): Promise<Record<string, string>> {
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      throw new Error('Database connection required for comprehensive index analysis');
    }

    const tableNames = await this.schemaInspector.getTableNames(connection);
    const indexes: Record<string, string> = {};

    console.log(chalk.blue(`🔍 Analyzing indexes for ${tableNames.length} tables...`));

    for (const tableName of tableNames) {
      try {
        indexes[tableName] = await this.generateTableIndexes(tableName);
        console.log(chalk.green(`✅ Completed ${tableName}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Skipped ${tableName}: ${error.message}`));
        indexes[tableName] = `-- Error analyzing ${tableName}: ${error.message}\n`;
      }
    }

    return indexes;
  }

  /**
   * Generate custom index
   */
  async generateCustomIndex(config: IndexConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config.schema || postgrestConfig.dbSchemas;
    const { tableName, columns, type, unique, where, name, concurrent, include } = config;
    
    const indexName = name || `idx_${tableName}_${columns.join('_').replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const uniqueKeyword = unique ? 'UNIQUE ' : '';
    const concurrentKeyword = concurrent ? 'CONCURRENTLY ' : '';
    const whereClause = where ? ` WHERE ${where}` : '';
    const includeClause = include && include.length > 0 ? ` INCLUDE (${include.join(', ')})` : '';
    
    let sql = `-- Index: ${indexName}\n`;
    sql += `CREATE ${uniqueKeyword}INDEX ${concurrentKeyword}IF NOT EXISTS ${indexName}\n`;
    sql += `  ON ${schema}.${tableName}\n`;
    sql += `  USING ${type} (${columns.join(', ')})${includeClause}${whereClause};\n\n`;
    
    return sql;
  }

  /**
   * Generate standard performance indexes
   */
  private async generateStandardIndexes(tableName: string, columns: TableColumn[], connection?: DatabaseConnection): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig(connection);
    let indexes = `-- Standard Performance Indexes\n`;
    
    // Created_at index (common for sorting and filtering)
    if (columns.some(col => col.name === 'created_at')) {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (created_at DESC);\n\n`;
    }
    
    // Updated_at index
    if (columns.some(col => col.name === 'updated_at')) {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (updated_at DESC);\n\n`;
    }
    
    // User_id index (common for RLS and user-specific queries)
    if (columns.some(col => col.name === 'user_id')) {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (user_id);\n\n`;
    }
    
    // Status/state column indexes
    const statusColumns = columns.filter(col => 
      ['status', 'state', 'is_active', 'is_published', 'is_public', 'is_deleted', 'published'].includes(col.name)
    );
    
    statusColumns.forEach(col => {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${col.name}\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (${col.name});\n\n`;
    });

    // Category/type columns
    const categoryColumns = columns.filter(col => 
      ['category', 'type', 'kind', 'classification'].includes(col.name)
    );
    
    categoryColumns.forEach(col => {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${col.name}\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (${col.name});\n\n`;
    });
    
    return indexes;
  }

  /**
   * Generate foreign key indexes
   */
  private async generateForeignKeyIndexes(tableName: string, columns: TableColumn[], connection?: DatabaseConnection): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig(connection);
    let indexes = `-- Foreign Key Indexes\n`;
    
    const foreignKeys = columns.filter(col => col.isForeignKey);
    
    if (foreignKeys.length === 0) {
      indexes += `-- No foreign keys found\n\n`;
      return indexes;
    }
    
    foreignKeys.forEach(col => {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${col.name}\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (${col.name});\n\n`;
    });
    
    return indexes;
  }

  /**
   * Generate full-text search indexes
   */
  private async generateSearchIndexes(tableName: string, columns: TableColumn[], connection?: DatabaseConnection): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig(connection);
    let indexes = `-- Full-Text Search Indexes\n`;
    
    const textColumns = columns.filter(col => 
      (col.type.toLowerCase().includes('text') || col.type.toLowerCase().includes('varchar')) &&
      ['title', 'name', 'content', 'description', 'body', 'summary', 'bio', 'about'].some(searchField => 
        col.name.toLowerCase().includes(searchField)
      )
    );
    
    if (textColumns.length === 0) {
      indexes += `-- No searchable text columns found\n\n`;
      return indexes;
    }

    // Individual column search indexes
    textColumns.forEach(col => {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${col.name}_search\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName}\n`;
      indexes += `  USING gin(to_tsvector('english', COALESCE(${col.name}, '')));\n\n`;
    });

    // Combined search index if multiple searchable columns
    if (textColumns.length > 1) {
      const columnExpression = textColumns
        .map(col => `COALESCE(${col.name}, '')`)
        .join(` || ' ' || `);
      
      indexes += `-- Combined full-text search index\n`;
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_full_search\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName}\n`;
      indexes += `  USING gin(to_tsvector('english', ${columnExpression}));\n\n`;
    }
    
    return indexes;
  }

  /**
   * Generate composite indexes for common query patterns
   */
  private async generateCompositeIndexes(tableName: string, columns: TableColumn[], connection?: DatabaseConnection): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig(connection);
    let indexes = `-- Composite Indexes for Common Patterns\n`;
    
    const hasUserId = columns.some(col => col.name === 'user_id');
    const hasCreatedAt = columns.some(col => col.name === 'created_at');
    const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
    const statusColumns = columns.filter(col => 
      ['status', 'is_active', 'is_published', 'published'].includes(col.name)
    );
    
    // User + timestamp composites (common for user timelines)
    if (hasUserId && hasCreatedAt) {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_user_created\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (user_id, created_at DESC);\n\n`;
    }
    
    if (hasUserId && hasUpdatedAt) {
      indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_user_updated\n`;
      indexes += `  ON ${postgrestConfig.schema}.${tableName} (user_id, updated_at DESC);\n\n`;
    }
    
    // User + status composites (common for filtering user's active records)
    statusColumns.forEach(statusCol => {
      if (hasUserId) {
        indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_user_${statusCol.name}\n`;
        indexes += `  ON ${postgrestConfig.schema}.${tableName} (user_id, ${statusCol.name});\n\n`;
      }
      
      // Status + timestamp composites
      if (hasCreatedAt) {
        indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${statusCol.name}_created\n`;
        indexes += `  ON ${postgrestConfig.schema}.${tableName} (${statusCol.name}, created_at DESC);\n\n`;
      }
    });

    // Multi-column foreign key patterns
    const foreignKeys = columns.filter(col => col.isForeignKey);
    if (foreignKeys.length >= 2) {
      const fkPairs = [];
      for (let i = 0; i < foreignKeys.length - 1; i++) {
        for (let j = i + 1; j < foreignKeys.length; j++) {
          fkPairs.push([foreignKeys[i], foreignKeys[j]]);
        }
      }
      
      fkPairs.slice(0, 3).forEach(([fk1, fk2]) => { // Limit to prevent too many indexes
        indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_${fk1.name}_${fk2.name}\n`;
        indexes += `  ON ${postgrestConfig.schema}.${tableName} (${fk1.name}, ${fk2.name});\n\n`;
      });
    }
    
    return indexes;
  }

  /**
   * Generate query-specific indexes based on common patterns
   */
  private async generateQuerySpecificIndexes(tableName: string, connection: DatabaseConnection): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig(connection);
    let indexes = `-- Query-Specific Performance Indexes\n`;
    
    // This would ideally analyze actual query logs, but for now we'll use heuristics
    
    // Partial indexes for soft deletes
    indexes += `-- Partial index for non-deleted records (if applicable)\n`;
    indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_active\n`;
    indexes += `  ON ${postgrestConfig.schema}.${tableName} (id)\n`;
    indexes += `  WHERE deleted_at IS NULL;\n\n`;
    
    // Covering indexes for common SELECT patterns
    indexes += `-- Covering index for list queries\n`;
    indexes += `CREATE INDEX IF NOT EXISTS idx_${tableName}_list_covering\n`;
    indexes += `  ON ${postgrestConfig.schema}.${tableName} (created_at DESC)\n`;
    indexes += `  INCLUDE (id, updated_at);\n\n`;
    
    return indexes;
  }

  /**
   * Find missing recommended indexes
   */
  private findMissingIndexes(tableName: string, columns: TableColumn[], existing: TableIndex[]): IndexConfig[] {
    const missing: IndexConfig[] = [];
    const existingColumns = new Set(existing.flatMap(idx => idx.columns));
    
    // Check for missing foreign key indexes
    columns.filter(col => col.isForeignKey).forEach(col => {
      if (!existingColumns.has(col.name)) {
        missing.push({
          tableName,
          columns: [col.name],
          type: 'btree'
        });
      }
    });
    
    // Check for missing timestamp indexes
    ['created_at', 'updated_at'].forEach(timeCol => {
      if (columns.some(col => col.name === timeCol) && !existingColumns.has(timeCol)) {
        missing.push({
          tableName,
          columns: [timeCol],
          type: 'btree'
        });
      }
    });
    
    // Check for missing search indexes on text columns
    columns.filter(col => 
      (col.type.includes('text') || col.type.includes('varchar')) &&
      ['title', 'name', 'content', 'description'].some(field => col.name.includes(field))
    ).forEach(col => {
      const searchIndexName = `${col.name}_search`;
      if (!existing.some(idx => idx.name.includes(searchIndexName))) {
        missing.push({
          tableName,
          columns: [`to_tsvector('english', ${col.name})`],
          type: 'gin'
        });
      }
    });
    
    return missing;
  }

  /**
   * Find redundant indexes
   */
  private findRedundantIndexes(indexes: TableIndex[]): TableIndex[] {
    const redundant: TableIndex[] = [];
    
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const idx1 = indexes[i];
        const idx2 = indexes[j];
        
        // Skip primary keys and unique constraints
        if (idx1.isPrimary || idx2.isPrimary || idx1.isUnique || idx2.isUnique) {
          continue;
        }
        
        // Check if one index is a prefix of another
        if (this.isIndexPrefix(idx1.columns, idx2.columns)) {
          redundant.push(idx1);
        } else if (this.isIndexPrefix(idx2.columns, idx1.columns)) {
          redundant.push(idx2);
        }
      }
    }
    
    return redundant;
  }

  /**
   * Check if one index is a prefix of another
   */
  private isIndexPrefix(shorter: string[], longer: string[]): boolean {
    if (shorter.length >= longer.length) return false;
    
    return shorter.every((col, i) => col === longer[i]);
  }

  /**
   * Detect performance issues
   */
  private async detectPerformanceIssues(tableName: string, columns: TableColumn[], connection: DatabaseConnection): Promise<string[]> {
    const issues: string[] = [];
    const postgrestConfig = await getPostgRESTConfig(connection);
    const schema = postgrestConfig.dbSchemas;
    const { Pool } = await import('pg');
    const pool = new Pool(connection);
    
    try {
      // Check table size
      const sizeResult = await pool.query(`
        SELECT pg_size_pretty(pg_total_relation_size($1)) as size,
               pg_total_relation_size($1) as bytes
        FROM pg_class WHERE relname = $2
      `, [`${schema}.${tableName}`, tableName]);
      
      if (sizeResult.rows[0] && sizeResult.rows[0].bytes > 10000000) { // 10MB+
        issues.push(`Large table (${sizeResult.rows[0].size}) - consider partitioning`);
      }
      
      // Check for missing indexes on foreign keys
      const foreignKeys = columns.filter(col => col.isForeignKey);
      if (foreignKeys.length > 0) {
        const indexResult = await pool.query(`
          SELECT column_name 
          FROM information_schema.statistics 
          WHERE table_name = $1 AND table_schema = $2
        `, [tableName]);
        
        const indexedColumns = new Set(indexResult.rows.map(row => row.column_name));
        
        foreignKeys.forEach(fk => {
          if (!indexedColumns.has(fk.name)) {
            issues.push(`Missing index on foreign key: ${fk.name}`);
          }
        });
      }
      
      // Check for text columns without search indexes
      const searchableColumns = columns.filter(col => 
        (col.type.includes('text') || col.type.includes('varchar')) &&
        ['title', 'name', 'content', 'description'].some(field => col.name.includes(field))
      );
      
      if (searchableColumns.length > 0) {
        issues.push(`Consider adding GIN indexes for full-text search on: ${searchableColumns.map(c => c.name).join(', ')}`);
      }
      
    } catch (error) {
      issues.push(`Could not analyze performance: ${error.message}`);
    } finally {
      await pool.end();
    }
    
    return issues;
  }

  /**
   * Generate template indexes when database analysis is not available
   */
  private async generateTemplateIndexes(tableName: string): Promise<string> {
    const config = await getPostgRESTConfig();
    const schema = config.dbSchemas;
    
    return `-- Template indexes for ${tableName}
-- Generated without database analysis - adjust as needed

-- Common timestamp indexes
CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at
  ON ${schema}.${tableName} (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at
  ON ${schema}.${tableName} (updated_at DESC);

-- Common foreign key indexes (adjust column names as needed)
CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id
  ON ${schema}.${tableName} (user_id);

-- Status/state indexes (adjust column names as needed)
CREATE INDEX IF NOT EXISTS idx_${tableName}_status
  ON ${schema}.${tableName} (status);

-- Composite indexes for common patterns
CREATE INDEX IF NOT EXISTS idx_${tableName}_user_created
  ON ${schema}.${tableName} (user_id, created_at DESC);

-- Full-text search index (adjust column names as needed)
CREATE INDEX IF NOT EXISTS idx_${tableName}_search
  ON ${schema}.${tableName}
  USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '')));

`;
  }

  /**
   * Generate index maintenance functions
   */
  async generateIndexMaintenance(): Promise<string> {
    const config = await getPostgRESTConfig();
    const schema = config.dbSchemas;
    
    return `-- Index maintenance utilities
-- Generated on ${new Date().toISOString()}

-- Function to reindex a table
CREATE OR REPLACE FUNCTION utils.reindex_table(table_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  EXECUTE format('REINDEX TABLE ${schema}.%I', table_name);
  result := format('Reindexed table: %s', table_name);
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION utils.analyze_table(table_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  EXECUTE format('ANALYZE ${schema}.%I', table_name);
  result := format('Analyzed table: %s', table_name);
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get table index information
CREATE OR REPLACE FUNCTION utils.table_indexes(table_name TEXT)
RETURNS TABLE(
  index_name TEXT,
  columns TEXT[],
  index_type TEXT,
  is_unique BOOLEAN,
  size_pretty TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.relname::TEXT as index_name,
    array_agg(a.attname ORDER BY c.ordinality)::TEXT[] as columns,
    am.amname::TEXT as index_type,
    ix.indisunique as is_unique,
    pg_size_pretty(pg_relation_size(i.oid))::TEXT as size_pretty
  FROM pg_class i
  JOIN pg_index ix ON i.oid = ix.indexrelid
  JOIN pg_class t ON ix.indrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  JOIN pg_am am ON i.relam = am.oid
  JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
  WHERE n.nspname = $1
    AND t.relname = table_name
    AND i.relkind = 'i'
  GROUP BY i.relname, am.amname, ix.indisunique, i.oid
  ORDER BY i.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION utils.reindex_table TO authenticated;
GRANT EXECUTE ON FUNCTION utils.analyze_table TO authenticated;
GRANT EXECUTE ON FUNCTION utils.table_indexes TO authenticated;

`;
  }
}