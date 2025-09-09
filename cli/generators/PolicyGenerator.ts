import chalk from 'chalk';
import { SchemaInspector, DatabaseConnection, TableColumn } from './SchemaInspector.js';
import { POSTGREST_DEFAULTS, getPostgRESTConfig } from '../utils/postgrest-config.js';

export interface PolicyConfig {
  tableName: string;
  columns: TableColumn[];
  accessPattern: 'user_specific' | 'public_read' | 'admin_only' | 'custom';
  userIdColumn?: string;
  publicConditions?: string;
  customPolicies?: string[];
  schema?: string;
  pattern?: string;
  ownerColumn?: string;
  customConditions?: string[];
  enableRLS?: boolean;
  // PostgREST configuration
  anonRole?: string;
  jwtSecret?: string;
  serverHost?: string;
  serverPort?: number;
  preRequest?: string;
  generateSelect?: boolean;
  generateInsert?: boolean;
  generateUpdate?: boolean;
  generateDelete?: boolean;
}

export class PolicyGenerator {
  private schemaInspector: SchemaInspector;

  constructor(private projectPath: string) {
    this.schemaInspector = new SchemaInspector(projectPath);
  }

  /**
   * Analyze table structure from database connection
   */
  async analyzeTable(tableName: string): Promise<TableColumn[]> {
    try {
      const dbConnection = await this.schemaInspector.extractDatabaseConnection();
      
      if (dbConnection) {
        console.log(chalk.blue(`🔍 Connecting to database to analyze table: ${tableName}`));
        const isConnected = await this.schemaInspector.testConnection(dbConnection);
        
        if (isConnected) {
          return await this.schemaInspector.analyzeTable(tableName, dbConnection);
        }
      }
      
      console.log(chalk.yellow('⚠️  Database connection not available'));
      return await this.promptForTableStructure(tableName);
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Database analysis failed: ${error.message}`));
      console.log(chalk.blue('📝 Falling back to manual input...'));
      return await this.promptForTableStructure(tableName);
    }
  }

  /**
   * Generate RLS policies based on table analysis
   */
  async generatePolicies(config: PolicyConfig): Promise<string> {
    const { tableName, columns, accessPattern, userIdColumn } = config;
    
    // Get schema from config or use PostgREST defaults
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config.schema || postgrestConfig.dbSchemas;
    
    let policies = `-- RLS Policies for ${tableName}\n`;
    policies += `-- Generated on ${new Date().toISOString()}\n\n`;
    policies += `ALTER TABLE ${schema}.${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;
    
    // Check if user customized operations - if so, generate per-operation policies
    const hasCustomOperations = config.generateSelect !== undefined || 
                               config.generateInsert !== undefined || 
                               config.generateUpdate !== undefined || 
                               config.generateDelete !== undefined;
    
    if (hasCustomOperations) {
      // Generate individual policies based on user selection
      policies += await this.generateCustomOperationPolicies(config);
    } else {
      // Use default pattern policies
      switch (accessPattern) {
        case 'user_specific':
          policies += await this.generateUserSpecificPolicies(tableName, userIdColumn || 'user_id', columns, config);
          break;
        case 'public_read':
          policies += await this.generatePublicReadPolicies(tableName, config.publicConditions, config);
          break;
        case 'admin_only':
          policies += await this.generateAdminOnlyPolicies(tableName, config);
          break;
        case 'custom':
          policies += config.customPolicies?.join('\n\n') || '-- Custom policies to be added manually\n';
          break;
      }
    }
    
    return policies;
  }

  /**
   * Generate policies for all tables
   */
  async generateAllTablePolicies(): Promise<Record<string, string>> {
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      throw new Error('Database connection required for analyzing all tables');
    }

    const tableNames = await this.schemaInspector.getTableNames(connection);
    const ownershipPatterns = await this.schemaInspector.detectUserOwnershipPatterns(connection);
    const policies: Record<string, string> = {};

    for (const tableName of tableNames) {
      try {
        const columns = await this.schemaInspector.analyzeTable(tableName, connection);
        const userColumn = ownershipPatterns[tableName];
        
        const config: PolicyConfig = {
          tableName,
          columns,
          accessPattern: userColumn ? 'user_specific' : 'public_read',
          userIdColumn: userColumn
        };

        policies[tableName] = await this.generatePolicies(config);
        console.log(chalk.green(`✅ Generated policies for ${tableName}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Skipped ${tableName}: ${error.message}`));
      }
    }

    return policies;
  }

  /**
   * Check existing RLS status
   */
  async checkRLSStatus(): Promise<Record<string, boolean>> {
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      throw new Error('Database connection required for RLS status check');
    }

    return await this.schemaInspector.checkRLSStatus(connection);
  }

