/**
 * @fileoverview PostgREST function commands
 * 
 * Generates PostgreSQL functions optimized for PostgREST usage,
 * including authentication functions, custom endpoints, and utilities.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createGenerateCommand } from './generate.js';
import { createCreateCommand } from './create.js';

/**
 * Create functions command group
 */
export function createFunctionsCommand(): Command {
  const command = new Command('functions');
  
  command
    .description('PostgREST function management')
    .addCommand(createGenerateCommand())
    .addCommand(createCreateCommand());
  
  return command;
}