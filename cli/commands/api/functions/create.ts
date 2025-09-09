/**
 * @fileoverview Create individual PostgREST functions
 * 
 * Interactive function creation with templates for common patterns
 * like authentication, custom endpoints, and business logic.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * Function templates
 */
const FUNCTION_TEMPLATES = {
  auth: {
    name: 'Authentication Function',
    description: 'JWT-based authentication with login/register',
    template: 'auth'
  },
  crud: {
    name: 'CRUD Function',
    description: 'Create, read, update, delete operations',
    template: 'crud'
  },
  search: {
    name: 'Search Function',
    description: 'Full-text search with pagination',
    template: 'search'
  },
  custom: {
    name: 'Custom Function',
    description: 'Business logic function template',
    template: 'custom'
  },
  validation: {
    name: 'Validation Function',
    description: 'Data validation and sanitization',
    template: 'validation'
  }
};

/**
 * Create functions create command
 */
export function createCreateCommand(): Command {
  const command = new Command('create');
  
  command
    .description('Create a PostgREST function')
    .argument('<name>', 'Function name')
    .option('--template <type>', 'Function template (auth|crud|search|custom|validation)')
    .option('--schema <name>', 'Schema name')
    .option('--output <file>', 'Output file')
    .option('--returns <type>', 'Return type', 'JSON')
    .action(async (name, options) => {
      await createFunction(name, options);
    });
  
  return command;
}

/**
 * Create a PostgREST function
 */
async function createFunction(name: string, options: any) {
  logger.info(chalk.cyan(`⚡ Creating PostgREST Function: ${name}`));
  logger.newLine();
  
  const config = await collectFunctionConfig(name, options);
  const sql = await generateFunctionFromTemplate(config);
  
  const outputFile = options.output || `./sql/functions/${name}.sql`;
  await fs.ensureDir(require('path').dirname(outputFile));
  await fs.writeFile(outputFile, sql);
  
  logger.success(`✅ Function created: ${outputFile}`);
  await displayFunctionUsage(config);
}

/**
 * Collect function configuration
 */
async function collectFunctionConfig(name: string, options: any) {
  let template = options.template;
  
  if (!template) {
    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Select function template:',
        choices: Object.entries(FUNCTION_TEMPLATES).map(([key, tmpl]) => ({
          name: `${tmpl.name} - ${tmpl.description}`,
          value: key
        }))
      }
    ]);
    template = selectedTemplate;
  }
  
  // Get template-specific configuration
  const templateConfig = await getTemplateConfig(template);
  
  return {
    name,
    template,
    schema: options.schema,
    returns: options.returns,
    ...templateConfig
  };
}

/**
 * Get template-specific configuration
 */
async function getTemplateConfig(template: string) {
  switch (template) {
    case 'auth':
      return await getAuthConfig();
    case 'crud':
      return await getCrudConfig();
    case 'search':
      return await getSearchConfig();
    case 'validation':
      return await getValidationConfig();
    default:
      return await getCustomConfig();
  }
}

/**
 * Get authentication function config
 */
async function getAuthConfig() {
  const { authType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authType',
      message: 'Authentication type:',
      choices: [
        { name: 'Login (email/password)', value: 'login' },
        { name: 'Register (create account)', value: 'register' },
        { name: 'Refresh token', value: 'refresh' },
        { name: 'Logout', value: 'logout' }
      ]
    }
  ]);
  
  return { authType };
}

/**
 * Get CRUD function config
 */
async function getCrudConfig() {
  const { tableName, operation } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tableName',
      message: 'Target table name:',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    },
    {
      type: 'list',
      name: 'operation',
      message: 'CRUD operation:',
      choices: [
        { name: 'Create (INSERT)', value: 'create' },
        { name: 'Read (SELECT)', value: 'read' },
        { name: 'Update (UPDATE)', value: 'update' },
        { name: 'Delete (DELETE)', value: 'delete' },
        { name: 'Upsert (INSERT ON CONFLICT)', value: 'upsert' }
      ]
    }
  ]);
  
  return { tableName, operation };
}

