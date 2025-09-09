/**
 * @fileoverview PostgreSQL triggers for PostgREST
 * 
 * Generates database triggers for common patterns like
 * timestamp updates, audit logging, and data validation.
 * Enhanced with intelligent database analysis and trigger recommendations.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { SchemaInspector, TableColumn } from '../../../generators/SchemaInspector.js';
import { FunctionGenerator } from '../../../generators/FunctionGenerator.js';
import { writeTableSQL, SQL_FILE_TYPES, appendWithTimestamp, getCommandString } from '../../../utils/sql-structure.js';
import { getHashService } from '../../../utils/hash-service.js';

/**
 * Create triggers command
 */
export function createTriggersCommand(): Command {
  const command = new Command('triggers');
  
  command
    .description('Generate PostgreSQL triggers (Enhanced with intelligent analysis)')
    .addCommand(createAddTriggerCommand())
    .addCommand(createSuggestTriggersCommand())
    .addCommand(createAnalyzeTriggersCommand());
  
  return command;
}

/**
 * Create add trigger command
 */
function createAddTriggerCommand(): Command {
  const command = new Command('add');
  
  command
    .description('Add trigger to table (with intelligent analysis)')
    .argument('<table>', 'Table name')
    .option('--schema <name>', 'Schema name')
    .option('--type <type>', 'Trigger type (timestamp|audit|validation|security)')
    .option('--dynamic', 'Use dynamic analysis from database')
    .option('--all-tables', 'Add triggers to all tables')
    .action(async (tableName, options) => {
      await addTrigger(tableName, options);
    });
  
  return command;
}

/**
 * Add trigger to table (Enhanced with dynamic analysis)
 */
async function addTrigger(tableName: string, options: any) {
  logger.info(chalk.cyan(`⚡ Adding Trigger to ${tableName}`));
  logger.newLine();
  
  if (options.allTables) {
    await addTriggersToAllTables(options);
    return;
  }
  
  let sql: string;
  
  if (options.dynamic) {
    // Use dynamic analysis
    sql = await generateIntelligentTrigger(tableName, options);
  } else {
    // Use template-based generation
    sql = await generateTemplateTrigger(tableName, options);
  }
  
  // Use table-folder structure
  const projectPath = process.cwd();
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(sql, command);
  
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.TRIGGERS, timestampedSQL, true);
  
  logger.success(`✅ Trigger generated in: sql/schemas/${tableName}/triggers.sql`);
  displayTriggerUsage(tableName, { ...options, tableName });
}

/**
 * Generate trigger SQL
 */
function generateTriggerSQL(tableName: string, schema: string, triggerType: string): string {
  switch (triggerType) {
    case 'timestamp':
      return generateTimestampTrigger(tableName, schema);
    case 'audit':
      return generateAuditTrigger(tableName, schema);
    case 'validation':
      return generateValidationTrigger(tableName, schema);
    default:
      return generateBasicTrigger(tableName, schema);
  }
}

/**
 * Generate timestamp update trigger
 */
function generateTimestampTrigger(tableName: string, schema: string): string {
  return `-- Timestamp update trigger for ${tableName}
CREATE OR REPLACE FUNCTION ${schema}.update_timestamp_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_${tableName}_timestamp
  BEFORE UPDATE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.update_timestamp_${tableName}();`;
}

/**
 * Generate audit trigger
 */
function generateAuditTrigger(tableName: string, schema: string): string {
  return `-- Audit trigger for ${tableName}
-- First create audit table
CREATE TABLE IF NOT EXISTS ${schema}.${tableName}_audit (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL DEFAULT '${tableName}',
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit function
CREATE OR REPLACE FUNCTION ${schema}.audit_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ${schema}.${tableName}_audit (
    operation,
    old_data,
    new_data,
    user_id
  )
  VALUES (
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    COALESCE(
      (current_setting('request.jwt.claims', true)::json->>'sub')::UUID,
      NULL
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER audit_${tableName}_insert_update_delete
  AFTER INSERT OR UPDATE OR DELETE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.audit_${tableName}();`;
}

