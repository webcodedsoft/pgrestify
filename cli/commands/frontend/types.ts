/**
 * @fileoverview Types generation command for frontend projects
 * 
 * Generates TypeScript types from PostgREST OpenAPI schema.
 * This is safe for frontend projects as it only reads from public API endpoints.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';

/**
 * Create types generation command
 */
export function createTypesCommand(): Command {
  const command = new Command('types');
  
  command
    .description('Generate TypeScript types from PostgREST schema')
    .option('--api-url <url>', 'PostgREST API URL')
    .option('--output <path>', 'Output file path', './src/types/database.ts')
    .option('--watch', 'Watch for schema changes')
    .action(async (options) => {
      await generateTypes(options);
    });
  
  return command;
}

/**
 * Generate TypeScript types from PostgREST OpenAPI schema
 */
async function generateTypes(options: any) {
  logger.info(chalk.cyan('📝 Generating TypeScript types from PostgREST schema'));
  
  // Get API URL from options, config, or environment
  const apiUrl = options.apiUrl || 
                 process.env.POSTGREST_URL || 
                 process.env.NEXT_PUBLIC_POSTGREST_URL ||
                 process.env.REACT_APP_POSTGREST_URL ||
                 'http://localhost:3000';
  
  try {
    // Fetch OpenAPI schema from PostgREST
    const schemaUrl = `${apiUrl.replace(/\/$/, '')}/`;
    logger.info(`Fetching schema from: ${schemaUrl}`);
    
    const response = await fetch(schemaUrl, {
      headers: {
        'Accept': 'application/openapi+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
    }
    
    const schema = await response.json();
    
    // Generate TypeScript types
    const types = generateTypesFromSchema(schema);
    
    // Ensure output directory exists
    await fs.ensureDir(path.dirname(options.output));
    
    // Write types file
    await fs.writeFile(options.output, types);
    
    logger.success(`✅ Types generated: ${options.output}`);
    
    if (options.watch) {
      logger.info('👀 Watching for schema changes...');
      startWatching(apiUrl, options.output);
    }
    
  } catch (error) {
    logger.error(`Failed to generate types: ${error.message}`);
    
    if (error.message.includes('fetch')) {
      logger.info(chalk.yellow('Make sure your PostgREST server is running and accessible.'));
      logger.info(chalk.gray(`Trying to connect to: ${apiUrl}`));
    }
    
    process.exit(1);
  }
}

/**
 * Generate TypeScript types from OpenAPI schema
 */
function generateTypesFromSchema(schema: any): string {
  const header = `/**
 * Database Types
 * Generated from PostgREST OpenAPI schema
 * 
 * @generated This file is auto-generated. Do not edit manually.
 */

`;

  const types: string[] = [];
  
  // Extract table definitions from OpenAPI paths
  const tables = extractTablesFromSchema(schema);
  
  // Generate table interfaces
  for (const [tableName, tableSchema] of Object.entries(tables)) {
    const interfaceName = toPascalCase(tableName);
    const properties = generateProperties(tableSchema as any);
    
    types.push(`export interface ${interfaceName} {
${properties}
}`);
  }
  
  // Generate Database interface
  const databaseInterface = `export interface Database {
${Object.keys(tables).map(table => `  ${table}: ${toPascalCase(table)};`).join('\n')}
}`;
  
  types.push(databaseInterface);
  
  // Generate utility types
  const utilityTypes = `
// Utility types for common operations
export type InsertData<T extends keyof Database> = Omit<Database[T], 'id' | 'created_at' | 'updated_at'>;
export type UpdateData<T extends keyof Database> = Partial<InsertData<T>>;
export type SelectData<T extends keyof Database> = Database[T];

// Query result types
export type QueryResult<T> = {
  data: T[] | null;
  error: Error | null;
  count?: number;
};

export type SingleResult<T> = {
  data: T | null;
  error: Error | null;
};
`;
  
  types.push(utilityTypes);
  
  return header + types.join('\n\n') + '\n';
}

/**
 * Extract table definitions from OpenAPI schema
 */
function extractTablesFromSchema(schema: any): Record<string, any> {
  const tables: Record<string, any> = {};
  
  // Extract from definitions/components
  const definitions = schema.definitions || schema.components?.schemas || {};
  
  for (const [name, definition] of Object.entries(definitions)) {
    if (typeof definition === 'object' && definition !== null && 'properties' in definition) {
      tables[name] = definition;
    }
  }
  
  return tables;
}

/**
 * Generate TypeScript properties from schema
 */
function generateProperties(schema: any): string {
  if (!schema.properties) return '';
  
  const properties: string[] = [];
  const required = new Set(schema.required || []);
  
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as any;
    const isRequired = required.has(propName);
    const isNullable = prop.nullable || false;
    
    let type = getTypeScriptType(prop);
    
    if (isNullable) {
      type = `${type} | null`;
    }
    
    const optional = !isRequired ? '?' : '';
    const description = prop.description ? `  /** ${prop.description} */\n` : '';
    
    properties.push(`${description}  ${propName}${optional}: ${type};`);
  }
  
  return properties.join('\n');
}

/**
 * Convert OpenAPI type to TypeScript type
 */
function getTypeScriptType(schema: any): string {
  if (schema.enum) {
    return schema.enum.map((v: any) => `'${v}'`).join(' | ');
  }
  
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return 'string'; // ISO date string
      if (schema.format === 'uuid') return 'string';
      return 'string';
    case 'integer':
      return 'number';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      const itemType = schema.items ? getTypeScriptType(schema.items) : 'unknown';
      return `${itemType}[]`;
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Start watching for schema changes
 */
function startWatching(apiUrl: string, outputPath: string) {
  const interval = 5000; // Check every 5 seconds
  let lastHash = '';
  
  const checkChanges = async () => {
    try {
      const response = await fetch(`${apiUrl}/`, {
        headers: { 'Accept': 'application/openapi+json' }
      });
      
      if (response.ok) {
        const schema = await response.json();
        const currentHash = JSON.stringify(schema).slice(0, 100);
        
        if (lastHash && lastHash !== currentHash) {
          logger.info('🔄 Schema changed, regenerating types...');
          const types = generateTypesFromSchema(schema);
          await fs.writeFile(outputPath, types);
          logger.success('✅ Types updated');
        }
        
        lastHash = currentHash;
      }
    } catch (error) {
      // Silently handle fetch errors in watch mode
    }
  };
  
  setInterval(checkChanges, interval);
}