/**
 * Get search function config
 */
async function getSearchConfig() {
  const { tableName, searchFields } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tableName',
      message: 'Table to search:',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    },
    {
      type: 'input',
      name: 'searchFields',
      message: 'Search fields (comma-separated):',
      default: 'name, description',
      validate: (input) => input.trim().length > 0 || 'Search fields are required'
    }
  ]);
  
  return { 
    tableName, 
    searchFields: searchFields.split(',').map(f => f.trim()) 
  };
}

/**
 * Get validation function config
 */
async function getValidationConfig() {
  const { validationType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'validationType',
      message: 'Validation type:',
      choices: [
        { name: 'Email validation', value: 'email' },
        { name: 'Password strength', value: 'password' },
        { name: 'UUID validation', value: 'uuid' },
        { name: 'Custom validation', value: 'custom' }
      ]
    }
  ]);
  
  return { validationType };
}

/**
 * Get custom function config
 */
async function getCustomConfig() {
  const { parameters } = await inquirer.prompt([
    {
      type: 'input',
      name: 'parameters',
      message: 'Function parameters (e.g., "user_id UUID, email TEXT"):',
      default: ''
    }
  ]);
  
  return { parameters };
}

/**
 * Generate function from template
 */
async function generateFunctionFromTemplate(config: any): Promise<string> {
  const header = generateFunctionHeader(config);
  const body = generateFunctionBody(config);
  const permissions = await generateFunctionPermissions(config);
  
  return `${header}\n\n${body}\n\n${permissions}`;
}

/**
 * Generate function header
 */
function generateFunctionHeader(config: any): string {
  return `-- ${config.name} Function
-- Generated: ${new Date().toISOString()}
-- Template: ${config.template}
-- Schema: ${config.schema}`;
}

/**
 * Generate function body based on template
 */
function generateFunctionBody(config: any): string {
  switch (config.template) {
    case 'auth':
      return generateAuthFunction(config);
    case 'crud':
      return generateCrudFunction(config);
    case 'search':
      return generateSearchFunction(config);
    case 'validation':
      return generateValidationFunction(config);
    default:
      return generateCustomFunction(config);
  }
}

/**
 * Generate authentication function
 */