/**
 * Generate validation trigger
 */
function generateValidationTrigger(tableName: string, schema: string): string {
  return `-- Validation trigger for ${tableName}
CREATE OR REPLACE FUNCTION ${schema}.validate_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  -- Add your validation logic here
  -- Example: Validate email format
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  
  -- Example: Ensure non-negative values
  IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
    RAISE EXCEPTION 'Amount cannot be negative: %', NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_${tableName}_before_insert_update
  BEFORE INSERT OR UPDATE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.validate_${tableName}();`;
}

/**
 * Generate intelligent trigger based on table analysis
 */
async function generateIntelligentTrigger(tableName: string, options: any): Promise<string> {
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Using template generation.');
      return await generateTemplateTrigger(tableName, options);
    }
    
    logger.info(chalk.blue('🔍 Analyzing table structure...'));
    const columns = await inspector.analyzeTable(tableName, connection);
    
    // Analyze what triggers this table needs
    const suggestions = analyzeTableForTriggers(tableName, columns);
    
    if (suggestions.length === 0) {
      logger.info('No intelligent trigger suggestions for this table.');
      return await generateTemplateTrigger(tableName, options);
    }
    
    logger.success(`✅ Found ${suggestions.length} trigger recommendations`);
    logger.newLine();
    
    // Display suggestions
    logger.info(chalk.cyan('📋 Recommended Triggers:'));
    suggestions.forEach((suggestion, index) => {
      logger.info(`${index + 1}. ${chalk.green(suggestion.name)} - ${suggestion.description}`);
    });
    logger.newLine();
    
    // Ask user which triggers to generate
    const { selectedTriggers } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedTriggers',
      message: 'Select triggers to generate:',
      choices: suggestions.map((suggestion, index) => ({
        name: `${suggestion.name} - ${suggestion.description}`,
        value: index
      }))
    }]);
    
    if (selectedTriggers.length === 0) {
      logger.info('No triggers selected.');
      return await generateTemplateTrigger(tableName, options);
    }
    
    // Generate selected triggers
    let allSQL = `-- Intelligent triggers for ${tableName}\n`;
    allSQL += `-- Generated based on table analysis\n`;
    allSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    for (const index of selectedTriggers) {
      const suggestion = suggestions[index];
      const triggerSQL = await generateSpecificTrigger(tableName, options.schema, suggestion, columns);
      allSQL += triggerSQL + '\n\n';
      logger.success(`✅ Generated trigger: ${suggestion.name}`);
    }
    
    return allSQL;
    
  } catch (error) {
    logger.warn(`⚠️  Dynamic analysis failed: ${error.message}`);
    logger.info('Falling back to template generation...');
    return await generateTemplateTrigger(tableName, options);
  }
}

/**
 * Generate template-based trigger
 */
async function generateTemplateTrigger(tableName: string, options: any): Promise<string> {
  let triggerType = options.type;
  
  if (!triggerType) {
    const { selectedType } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedType',
      message: 'Select trigger type:',
      choices: [
        { name: 'Timestamp Update - Auto-update updated_at column', value: 'timestamp' },
        { name: 'Audit Log - Track all changes', value: 'audit' },
        { name: 'Data Validation - Custom validation logic', value: 'validation' },
        { name: 'Security - Access control and logging', value: 'security' },
        { name: 'Custom - Basic template', value: 'custom' }
      ]
    }]);
    triggerType = selectedType;
  }
  
  const sql = generateTriggerSQL(tableName, options.schema, triggerType);
  return `-- Template trigger for ${tableName}\n-- Generated on ${new Date().toISOString()}\n\n${sql}`;
}

/**
 * Analyze table structure and suggest appropriate triggers
 */
