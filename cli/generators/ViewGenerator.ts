import chalk from 'chalk';
import { SchemaInspector, DatabaseConnection, TableColumn } from './SchemaInspector.js';
import { getPostgRESTConfig } from '../utils/postgrest-config.js';

export interface ViewConfig {
  name: string;
  baseTable: string;
  joinTables?: Array<{
    table: string;
    joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    condition: string;
  }>;
  selectColumns: string[];
  whereCondition?: string;
  orderBy?: string;
  groupBy?: string[];
  having?: string;
  materialized?: boolean;
  // PostgREST configuration
  schema?: string;
  anonRole?: string;
  jwtSecret?: string;
  serverHost?: string;
  serverPort?: number;
  preRequest?: string;
}

export interface ViewAnalysis {
  suggestedViews: ViewConfig[];
  tableRelationships: Array<{
    fromTable: string;
    toTable: string;
    joinCondition: string;
  }>;
}

export class ViewGenerator {
  private schemaInspector: SchemaInspector;

  constructor(private projectPath: string) {
    this.schemaInspector = new SchemaInspector(projectPath);
  }

  /**
   * Generate a custom view
   */
  async generateView(config: ViewConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config.schema || postgrestConfig.dbSchemas;
    const anonRole = config.anonRole || postgrestConfig.dbAnonRole;
    const { name, baseTable, joinTables = [], selectColumns, whereCondition, orderBy, groupBy, having, materialized = false } = config;
    
    let query = `-- ${materialized ? 'Materialized ' : ''}View: ${name}\n`;
    query += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    if (materialized) {
      query += `CREATE MATERIALIZED VIEW ${schema}.${name} AS\n`;
    } else {
      query += `CREATE VIEW ${schema}.${name} AS\n`;
    }
    
    query += `SELECT \n  ${selectColumns.join(',\n  ')}\n`;
    query += `FROM ${schema}.${baseTable}`;
    
    // Add JOIN clauses
    joinTables.forEach(join => {
      query += `\n${join.joinType} JOIN ${schema}.${join.table} ON ${join.condition}`;
    });
    
    // Add WHERE clause
    if (whereCondition) {
      query += `\nWHERE ${whereCondition}`;
    }
    
    // Add GROUP BY
    if (groupBy && groupBy.length > 0) {
      query += `\nGROUP BY ${groupBy.join(', ')}`;
    }
    
    // Add HAVING
    if (having) {
      query += `\nHAVING ${having}`;
    }
    
    // Add ORDER BY
    if (orderBy) {
      query += `\nORDER BY ${orderBy}`;
    }
    
    query += ';\n\n';
    
    // Enable security barrier for views with RLS
    if (!materialized) {
      query += `-- Enable security barrier for RLS compatibility\n`;
      query += `ALTER VIEW ${schema}.${name} SET (security_barrier = true);\n\n`;
    }
    
    // Grant permissions
    query += `-- Grant permissions for ${name} ${materialized ? 'materialized ' : ''}view\n`;
    query += `GRANT SELECT ON ${schema}.${name} TO ${anonRole};\n`;
    query += `GRANT SELECT ON ${schema}.${name} TO authenticated;\n\n`;
    
    // Add refresh function for materialized views
    if (materialized) {
      query += await this.generateMaterializedViewRefreshFunction(name);
    }
    
    return query;
  }

  /**
   * Analyze schema and suggest useful views
   */
  async suggestViews(): Promise<ViewAnalysis> {
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      throw new Error('Database connection required for view analysis');
    }

    console.log(chalk.blue('🔍 Analyzing schema for view suggestions...'));
    
    const analysis = await this.schemaInspector.analyzeSchema(connection);
    const suggestedViews: ViewConfig[] = [];
    const tableRelationships: Array<{ fromTable: string; toTable: string; joinCondition: string }> = [];
    
    // Build relationship map
    const relations = analysis.relations.filter(r => r.constraintType === 'FOREIGN KEY');
    relations.forEach(rel => {
      tableRelationships.push({
        fromTable: rel.fromTable,
        toTable: rel.toTable,
        joinCondition: `${rel.fromTable}.${rel.fromColumn} = ${rel.toTable}.${rel.toColumn}`
      });
    });