function generateAuthFunction(config: any): string {
  const { authType } = config;
  
  switch (authType) {
    case 'login':
      return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(
  email TEXT,
  password TEXT
)
RETURNS ${config.returns} AS $$
DECLARE
  user_record RECORD;
  jwt_token TEXT;
BEGIN
  -- Find user and verify password
  SELECT id, email, name, password_hash, role
  INTO user_record
  FROM ${config.schema}.users
  WHERE users.email = ${config.name}.email
    AND users.password_hash = crypt(${config.name}.password, users.password_hash);
  
  IF user_record IS NULL THEN
    RETURN json_build_object('error', 'Invalid credentials');
  END IF;
  
  -- Generate JWT token
  jwt_token := sign(
    json_build_object(
      'sub', user_record.id::TEXT,
      'email', user_record.email,
      'role', COALESCE(user_record.role, 'web_user'),
      'exp', extract(epoch from now() + interval '7 days')
    ),
    current_setting('app.jwt_secret')
  );
  
  RETURN json_build_object(
    'token', jwt_token,
    'user', json_build_object(
      'id', user_record.id,
      'email', user_record.email,
      'name', user_record.name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

    case 'register':
      return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(
  email TEXT,
  password TEXT,
  name TEXT DEFAULT NULL
)
RETURNS ${config.returns} AS $$
DECLARE
  user_id UUID;
  jwt_token TEXT;
BEGIN
  -- Validate email
  IF email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN
    RETURN json_build_object('error', 'Invalid email format');
  END IF;
  
  -- Check if user exists
  IF EXISTS (SELECT 1 FROM ${config.schema}.users WHERE users.email = ${config.name}.email) THEN
    RETURN json_build_object('error', 'User already exists');
  END IF;
  
  -- Create user
  INSERT INTO ${config.schema}.users (email, name, password_hash)
  VALUES (${config.name}.email, ${config.name}.name, crypt(${config.name}.password, gen_salt('bf')))
  RETURNING id INTO user_id;
  
  -- Generate token
  jwt_token := sign(
    json_build_object(
      'sub', user_id::TEXT,
      'email', ${config.name}.email,
      'role', 'web_user',
      'exp', extract(epoch from now() + interval '7 days')
    ),
    current_setting('app.jwt_secret')
  );
  
  RETURN json_build_object(
    'token', jwt_token,
    'user', json_build_object(
      'id', user_id,
      'email', ${config.name}.email,
      'name', ${config.name}.name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

    default:
      return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}()
RETURNS ${config.returns} AS $$
BEGIN
  -- Add your authentication logic here
  RETURN json_build_object('message', 'Authentication function template');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;
  }
}

/**
 * Generate CRUD function
 */
function generateCrudFunction(config: any): string {
  const { tableName, operation } = config;
  
  return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(
  data ${config.returns}
)
RETURNS ${config.returns} AS $$
BEGIN
  -- ${operation.toUpperCase()} operation on ${tableName}
  -- Add your CRUD logic here
  
  RETURN json_build_object(
    'message', '${operation} completed successfully',
    'table', '${tableName}'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;
}

/**
 * Generate search function
 */
function generateSearchFunction(config: any): string {
  const { tableName, searchFields } = config;
  
  return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(
  search_query TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS ${config.returns} AS $$
DECLARE
  result ${config.returns};
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT *
    FROM ${config.schema}.${tableName}
    WHERE (search_query IS NULL OR 
           ${searchFields.map(field => `${field} ILIKE '%' || search_query || '%'`).join(' OR ')})
    ORDER BY created_at DESC
    LIMIT limit_count
    OFFSET offset_count
  ) t;
  
  RETURN COALESCE(result, '[]'::${config.returns});
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;
}

/**
 * Generate validation function
 */
function generateValidationFunction(config: any): string {
  const { validationType } = config;
  
  switch (validationType) {
    case 'email':
      return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
    
    case 'uuid':
      return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(uuid_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM uuid_text::UUID;
  RETURN TRUE;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
    
    default:
      return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(input_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add your validation logic here
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
  }
}

/**
 * Generate custom function
 */
function generateCustomFunction(config: any): string {
  return `CREATE OR REPLACE FUNCTION ${config.schema}.${config.name}(${config.parameters || ''})
RETURNS ${config.returns} AS $$
BEGIN
  -- Add your custom logic here
  
  RETURN json_build_object(
    'message', 'Custom function executed successfully',
    'function', '${config.name}'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;
}

/**
 * Generate function permissions
 */
async function generateFunctionPermissions(config: any): Promise<string> {
  const { generateGrantStatement, getPostgRESTConfig } = await import('../../../utils/postgrest-config.js');
  const postgrestConfig = await getPostgRESTConfig();
  const includeAuthenticated = config.template !== 'auth'; // Auth functions usually only need anon access
  
  return `-- Grant permissions
${generateGrantStatement('EXECUTE', `FUNCTION ${config.schema}.${config.name}`, postgrestConfig, includeAuthenticated)}`;
}

/**
 * Display function usage
 */
async function displayFunctionUsage(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply function: pgrestify api migrate (or manually: psql -d your_db -f sql/functions/${config.name}.sql)`,
    `Call via POST /rpc/${config.name}`,
    'Include parameters in request body as JSON',
    'Add Authorization header for authenticated functions'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('Example:'));
  
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.code(`curl -X POST http://localhost:${serverPort}/rpc/${config.name} \\
  -H "Content-Type: application/json" \\
  -d '{}'`);
}