function analyzeTableForTriggers(tableName: string, columns: TableColumn[]): TriggerSuggestion[] {
  const suggestions: TriggerSuggestion[] = [];
  
  // Check for updated_at column (timestamp trigger)
  if (columns.some(col => col.name === 'updated_at' && col.type.includes('TIMESTAMP'))) {
    suggestions.push({
      name: 'auto_update_timestamp',
      type: 'timestamp',
      description: 'Automatically update updated_at column on record changes',
      reason: 'Found updated_at timestamp column'
    });
  }
  
  // Check for created_at + updated_at (both timestamp columns)
  const hasCreatedAt = columns.some(col => col.name === 'created_at');
  const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
  
  if (hasCreatedAt && hasUpdatedAt) {
    suggestions.push({
      name: 'timestamp_management',
      type: 'timestamp_full',
      description: 'Manage both created_at and updated_at timestamps',
      reason: 'Found both created_at and updated_at columns'
    });
  }
  
  // Check for audit requirements (has user_id or sensitive data)
  const hasUserId = columns.some(col => col.name === 'user_id');
  const hasSensitiveColumns = columns.some(col => 
    ['password', 'email', 'phone', 'ssn', 'credit_card'].some(sensitive => 
      col.name.toLowerCase().includes(sensitive)
    )
  );
  
  if (hasUserId || hasSensitiveColumns || tableName.includes('user') || tableName.includes('account')) {
    suggestions.push({
      name: 'audit_trail',
      type: 'audit',
      description: 'Track all changes for compliance and security',
      reason: hasSensitiveColumns ? 'Contains sensitive data' : 'User-related table'
    });
  }
  
  // Check for validation requirements
  const emailColumns = columns.filter(col => col.name.toLowerCase().includes('email'));
  const phoneColumns = columns.filter(col => col.name.toLowerCase().includes('phone'));
  const amountColumns = columns.filter(col => 
    ['amount', 'price', 'cost', 'balance'].some(money => col.name.toLowerCase().includes(money))
  );
  
  if (emailColumns.length > 0 || phoneColumns.length > 0 || amountColumns.length > 0) {
    suggestions.push({
      name: 'data_validation',
      type: 'validation',
      description: 'Validate data format and constraints',
      reason: `Found validation-sensitive columns: ${[
        ...emailColumns.map(c => c.name),
        ...phoneColumns.map(c => c.name),
        ...amountColumns.map(c => c.name)
      ].join(', ')}`
    });
  }
  
  // Check for security requirements (admin tables, sensitive operations)
  if (tableName.includes('admin') || tableName.includes('config') || tableName.includes('setting')) {
    suggestions.push({
      name: 'security_log',
      type: 'security',
      description: 'Log access and modifications for security monitoring',
      reason: 'Administrative/configuration table'
    });
  }
  
  // Check for soft delete pattern
  const hasDeletedAt = columns.some(col => col.name === 'deleted_at');
  if (hasDeletedAt) {
    suggestions.push({
      name: 'soft_delete_protection',
      type: 'soft_delete',
      description: 'Prevent hard deletes and manage soft delete timestamps',
      reason: 'Found deleted_at column (soft delete pattern)'
    });
  }
  
  return suggestions;
}

/**
 * Generate specific trigger based on suggestion
 */
async function generateSpecificTrigger(
  tableName: string, 
  schema: string, 
  suggestion: TriggerSuggestion, 
  columns: TableColumn[]
): Promise<string> {
  switch (suggestion.type) {
    case 'timestamp':
      return generateTimestampTrigger(tableName, schema);
    case 'timestamp_full':
      return generateFullTimestampTrigger(tableName, schema);
    case 'audit':
      return generateEnhancedAuditTrigger(tableName, schema);
    case 'validation':
      return generateIntelligentValidationTrigger(tableName, schema, columns);
    case 'security':
      return generateSecurityTrigger(tableName, schema);
    case 'soft_delete':
      return generateSoftDeleteTrigger(tableName, schema);
    default:
      return generateBasicTrigger(tableName, schema);
  }
}