  /**
   * Generate user-specific RLS policies
   */
  private async generateUserSpecificPolicies(tableName: string, userIdColumn: string, columns: TableColumn[], config: PolicyConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config.schema || postgrestConfig.dbSchemas;
    const anonRole = config.anonRole || postgrestConfig.dbAnonRole;
    const hasUserColumn = columns.some(col => col.name === userIdColumn);
    
    if (!hasUserColumn) {
      throw new Error(`Table ${tableName} does not have a ${userIdColumn} column. Cannot generate user-specific policies.`);
    }
    
    return `-- User-specific access policies for ${tableName}
-- Users can only access their own records

-- SELECT policy: Users can view their own ${tableName}
CREATE POLICY "${tableName}_select_own" ON ${schema}.${tableName}
    FOR SELECT 
    USING (${userIdColumn} = auth.current_user_id());

-- INSERT policy: Users can insert their own ${tableName}
CREATE POLICY "${tableName}_insert_own" ON ${schema}.${tableName}
    FOR INSERT 
    WITH CHECK (${userIdColumn} = auth.current_user_id());

-- UPDATE policy: Users can update their own ${tableName}
CREATE POLICY "${tableName}_update_own" ON ${schema}.${tableName}
    FOR UPDATE 
    USING (${userIdColumn} = auth.current_user_id())
    WITH CHECK (${userIdColumn} = auth.current_user_id());

-- DELETE policy: Users can delete their own ${tableName}
CREATE POLICY "${tableName}_delete_own" ON ${schema}.${tableName}
    FOR DELETE 
    USING (${userIdColumn} = auth.current_user_id());

-- Admin override: Admins can manage all ${tableName}
CREATE POLICY "${tableName}_admin_all" ON ${schema}.${tableName}
    FOR ALL 
    USING (auth.current_user_role() = 'admin')
    WITH CHECK (auth.current_user_role() = 'admin');

-- Grant permissions
GRANT ALL ON ${schema}.${tableName} TO authenticated;
GRANT SELECT ON ${schema}.${tableName} TO ${anonRole};

`;
  }

  /**
   * Generate public read policies
   */
  private async generatePublicReadPolicies(tableName: string, conditions?: string, config?: PolicyConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config?.schema || postgrestConfig.dbSchemas;
    const anonRole = config?.anonRole || postgrestConfig.dbAnonRole;
    const whereClause = conditions || 'true';
    
    return `-- Public read access policies for ${tableName}
-- Anyone can read, authenticated users can modify

-- SELECT policy: Public read access${conditions ? ` where ${conditions}` : ''}
CREATE POLICY "${tableName}_public_select" ON ${schema}.${tableName}
    FOR SELECT 
    USING (${whereClause});

-- INSERT policy: Only authenticated users can insert
CREATE POLICY "${tableName}_authenticated_insert" ON ${schema}.${tableName}
    FOR INSERT 
    WITH CHECK (auth.current_user_id() IS NOT NULL);

-- UPDATE policy: Only authenticated users can update
CREATE POLICY "${tableName}_authenticated_update" ON ${schema}.${tableName}
    FOR UPDATE 
    USING (auth.current_user_id() IS NOT NULL)
    WITH CHECK (auth.current_user_id() IS NOT NULL);

-- DELETE policy: Only authenticated users can delete
CREATE POLICY "${tableName}_authenticated_delete" ON ${schema}.${tableName}
    FOR DELETE 
    USING (auth.current_user_id() IS NOT NULL);

-- Admin override: Admins can manage all ${tableName}
CREATE POLICY "${tableName}_admin_all" ON ${schema}.${tableName}
    FOR ALL 
    USING (auth.current_user_role() = 'admin')
    WITH CHECK (auth.current_user_role() = 'admin');

-- Grant permissions
GRANT ALL ON ${schema}.${tableName} TO authenticated;
GRANT SELECT ON ${schema}.${tableName} TO ${anonRole};

`;
  }

  /**
   * Generate admin-only policies
   */
  private async generateAdminOnlyPolicies(tableName: string, config?: PolicyConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config?.schema || postgrestConfig.dbSchemas;
    return `-- Admin-only access policies for ${tableName}
-- Only administrators can access this table

-- All operations policy: Admin-only access
CREATE POLICY "${tableName}_admin_only" ON ${schema}.${tableName}
    FOR ALL 
    USING (auth.current_user_role() = 'admin')
    WITH CHECK (auth.current_user_role() = 'admin');

-- Grant permissions (restrictive)
GRANT ALL ON ${schema}.${tableName} TO authenticated;

`;
  }

