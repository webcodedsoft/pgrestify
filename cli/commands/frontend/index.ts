/**
 * @fileoverview Frontend command group - Safe for client-side projects
 * 
 * All commands in this group are designed for frontend applications.
 * They NEVER handle database credentials, JWT secrets, or server configuration.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createInitCommand } from './init.js';
import { createTypesCommand } from './types.js';
import { createHooksCommand } from './hooks.js';
import { createComponentsCommand } from './components.js';

/**
 * Create the frontend command group
 */
export function createFrontendCommand(): Command {
  const command = new Command('frontend');
  
  command
    .description('Frontend commands for client-side projects (no secrets)')
    .alias('fe')
    .addHelpText('after', `
${chalk.green('Examples:')}
  
  # Initialize a new React project
  $ pgrestify frontend init my-app --framework react
  
  # Generate TypeScript types from PostgREST API
  $ pgrestify frontend types --api-url https://api.example.com
  
  # Generate React hooks
  $ pgrestify frontend hooks
  
${chalk.yellow('Security:')}
  These commands are safe for frontend projects.
  They will never ask for or store database credentials or JWT secrets.
`);
  
  // Add subcommands
  command.addCommand(createInitCommand());
  command.addCommand(createTypesCommand());
  command.addCommand(createHooksCommand());
  command.addCommand(createComponentsCommand());
  
  return command;
}

/**
 * Re-export individual commands for direct use
 */
export { createInitCommand } from './init.js';
export { createTypesCommand } from './types.js';
export { createHooksCommand } from './hooks.js';
export { createComponentsCommand } from './components.js';