/**
 * Generate full timestamp management trigger
 */
function generateFullTimestampTrigger(tableName: string, schema: string): string {
  return `-- Full timestamp management trigger for ${tableName}
CREATE OR REPLACE FUNCTION ${schema}.manage_timestamps_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  -- Set created_at on INSERT
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = COALESCE(NEW.created_at, NOW());
    NEW.updated_at = NEW.created_at;
  END IF;
  
  -- Set updated_at on UPDATE
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at = OLD.created_at; -- Preserve original created_at
    NEW.updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manage_${tableName}_timestamps
  BEFORE INSERT OR UPDATE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.manage_timestamps_${tableName}();`;
}

/**
 * Generate enhanced audit trigger
 */
function generateEnhancedAuditTrigger(tableName: string, schema: string): string {
  return `-- Enhanced audit trigger for ${tableName}
-- Create audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS utils.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID,
  user_id UUID,
  user_ip INET,
  old_data JSONB,
  new_data JSONB,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation 
  ON utils.audit_log (table_name, operation, created_at DESC);

-- Enhanced audit function
CREATE OR REPLACE FUNCTION ${schema}.audit_${tableName}()
RETURNS TRIGGER AS $$
DECLARE
  record_id_val UUID;
  changes_json JSONB := '{}'::JSONB;
  col_name TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  -- Extract record ID (assumes UUID primary key named 'id')
  record_id_val := COALESCE(NEW.id, OLD.id);
  
  -- Calculate changes for UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    FOR col_name IN SELECT column_name FROM information_schema.columns 
                    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME LOOP
      EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', col_name, col_name) 
      INTO old_val, new_val USING OLD, NEW;
      
      IF old_val IS DISTINCT FROM new_val THEN
        changes_json := changes_json || jsonb_build_object(col_name, 
          jsonb_build_object('from', old_val, 'to', new_val));
      END IF;
    END LOOP;
  END IF;
  
  -- Insert audit record
  INSERT INTO utils.audit_log (
    table_name, operation, record_id, user_id, user_ip,
    old_data, new_data, changes
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    record_id_val,
    (current_setting('request.jwt.claims', true)::json->>'sub')::UUID,
    inet_client_addr(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN changes_json ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit trigger
CREATE TRIGGER audit_${tableName}_changes
  AFTER INSERT OR UPDATE OR DELETE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.audit_${tableName}();`;
}

/**
 * Generate intelligent validation trigger based on columns
 */
function generateIntelligentValidationTrigger(tableName: string, schema: string, columns: TableColumn[]): string {
  const validations: string[] = [];
  
  // Email validation
  const emailColumns = columns.filter(col => col.name.toLowerCase().includes('email'));
  emailColumns.forEach(col => {
    validations.push(`
  -- Validate ${col.name} format
  IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format in ${col.name}: %', NEW.${col.name};
  END IF;`);
  });
  
  // Phone validation
  const phoneColumns = columns.filter(col => col.name.toLowerCase().includes('phone'));
  phoneColumns.forEach(col => {
    validations.push(`
  -- Validate ${col.name} format
  IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} !~ '^[+]?[0-9\\s\\-\\(\\)]+$' THEN
    RAISE EXCEPTION 'Invalid phone format in ${col.name}: %', NEW.${col.name};
  END IF;`);
  });
  
  // Amount/price validation
  const amountColumns = columns.filter(col => 
    ['amount', 'price', 'cost', 'balance', 'salary', 'fee'].some(money => 
      col.name.toLowerCase().includes(money)
    )
  );
  amountColumns.forEach(col => {
    validations.push(`
  -- Validate ${col.name} is non-negative
  IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} < 0 THEN
    RAISE EXCEPTION 'Amount cannot be negative in ${col.name}: %', NEW.${col.name};
  END IF;`);
  });
  
  // URL validation
  const urlColumns = columns.filter(col => 
    ['url', 'website', 'link', 'homepage'].some(url => col.name.toLowerCase().includes(url))
  );
  urlColumns.forEach(col => {
    validations.push(`
  -- Validate ${col.name} format
  IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} !~ '^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' THEN
    RAISE EXCEPTION 'Invalid URL format in ${col.name}: %', NEW.${col.name};
  END IF;`);
  });
  
  // Default validation if no specific columns found
  if (validations.length === 0) {
    validations.push(`
  -- Add your custom validation logic here
  -- Example validations:
  -- IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN
  --   RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  -- END IF;`);
  }
  
  return `-- Intelligent validation trigger for ${tableName}
-- Based on detected column patterns
CREATE OR REPLACE FUNCTION ${schema}.validate_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  ${validations.join('\n  ')}
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_${tableName}_data
  BEFORE INSERT OR UPDATE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.validate_${tableName}();`;
}

