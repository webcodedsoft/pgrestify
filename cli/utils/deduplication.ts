/**
 * @fileoverview SQL deduplication utilities
 * 
 * Prevents duplicate SQL statements across all generator commands.
 * Handles views, policies, triggers, indexes, and other SQL constructs.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import inquirer from 'inquirer';
import { logger } from './logger.js';
import { fs } from './fs.js';

export interface DeduplicationResult {
  sql: string | null;
  duplicatesFound: string[];
  action: 'skip' | 'replace' | 'cancel' | 'none';
}

/**
 * Generic deduplication for any SQL construct
 */
export async function deduplicateSQL(
  newSQL: string,
  tableName: string,
  sqlFileType: string,
  projectPath: string,
  extractorType: SQLConstructType
): Promise<DeduplicationResult> {
  const sqlFilePath = `${projectPath}/sql/schemas/${tableName}/${sqlFileType}`;
  
  try {
    // Check if SQL file exists
    if (!(await fs.exists(sqlFilePath))) {
      return {
        sql: newSQL,
        duplicatesFound: [],
        action: 'none'
      };
    }
    
    // Read existing SQL file
    const existingContent = await fs.readFile(sqlFilePath);
    const existingConstructs = extractSQLConstructNames(existingContent, extractorType);
    const newConstructs = extractSQLConstructNames(newSQL, extractorType);
    
    console.log(`🐛 DEBUG - Existing ${extractorType}: ${JSON.stringify(existingConstructs)}`);
    console.log(`🐛 DEBUG - New ${extractorType}: ${JSON.stringify(newConstructs)}`);
    
    // Find duplicates
    const duplicates = newConstructs.filter(newConstruct => 
      existingConstructs.some(existing => existing === newConstruct)
    );
    
    if (duplicates.length === 0) {
      return {
        sql: newSQL,
        duplicatesFound: [],
        action: 'none'
      };
    }
    
    // Handle duplicates
    logger.warn(`⚠️  Found duplicate ${extractorType}: ${duplicates.join(', ')}`);
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `How would you like to handle duplicate ${extractorType}?`,
        choices: [
          { name: `Skip duplicates (keep existing ${extractorType})`, value: 'skip' },
          { name: `Replace duplicates (update existing ${extractorType})`, value: 'replace' },
          { name: 'Cancel (no changes)', value: 'cancel' }
        ],
        default: 'skip'
      }
    ]);
    
    switch (action) {
      case 'skip':
        const filteredSQL = removeConstructsFromSQL(newSQL, duplicates, extractorType);
        if (!filteredSQL.trim() || !hasValidSQLConstructs(filteredSQL, extractorType)) {
          return {
            sql: null,
            duplicatesFound: duplicates,
            action: 'skip'
          };
        }
        logger.info(`📝 Skipping ${duplicates.length} duplicate ${extractorType}`);
        return {
          sql: filteredSQL,
          duplicatesFound: duplicates,
          action: 'skip'
        };
        
      case 'replace':
        await removeConstructsFromFile(sqlFilePath, duplicates, extractorType);
        logger.info(`🔄 Replacing ${duplicates.length} existing ${extractorType}`);
        return {
          sql: newSQL,
          duplicatesFound: duplicates,
          action: 'replace'
        };
        
      case 'cancel':
        logger.info(`${extractorType} generation cancelled`);
        return {
          sql: null,
          duplicatesFound: duplicates,
          action: 'cancel'
        };
        
      default:
        return {
          sql: newSQL,
          duplicatesFound: duplicates,
          action: 'none'
        };
    }
    
  } catch (error) {
    logger.debug(`Error checking for duplicates: ${error.message}`);
    return {
      sql: newSQL,
      duplicatesFound: [],
      action: 'none'
    };
  }
}

export type SQLConstructType = 'policies' | 'views' | 'triggers' | 'indexes' | 'functions';

/**
 * Extract SQL construct names from content
 */
function extractSQLConstructNames(sqlContent: string, type: SQLConstructType): string[] {
  const patterns = {
    policies: /CREATE POLICY\s+"([^"]+)"/gi,
    views: /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:\w+\.)?(\w+)/gi,
    triggers: /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(\w+)/gi,
    indexes: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi,
    functions: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:\w+\.)?(\w+)\s*\(/gi
  };
  
  const regex = patterns[type];
  const matches = [];
  let match;
  
  while ((match = regex.exec(sqlContent)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

/**
 * Remove specific constructs from SQL content
 */
function removeConstructsFromSQL(sqlContent: string, constructsToRemove: string[], type: SQLConstructType): string {
  let result = sqlContent;
  
  for (const constructName of constructsToRemove) {
    const patterns = {
      policies: new RegExp(`--[^\\n]*${constructName}[^\\n]*\\n[\\s\\S]*?CREATE POLICY\\s+"${constructName}"[^;]*;\\s*`, 'gi'),
      views: new RegExp(`--[^\\n]*${constructName}[^\\n]*\\n[\\s\\S]*?CREATE\\s+(?:OR\\s+REPLACE\\s+)?VIEW\\s+(?:\\w+\\.)?${constructName}[^;]*;\\s*`, 'gi'),
      triggers: new RegExp(`--[^\\n]*${constructName}[^\\n]*\\n[\\s\\S]*?CREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\s+${constructName}[^;]*;\\s*`, 'gi'),
      indexes: new RegExp(`--[^\\n]*${constructName}[^\\n]*\\n[\\s\\S]*?CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${constructName}[^;]*;\\s*`, 'gi'),
      functions: new RegExp(`--[^\\n]*${constructName}[^\\n]*\\n[\\s\\S]*?CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:\\w+\\.)?${constructName}\\s*\\([^;]*;\\s*`, 'gi')
    };
    
    const pattern = patterns[type];
    result = result.replace(pattern, '');
  }
  
  return result;
}

/**
 * Check if SQL content has valid constructs
 */
function hasValidSQLConstructs(sqlContent: string, type: SQLConstructType): boolean {
  const checkPatterns = {
    policies: /CREATE POLICY/i,
    views: /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i,
    triggers: /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER/i,
    indexes: /CREATE\s+(?:UNIQUE\s+)?INDEX/i,
    functions: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i
  };
  
  return checkPatterns[type].test(sqlContent);
}

/**
 * Remove constructs from existing file
 */
async function removeConstructsFromFile(filePath: string, constructsToRemove: string[], type: SQLConstructType): Promise<void> {
  const content = await fs.readFile(filePath);
  const updatedContent = removeConstructsFromSQL(content, constructsToRemove, type);
  await fs.writeFile(filePath, updatedContent);
}