    // Generate user activity views if users table exists
    if (analysis.tables.users) {
      suggestedViews.push(...await this.generateUserActivityViews(analysis.tables, relations, connection));
    }

    // Generate summary/dashboard views
    suggestedViews.push(...await this.generateSummaryViews(analysis.tables, relations, connection));

    // Generate joined data views
    suggestedViews.push(...await this.generateJoinedDataViews(analysis.tables, relations, connection));

    // Generate audit/log views
    suggestedViews.push(...await this.generateAuditViews(analysis.tables, connection));

    console.log(chalk.green(`✅ Generated ${suggestedViews.length} view suggestions`));

    return {
      suggestedViews,
      tableRelationships
    };
  }

  /**
   * Generate common utility views for all tables
   */
  async generateCommonViews(): Promise<Record<string, string>> {
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      throw new Error('Database connection required for generating common views');
    }

    const analysis = await this.schemaInspector.analyzeSchema(connection);
    const views: Record<string, string> = {};

    // Table information view
    views['table_info'] = await this.generateTableInfoView();
    
    // Column information view
    views['column_info'] = await this.generateColumnInfoView();
    
    // Relationship overview view
    views['table_relationships'] = await this.generateRelationshipView();
    
    // User activity view if users exist
    if (analysis.tables.users) {
      views['user_activity'] = await this.generateUserActivityView(Object.keys(analysis.tables));
    }

    // Performance monitoring view
    views['table_sizes'] = await this.generateTableSizeView();

    return views;
  }

  /**
   * Generate user activity views
   */
  private async generateUserActivityViews(tables: Record<string, TableColumn[]>, relations: any[], connection?: DatabaseConnection): Promise<ViewConfig[]> {
    const views: ViewConfig[] = [];
    const userTables = Object.keys(tables).filter(table => 
      tables[table].some(col => col.name === 'user_id' && col.isForeignKey)
    );

    if (userTables.length === 0) return views;

    // User summary view
    const userSummaryColumns = [
      'u.id',
      'u.email',
      'u.created_at as user_since',
      ...userTables.map(table => `COUNT(${table}.id) as ${table}_count`),
      ...userTables.map(table => `MAX(${table}.created_at) as last_${table}_activity`)
    ];

    const userSummaryJoins = userTables.map(table => ({
      table,
      joinType: 'LEFT' as const,
      condition: `u.id = ${table}.user_id`
    }));

    views.push({
      name: 'user_activity_summary',
      baseTable: 'users u',
      joinTables: userSummaryJoins,
      selectColumns: userSummaryColumns,
      groupBy: ['u.id', 'u.email', 'u.created_at'],
      orderBy: 'u.created_at DESC'
    });

    // Recent user activity view
    if (userTables.length > 0) {
      const recentActivityColumns = [
        'u.id as user_id',
        'u.email',
        "'posts' as activity_type",
        'posts.created_at as activity_date',
        'posts.title as activity_description'
      ];

      views.push({
        name: 'recent_user_activity',
        baseTable: 'users u',
        joinTables: [{
          table: 'posts',
          joinType: 'INNER',
          condition: 'u.id = posts.user_id'
        }],
        selectColumns: recentActivityColumns,
        whereCondition: 'posts.created_at >= NOW() - INTERVAL \'30 days\'',
        orderBy: 'posts.created_at DESC'
      });
    }

    return views;
  }

  /**
   * Generate summary/dashboard views
   */
  private async generateSummaryViews(tables: Record<string, TableColumn[]>, relations: any[], connection?: DatabaseConnection): Promise<ViewConfig[]> {
    const views: ViewConfig[] = [];
    const postgrestConfig = await getPostgRESTConfig(connection);

    // Overall system stats
    const tableNames = Object.keys(tables);
    const statsColumns = [
      ...tableNames.map(table => `(SELECT COUNT(*) FROM ${postgrestConfig.schema}.${table}) as ${table}_count`),
      'NOW() as generated_at'
    ];

    views.push({
      name: 'system_stats',
      baseTable: '(SELECT 1) as dummy',
      selectColumns: statsColumns
    });

    // Daily/weekly activity summary
    const activityTables = tableNames.filter(table => 
      tables[table].some(col => col.name === 'created_at')
    );

    if (activityTables.length > 0) {
      const dailyColumns = [
        'DATE(created_at) as activity_date',
        'COUNT(*) as total_records',
        ...activityTables.map(table => 
          `COUNT(CASE WHEN table_name = '${table}' THEN 1 END) as ${table}_count`
        )
      ];

      // Note: This would need a UNION query in practice
      views.push({
        name: 'daily_activity_summary',
        baseTable: activityTables[0], // Simplified for example
        selectColumns: dailyColumns,
        groupBy: ['DATE(created_at)'],
        orderBy: 'activity_date DESC'
      });
    }

    return views;
  }

  /**
   * Generate joined data views
   */
  private async generateJoinedDataViews(tables: Record<string, TableColumn[]>, relations: any[], connection?: DatabaseConnection): Promise<ViewConfig[]> {
    const views: ViewConfig[] = [];

    // Find common join patterns
    const foreignKeys = relations.filter(r => r.constraintType === 'FOREIGN KEY');
    
    // Group foreign keys by referenced table
    const joinPatterns = new Map<string, string[]>();
    foreignKeys.forEach(fk => {
      if (!joinPatterns.has(fk.toTable)) {
        joinPatterns.set(fk.toTable, []);
      }
      joinPatterns.get(fk.toTable)!.push(fk.fromTable);
    });

    // Generate views for popular join patterns
    joinPatterns.forEach((referencingTables, referencedTable) => {
      if (referencingTables.length >= 2) {
        // Create a comprehensive view joining the referenced table with its dependents
        const baseColumns = tables[referencedTable]?.map(col => `${referencedTable}.${col.name}`) || [];
        const joinColumns = referencingTables.flatMap(table => 
          tables[table]?.slice(0, 3).map(col => `${table}.${col.name} as ${table}_${col.name}`) || []
        );

        const joins = referencingTables.map(table => ({
          table,
          joinType: 'LEFT' as const,
          condition: `${referencedTable}.id = ${table}.${referencedTable}_id`
        }));

        views.push({
          name: `${referencedTable}_with_details`,
          baseTable: referencedTable,
          joinTables: joins,
          selectColumns: [...baseColumns.slice(0, 5), ...joinColumns],
          orderBy: `${referencedTable}.created_at DESC`
        });
      }
    });

    return views;
  }

  /**
   * Generate audit/log views
   */
  private async generateAuditViews(tables: Record<string, TableColumn[]>, connection?: DatabaseConnection): Promise<ViewConfig[]> {
    const views: ViewConfig[] = [];

    // Recent changes view (if audit log exists)
    if (tables.audit_log || tables.audit_logs) {
      const auditTable = tables.audit_log ? 'audit_log' : 'audit_logs';
      
      views.push({
        name: 'recent_changes',
        baseTable: auditTable,
        selectColumns: [
          'table_name',
          'operation',
          'user_id',
          'created_at',
          'old_data',
          'new_data'
        ],
        whereCondition: 'created_at >= NOW() - INTERVAL \'7 days\'',
        orderBy: 'created_at DESC'
      });

      // User activity audit
      views.push({
        name: 'user_audit_summary',
        baseTable: auditTable,
        selectColumns: [
          'user_id',
          'table_name',
          'COUNT(*) as operation_count',
          'MAX(created_at) as last_operation',
          'MIN(created_at) as first_operation'
        ],
        groupBy: ['user_id', 'table_name'],
        orderBy: 'operation_count DESC'
      });
    }

    return views;
  }

  /**
   * Generate table information view
   */
  private async generateTableInfoView(): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    const anonRole = postgrestConfig.dbAnonRole;
    
    return `-- Table information overview
CREATE VIEW ${schema}.table_info AS
SELECT 
    schemaname,
    tablename as table_name,
    tableowner as owner,
    hasindexes as has_indexes,
    hasrules as has_rules,
    hastriggers as has_triggers,
    rowsecurity as has_rls
FROM pg_tables 
WHERE schemaname = '${schema}'
ORDER BY tablename;

GRANT SELECT ON ${schema}.table_info TO authenticated;
GRANT SELECT ON ${schema}.table_info TO ${anonRole};

`;
  }

  /**
   * Generate column information view
   */
  private async generateColumnInfoView(): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    const anonRole = postgrestConfig.dbAnonRole;
    
    return `-- Column information overview
CREATE VIEW ${schema}.column_info AS
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = '${schema}'
ORDER BY table_name, ordinal_position;

GRANT SELECT ON ${schema}.column_info TO authenticated;
GRANT SELECT ON ${schema}.column_info TO ${anonRole};

`;
  }

  /**
   * Generate relationship overview view
   */
  private async generateRelationshipView(): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    const anonRole = postgrestConfig.dbAnonRole;
    
    return `-- Table relationships overview
CREATE VIEW ${schema}.table_relationships AS
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
WHERE tc.table_schema = '${schema}' 
  AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE', 'PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_type;

GRANT SELECT ON ${schema}.table_relationships TO authenticated;
GRANT SELECT ON ${schema}.table_relationships TO ${anonRole};

`;
  }

  /**
   * Generate user activity view
   */
  private async generateUserActivityView(tables: string[]): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    const anonRole = postgrestConfig.dbAnonRole;
    
    const userTables = tables.filter(t => t !== 'users');
    
    if (userTables.length === 0) return '';
    
    return `-- User activity summary
CREATE VIEW ${schema}.user_activity AS
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_since,
    ${userTables.map(table => 
      `COALESCE(${table}_stats.count, 0) as ${table}_count`
    ).join(',\n    ')},
    ${userTables.map(table => 
      `${table}_stats.latest as latest_${table}`
    ).join(',\n    ')}
FROM ${schema}.users u
${userTables.map(table => `
LEFT JOIN (
    SELECT 
        user_id, 
        COUNT(*) as count, 
        MAX(created_at) as latest
    FROM ${schema}.${table} 
    WHERE user_id IS NOT NULL 
    GROUP BY user_id
) ${table}_stats ON u.id = ${table}_stats.user_id`).join('')}
ORDER BY u.created_at DESC;

GRANT SELECT ON ${schema}.user_activity TO authenticated;

`;
  }

  /**
   * Generate table size monitoring view
   */
  private async generateTableSizeView(): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    
    return `-- Table size monitoring
CREATE VIEW ${schema}.table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = '${schema}'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

GRANT SELECT ON ${schema}.table_sizes TO authenticated;

`;
  }

  /**
   * Generate refresh function for materialized views
   */
  private async generateMaterializedViewRefreshFunction(viewName: string): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    
    return `-- Refresh function for materialized view ${viewName}
CREATE OR REPLACE FUNCTION ${schema}.refresh_${viewName}()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW ${schema}.${viewName};
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ${schema}.refresh_${viewName}() TO authenticated;

-- Create trigger to refresh on schedule (optional)
-- You can set up pg_cron or similar to call this function periodically

`;
  }

  /**
   * Generate view update/replacement SQL
   */
  async generateViewUpdate(config: ViewConfig, dropFirst: boolean = false, connection?: DatabaseConnection): Promise<string> {
    let sql = '';
    const postgrestConfig = await getPostgRESTConfig(connection);
    
    if (dropFirst) {
      sql += `-- Drop existing view\n`;
      if (config.materialized) {
        sql += `DROP MATERIALIZED VIEW IF EXISTS ${postgrestConfig.schema}.${config.name};\n\n`;
      } else {
        sql += `DROP VIEW IF EXISTS ${postgrestConfig.schema}.${config.name};\n\n`;
      }
    } else {
      sql += `-- Replace existing view\n`;
      if (config.materialized) {
        sql += `DROP MATERIALIZED VIEW IF EXISTS ${postgrestConfig.schema}.${config.name};\n`;
      } else {
        sql += `CREATE OR REPLACE VIEW ${postgrestConfig.schema}.${config.name} AS\n`;
        // For CREATE OR REPLACE, we need to handle the query part differently
        const viewSQL = await this.generateView(config);
        return sql + viewSQL.split('CREATE VIEW')[1];
      }
    }
    
    sql += await this.generateView(config);
    return sql;
  }
}