/**
 * Generate security monitoring trigger
 */
function generateSecurityTrigger(tableName: string, schema: string): string {
  return `-- Security monitoring trigger for ${tableName}
-- Create security log table
CREATE TABLE IF NOT EXISTS utils.security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  user_role TEXT,
  user_ip INET,
  user_agent TEXT,
  record_id UUID,
  risk_level TEXT DEFAULT 'LOW',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_log_table_risk
  ON utils.security_log (table_name, risk_level, created_at DESC);

CREATE OR REPLACE FUNCTION ${schema}.security_monitor_${tableName}()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  risk_level TEXT := 'LOW';
  details JSONB := '{}'::JSONB;
BEGIN
  -- Get current user info
  current_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
  current_user_role := current_setting('request.jwt.claims', true)::json->>'role';
  
  -- Determine risk level
  IF TG_OP = 'DELETE' THEN
    risk_level := 'HIGH';
    details := details || '{"reason": "Delete operation on sensitive table"}';
  ELSIF TG_OP = 'UPDATE' AND current_user_role != 'admin' THEN
    risk_level := 'MEDIUM';
    details := details || '{"reason": "Non-admin modification"}';
  END IF;
  
  -- Log security event
  INSERT INTO utils.security_log (
    table_name, operation, user_id, user_role, user_ip,
    record_id, risk_level, details
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    current_user_id,
    current_user_role,
    inet_client_addr(),
    COALESCE(NEW.id, OLD.id),
    risk_level,
    details
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER security_monitor_${tableName}_ops
  AFTER INSERT OR UPDATE OR DELETE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.security_monitor_${tableName}();`;
}

/**
 * Generate soft delete protection trigger
 */
function generateSoftDeleteTrigger(tableName: string, schema: string): string {
  return `-- Soft delete protection trigger for ${tableName}
CREATE OR REPLACE FUNCTION ${schema}.protect_soft_delete_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent hard deletes, convert to soft delete
  IF TG_OP = 'DELETE' THEN
    UPDATE ${schema}.${tableName} 
    SET deleted_at = NOW()
    WHERE id = OLD.id AND deleted_at IS NULL;
    
    -- Return NULL to cancel the actual DELETE
    RETURN NULL;
  END IF;
  
  -- Handle soft delete on UPDATE
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.deleted_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace DELETE operations with soft deletes
CREATE TRIGGER soft_delete_${tableName}_protection
  BEFORE DELETE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.protect_soft_delete_${tableName}();

-- Manage soft delete timestamps
CREATE TRIGGER soft_delete_${tableName}_timestamps
  BEFORE UPDATE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.protect_soft_delete_${tableName}();`;
}

/**
 * Add triggers to all tables
 */
