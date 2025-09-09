#!/usr/bin/env node

/**
 * @fileoverview PGRestify CLI - Refactored with Security First
 * 
 * Main entry point with completely separate frontend and backend commands.
 * Frontend commands never handle credentials or secrets.
 * Backend commands are clearly marked and handle server configuration.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from './utils/logger.js';

// Frontend commands (safe for client-side projects)
import { createFrontendCommand } from './commands/frontend/index.js';

// API/Backend commands (PostgREST-specific)
import { createAPICommand } from './commands/api/index.js';

// Shared commands
import { createValidateCommand } from './commands/shared/validate.js';

// Version from package.json
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

/**
 * Create the main CLI program with clear separation
 */
function createProgram(): Command {
  const program = new Command();
  
  program
    .name('pgrestify')
    .description(`
${chalk.cyan('PGRestify CLI')} - Type-safe PostgREST Client

${chalk.green('Frontend Commands:')} (Safe for client-side projects)
  frontend init    - Initialize a frontend project
  frontend types   - Generate TypeScript types from PostgREST API
  frontend hooks   - Generate React/Vue hooks
  
${chalk.yellow('API/Backend Commands:')} (PostgREST & database specific)
  api init             - Initialize complete PostgREST project
  api migrate          - Run database migrations
  api schema generate  - Generate schema with RLS
  api schema validate  - Validate PostgREST schema
  api functions create - Create PostgREST functions
  api config postgrest - Generate PostgREST config
  api config docker    - Generate Docker setup
  api features views   - Generate PostgreSQL views
  api features triggers - Generate database triggers
  api features indexes - Generate database indexes
  
${chalk.blue('Shared Commands:')}
  validate         - Validate your configuration

${chalk.cyan('Focus:')}
  PGRestify specializes in PostgREST client tooling and database utilities.
  For generic backend deployment, use specialized tools.
`)
    .version(packageJson.version)
    .showHelpAfterError(true);
  
  // Add frontend commands (safe for browsers)
  program.addCommand(createFrontendCommand());
  
  // Add API/backend commands
  program.addCommand(createAPICommand());
  
  // Add shared commands
  program.addCommand(createValidateCommand());
  
  // Global error handling
  program.hook('postAction', () => {
    // Security reminder after commands
    if (process.env.NODE_ENV !== 'test') {
      logger.newLine();
      logger.info(chalk.gray('Security: Never commit secrets to version control'));
    }
  });
  
  return program;
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const program = createProgram();
    
    // Show security warning for first-time users
    if (process.argv.length === 2) {
      program.outputHelp();
      
      logger.newLine();
      logger.info(chalk.cyan('🔒 Security Best Practices:'));
      logger.info(chalk.gray('• Frontend projects should never contain database credentials'));
      logger.info(chalk.gray('• JWT secrets belong only in backend/server code'));
      logger.info(chalk.gray('• Use environment variables for all sensitive data'));
      logger.info(chalk.gray('• Always use HTTPS in production'));
      logger.newLine();
      logger.info(chalk.cyan('Learn more: https://pgrestify.dev/security'));
      
      return;
    }
    
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error(`Command failed: ${error}`);
    process.exit(1);
  }
}

// Run CLI
main().catch(console.error);

/**
 * Export for testing
 */
export { createProgram };