  /**
   * Generate custom operation-specific policies based on user selection
   */
  private async generateCustomOperationPolicies(config: PolicyConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config.schema || postgrestConfig.dbSchemas;
    const anonRole = config.anonRole || postgrestConfig.dbAnonRole;
    const { tableName, pattern, ownerColumn, customConditions } = config;
    const patternToUse = pattern || 'custom';
    let policies = `-- Custom policies for ${tableName}\n`;
    policies += `-- Pattern: ${patternToUse}, Operations: `;
    
    const operations: string[] = [];
    if (config.generateSelect) operations.push('SELECT');
    if (config.generateInsert) operations.push('INSERT');
    if (config.generateUpdate) operations.push('UPDATE');
    if (config.generateDelete) operations.push('DELETE');
    policies += operations.join(', ') + '\n\n';

    // Generate SELECT policy
    if (config.generateSelect) {
      policies += await this.generateOperationPolicy(tableName, 'SELECT', patternToUse, ownerColumn, customConditions, config);
    }

    // Generate INSERT policy
    if (config.generateInsert) {
      policies += await this.generateOperationPolicy(tableName, 'INSERT', patternToUse, ownerColumn, customConditions, config);
    }

    // Generate UPDATE policy
    if (config.generateUpdate) {
      policies += await this.generateOperationPolicy(tableName, 'UPDATE', patternToUse, ownerColumn, customConditions, config);
    }

    // Generate DELETE policy
    if (config.generateDelete) {
      policies += await this.generateOperationPolicy(tableName, 'DELETE', patternToUse, ownerColumn, customConditions, config);
    }

    // Add grants
    policies += `-- Grant permissions\n`;
    policies += `GRANT SELECT, INSERT, UPDATE, DELETE ON ${schema}.${tableName} TO authenticated;\n`;
    if (pattern === 'public_read' || config.generateSelect) {
      policies += `GRANT SELECT ON ${schema}.${tableName} TO ${anonRole};\n`;
    }
    policies += '\n';

    return policies;
  }

  /**
   * Generate a policy for a specific operation
   */
  private async generateOperationPolicy(
    tableName: string, 
    operation: string, 
    pattern: string, 
    ownerColumn?: string, 
    customConditions?: string[],
    config?: PolicyConfig
  ): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const schema = config?.schema || postgrestConfig.dbSchemas;
    const opLower = operation.toLowerCase();
    let policy = '';

    switch (pattern) {
      case 'admin_only':
        policy += `-- ${operation} policy: Admin-only access\n`;
        policy += `CREATE POLICY "${tableName}_${opLower}_admin_only" ON ${schema}.${tableName}\n`;
        policy += `    FOR ${operation}\n`;
        policy += `    USING (auth.current_user_role() = 'admin')`;
        if (operation === 'INSERT' || operation === 'UPDATE') {
          policy += `\n    WITH CHECK (auth.current_user_role() = 'admin')`;
        }
        policy += ';\n\n';
        break;

      case 'user_specific':
        const ownerCol = ownerColumn || 'user_id';
        policy += `-- ${operation} policy: User-specific access\n`;
        policy += `CREATE POLICY "${tableName}_${opLower}_user_specific" ON ${schema}.${tableName}\n`;
        policy += `    FOR ${operation}\n`;
        
        if (operation === 'INSERT') {
          policy += `    WITH CHECK (${ownerCol} = auth.current_user_id())`;
        } else {
          policy += `    USING (${ownerCol} = auth.current_user_id())`;
          if (operation === 'UPDATE') {
            policy += `\n    WITH CHECK (${ownerCol} = auth.current_user_id())`;
          }
        }
        policy += ';\n\n';
        break;

      case 'public_read':
        if (operation === 'SELECT') {
          policy += `-- ${operation} policy: Public read access\n`;
          policy += `CREATE POLICY "${tableName}_${opLower}_public" ON ${schema}.${tableName}\n`;
          policy += `    FOR ${operation}\n`;
          policy += `    USING (true);\n\n`;
        } else {
          const ownerCol = ownerColumn || 'user_id';
          policy += `-- ${operation} policy: Owner-only access\n`;
          policy += `CREATE POLICY "${tableName}_${opLower}_owner" ON ${schema}.${tableName}\n`;
          policy += `    FOR ${operation}\n`;
          
          if (operation === 'INSERT') {
            policy += `    WITH CHECK (${ownerCol} = auth.current_user_id())`;
          } else {
            policy += `    USING (${ownerCol} = auth.current_user_id())`;
            if (operation === 'UPDATE') {
              policy += `\n    WITH CHECK (${ownerCol} = auth.current_user_id())`;
            }
          }
          policy += ';\n\n';
        }
        break;

      case 'custom':
        policy += `-- ${operation} policy: Custom conditions\n`;
        policy += `CREATE POLICY "${tableName}_${opLower}_custom" ON ${schema}.${tableName}\n`;
        policy += `    FOR ${operation}\n`;
        if (customConditions && customConditions.length > 0) {
          policy += `    USING (${customConditions.join(' AND ')})`;
          if (operation === 'INSERT' || operation === 'UPDATE') {
            policy += `\n    WITH CHECK (${customConditions.join(' AND ')})`;
          }
        } else {
          policy += `    USING (true) -- TODO: Add custom conditions`;
          if (operation === 'INSERT' || operation === 'UPDATE') {
            policy += `\n    WITH CHECK (true) -- TODO: Add custom conditions`;
          }
        }
        policy += ';\n\n';
        break;
    }