async function addTriggersToAllTables(options: any) {
  logger.info(chalk.cyan('⚡ Adding triggers to all tables'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('Database connection required for --all-tables option');
      return;
    }
    
    const tableNames = await inspector.getTableNames(connection);
    
    if (tableNames.length === 0) {
      logger.warn('No tables found in the schema');
      return;
    }
    
    logger.info(`Found ${tableNames.length} tables: ${tableNames.join(', ')}`);
    logger.newLine();
    
    // Ask what type of triggers to add
    const { triggerTypes } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'triggerTypes',
      message: 'Select trigger types to add to all tables:',
      choices: [
        { name: 'Timestamp management (updated_at)', value: 'timestamp' },
        { name: 'Audit logging', value: 'audit' },
        { name: 'Data validation', value: 'validation' },
        { name: 'Security monitoring', value: 'security' }
      ]
    }]);
    
    if (triggerTypes.length === 0) {
      logger.info('No trigger types selected.');
      return;
    }
    
    const projectPath = process.cwd();
    const command = getCommandString();
    
    // Generate utility functions first if audit triggers are included
    if (triggerTypes.includes('audit')) {
      const functionGenerator = new FunctionGenerator(process.cwd());
      const functionsSQL = functionGenerator.generateUtilityFunctions();
      await fs.ensureDir(`${projectPath}/sql/functions`);
      const auditUtilsPath = `${projectPath}/sql/functions/audit_utilities.sql`;
      await fs.writeFile(auditUtilsPath, functionsSQL);
      
      // Track the file write in hash service
      const hashService = getHashService(projectPath);
      await hashService.trackFileWrite(auditUtilsPath, functionsSQL);
      
      logger.success('✅ Audit utility functions created in: sql/functions/audit_utilities.sql');
    }
    
    for (const tableName of tableNames) {
      try {
        const columns = await inspector.analyzeTable(tableName, connection);
        
        let tableSQL = `-- Bulk triggers for ${tableName}\n`;
        tableSQL += `-- Trigger types: ${triggerTypes.join(', ')}\n`;
        tableSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
        
        for (const triggerType of triggerTypes) {
          const suggestion: TriggerSuggestion = {
            name: `${triggerType}_${tableName}`,
            type: triggerType,
            description: `${triggerType} trigger for ${tableName}`,
            reason: 'Bulk generation'
          };
          
          const triggerSQL = await generateSpecificTrigger(tableName, options.schema, suggestion, columns);
          tableSQL += triggerSQL + '\n\n';
        }
        
        const timestampedSQL = appendWithTimestamp(tableSQL, command);
        await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.TRIGGERS, timestampedSQL, true);
        
        logger.success(`✅ Generated triggers for ${tableName} in sql/schemas/${tableName}/triggers.sql`);
      } catch (error) {
        logger.warn(`⚠️  Skipped ${tableName}: ${error.message}`);
      }
    }
    
    logger.success(`💾 All triggers saved to their respective table folders`);
    
  } catch (error) {
    logger.error(`❌ Failed to generate bulk triggers: ${error.message}`);
  }
}

/**
 * Create suggest triggers command (NEW)
 */
function createSuggestTriggersCommand(): Command {
  const command = new Command('suggest');
  
  command
    .description('Analyze schema and suggest useful triggers')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await suggestTriggers(options);
    });
  
  return command;
}

/**
 * Suggest triggers based on schema analysis
 */
async function suggestTriggers(options: any) {
  logger.info(chalk.cyan('🔍 Analyzing database schema for trigger suggestions...'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Please configure your database connection.');
      return;
    }
    
    const analysis = await inspector.analyzeSchema(connection);
    const allSuggestions = new Map<string, TriggerSuggestion[]>();
    
    // Analyze each table for trigger suggestions
    for (const [tableName, columns] of Object.entries(analysis.tables)) {
      const suggestions = analyzeTableForTriggers(tableName, columns);
      if (suggestions.length > 0) {
        allSuggestions.set(tableName, suggestions);
      }
    }
    
    if (allSuggestions.size === 0) {
      logger.warn('No trigger suggestions found based on current schema analysis.');
      return;
    }
    
    const totalSuggestions = Array.from(allSuggestions.values()).reduce((sum, arr) => sum + arr.length, 0);
    logger.success(`✅ Found ${totalSuggestions} trigger suggestions across ${allSuggestions.size} tables`);
    logger.newLine();
    
    // Display suggestions by table
    for (const [tableName, suggestions] of allSuggestions) {
      logger.info(chalk.cyan(`📋 ${tableName}:`));
      suggestions.forEach((suggestion, index) => {
        logger.info(`  ${index + 1}. ${chalk.green(suggestion.name)} - ${suggestion.description}`);
        logger.info(`     Reason: ${chalk.gray(suggestion.reason)}`);
      });
      logger.newLine();
    }
    
    // Ask user which suggestions to implement
    const { generateSuggestions } = await inquirer.prompt([{
      type: 'confirm',
      name: 'generateSuggestions',
      message: 'Generate SQL for all suggested triggers?',
      default: true
    }]);
    
    if (!generateSuggestions) {
      logger.info('Trigger suggestions not generated.');
      return;
    }
    
    // Generate all suggested triggers using table-folder structure
    const projectPath = process.cwd();
    const command = getCommandString();
    
    // Add utility functions first if needed
    let needsUtilityFunctions = false;
    for (const suggestions of allSuggestions.values()) {
      if (suggestions.some(s => s.type === 'audit')) {
        needsUtilityFunctions = true;
        break;
      }
    }
    
    if (needsUtilityFunctions) {
      const functionGenerator = new FunctionGenerator(process.cwd());
      const functionsSQL = functionGenerator.generateUtilityFunctions();
      await fs.ensureDir(`${projectPath}/sql/functions`);
      const triggerUtilsPath = `${projectPath}/sql/functions/trigger_utilities.sql`;
      await fs.writeFile(triggerUtilsPath, functionsSQL);
      
      // Track the file write in hash service
      const hashService = getHashService(projectPath);
      await hashService.trackFileWrite(triggerUtilsPath, functionsSQL);
      
      logger.success('✅ Trigger utility functions created in: sql/functions/trigger_utilities.sql');
    }
    
    for (const [tableName, suggestions] of allSuggestions) {
      const columns = analysis.tables[tableName];
      
      let tableSQL = `-- Suggested triggers for ${tableName}\n`;
      tableSQL += `-- Based on intelligent schema analysis\n`;
      tableSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
      
      for (const suggestion of suggestions) {
        const triggerSQL = await generateSpecificTrigger(tableName, options.schema, suggestion, columns);
        tableSQL += triggerSQL + '\n\n';
        logger.success(`✅ Generated trigger: ${suggestion.name}`);
      }
      
      const timestampedSQL = appendWithTimestamp(tableSQL, command);
      await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.TRIGGERS, timestampedSQL, true);
      logger.success(`✅ Triggers saved to: sql/schemas/${tableName}/triggers.sql`);
    }
    
    logger.success(`💾 All ${totalSuggestions} suggested triggers saved to their respective table folders`);
    
    displayBulkTriggerUsage(Array.from(allSuggestions.keys()));
    
  } catch (error) {
    logger.error(`❌ Failed to analyze schema: ${error.message}`);
  }
}

/**
 * Create analyze triggers command (NEW)
 */
function createAnalyzeTriggersCommand(): Command {
  const command = new Command('analyze');
  
  command
    .description('Analyze existing triggers and suggest improvements')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await analyzeTriggers(options);
    });
  
  return command;
}

/**
 * Analyze existing triggers
 */