    return policy;
  }

  /**
   * Prompt user for table structure if database analysis fails
   */
  private async promptForTableStructure(tableName: string): Promise<TableColumn[]> {
    const inquirer = await import('inquirer');
    
    console.log(chalk.blue(`\n📝 Please provide table structure for: ${tableName}`));
    console.log(chalk.gray('Enter column information manually:\n'));
    
    const columns: TableColumn[] = [];
    let addMore = true;
    
    while (addMore) {
      const columnInfo = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Column name:',
          validate: (input: string) => input.trim() !== '' || 'Column name is required'
        },
        {
          type: 'list',
          name: 'type',
          message: 'Column type:',
          choices: [
            'UUID', 'SERIAL', 'INTEGER', 'BIGINT', 'TEXT', 'VARCHAR', 
            'BOOLEAN', 'TIMESTAMPTZ', 'DATE', 'JSONB', 'DECIMAL'
          ]
        },
        {
          type: 'confirm',
          name: 'nullable',
          message: 'Is nullable?',
          default: true
        },
        {
          type: 'confirm',
          name: 'isPrimaryKey',
          message: 'Is primary key?',
          default: false
        },
        {
          type: 'confirm',
          name: 'isForeignKey',
          message: 'Is foreign key?',
          default: false
        }
      ]);
      
      if (columnInfo.isForeignKey) {
        const fkInfo = await inquirer.default.prompt([
          {
            type: 'input',
            name: 'referencedTable',
            message: 'Referenced table:',
            validate: (input: string) => input.trim() !== '' || 'Referenced table is required'
          },
          {
            type: 'input',
            name: 'referencedColumn',
            message: 'Referenced column:',
            default: 'id'
          }
        ]);
        
        columnInfo.referencedTable = fkInfo.referencedTable;
        columnInfo.referencedColumn = fkInfo.referencedColumn;
      }
      
      columns.push({
        ...columnInfo,
        isUnique: false
      });
      
      const continuePrompt = await inquirer.default.prompt([{
        type: 'confirm',
        name: 'addMore',
        message: 'Add another column?',
        default: false
      }]);
      
      addMore = continuePrompt.addMore;
    }
    
    // Show summary
    console.log(chalk.blue('\n📋 Table Structure Summary:'));
    console.table(columns.map(col => ({
      Column: col.name,
      Type: col.type,
      Nullable: col.nullable ? 'YES' : 'NO',
      'Primary Key': col.isPrimaryKey ? 'YES' : 'NO',
      'Foreign Key': col.isForeignKey ? `${col.referencedTable}.${col.referencedColumn}` : 'NO'
    })));
    
    return columns;
  }

  /**
   * Generate backup policies before updates
   */
  async generatePolicyBackup(tableName: string): Promise<string> {
    const connection = await this.schemaInspector.extractDatabaseConnection();
    if (!connection) {
      throw new Error('Database connection required for policy backup');
    }

    const postgrestConfig = await getPostgRESTConfig(connection);
    const schema = postgrestConfig.dbSchemas;

    const { Pool } = await import('pg');
    const pool = new Pool(connection);
    
    try {
      const result = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE schemaname = $1 AND tablename = $2
        ORDER BY policyname
      `, [schema, tableName]);

      if (result.rows.length === 0) {
        return `-- No existing policies found for ${tableName}\n`;
      }

      let backup = `-- Policy backup for ${tableName}\n`;
      backup += `-- Generated on ${new Date().toISOString()}\n\n`;
      
      result.rows.forEach(policy => {
        backup += `-- Backup of policy: ${policy.policyname}\n`;
        backup += `/*\n`;
        backup += `CREATE POLICY "${policy.policyname}" ON ${schema}.${tableName}\n`;
        backup += `    FOR ${policy.cmd || 'ALL'}\n`;
        if (policy.qual) backup += `    USING (${policy.qual})\n`;
        if (policy.with_check) backup += `    WITH CHECK (${policy.with_check})\n`;
        backup += `*/\n\n`;
      });

      return backup;
    } finally {
      await pool.end();
    }
  }
}