async function analyzeTriggers(options: any) {
  logger.info(chalk.cyan('🔍 Analyzing existing triggers...'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Please configure your database connection.');
      return;
    }
    
    const analysis = await inspector.analyzeSchema(connection);
    
    // Display current trigger status
    logger.info(chalk.cyan('📊 Current Trigger Status:'));
    logger.info(`🔥 Total triggers: ${analysis.triggers.length}`);
    
    if (analysis.triggers.length > 0) {
      logger.info('Existing triggers:');
      analysis.triggers.forEach(trigger => {
        logger.info(`  • ${trigger}`);
      });
    } else {
      logger.warn('No triggers found in the database.');
    }
    
    logger.newLine();
    
    // Analyze what's missing
    const missingTriggers = new Map<string, TriggerSuggestion[]>();
    
    for (const [tableName, columns] of Object.entries(analysis.tables)) {
      const suggestions = analyzeTableForTriggers(tableName, columns);
      if (suggestions.length > 0) {
        missingTriggers.set(tableName, suggestions);
      }
    }
    
    if (missingTriggers.size > 0) {
      logger.info(chalk.yellow('💡 Recommended Improvements:'));
      
      for (const [tableName, suggestions] of missingTriggers) {
        logger.info(`\n📋 ${chalk.green(tableName)}:`);
        suggestions.forEach(suggestion => {
          logger.info(`  • ${suggestion.name} - ${suggestion.description}`);
          logger.info(`    ${chalk.gray(suggestion.reason)}`);
        });
      }
      
      logger.newLine();
      logger.info(`Run ${chalk.cyan('pgrestify api features triggers suggest')} to generate these triggers.`);
    } else {
      logger.success('✅ No additional triggers recommended based on current schema.');
    }
    
  } catch (error) {
    logger.error(`❌ Failed to analyze triggers: ${error.message}`);
  }
}

/**
 * Generate triggers header
 */
function generateTriggersHeader(): string {
  return `-- PostgreSQL Triggers for PostgREST
-- Generated by PGRestify CLI
-- 
-- Apply these triggers to your database:
-- psql -d your_database -f triggers.sql
--
-- Triggers provide:
-- - Automatic timestamp management
-- - Audit trail for compliance
-- - Data validation and integrity
-- - Security monitoring
-- - Soft delete protection`;
}

/**
 * Display trigger usage instructions
 */
function displayTriggerUsage(tableName: string, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply trigger: pgrestify api migrate (or manually: psql -d your_db -f sql/schemas/${tableName}/triggers.sql)`,
    `Triggers automatically execute on ${tableName} changes`,
    'No additional API calls needed',
    'Triggers work transparently with PostgREST'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Enhanced Tips:'));
  logger.list([
    'Use --dynamic flag for intelligent trigger recommendations',
    'Triggers run inside database transactions',
    'Test triggers thoroughly before production',
    options.dynamic ? 'Generated with database analysis' : 'Consider using --dynamic for smarter triggers'
  ]);
}

/**
 * Display bulk trigger usage
 */
function displayBulkTriggerUsage(tables: string[]) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Generated Triggers Usage:'));
  logger.list([
    `Apply all triggers: pgrestify api migrate`,
    `Triggers created for ${tables.length} tables in their respective folders`,
    'All triggers work automatically with your data'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Your Tables with Triggers:'));
  tables.forEach(table => {
    logger.info(`  • ${table} - Enhanced with intelligent triggers (sql/schemas/${table}/triggers.sql)`);
  });
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Test your triggers with sample data',
    'Monitor trigger performance',
    'Set up log monitoring for audit trails',
    'Document trigger behavior for your team'
  ]);
}

/**
 * Generate basic trigger template
 */
function generateBasicTrigger(tableName: string, schema: string): string {
  return `-- Basic trigger template for ${tableName}
CREATE OR REPLACE FUNCTION ${schema}.trigger_${tableName}()
RETURNS TRIGGER AS $$
BEGIN
  -- Add your trigger logic here
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ${tableName}_trigger
  BEFORE INSERT OR UPDATE ON ${schema}.${tableName}
  FOR EACH ROW EXECUTE FUNCTION ${schema}.trigger_${tableName}();`;
}

// Types
interface TriggerSuggestion {
  name: string;
  type: string;
  description: string;
  reason: string;
}