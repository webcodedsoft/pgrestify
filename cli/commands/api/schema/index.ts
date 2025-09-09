/**
 * @fileoverview Schema commands for PostgREST
 * 
 * Generates database schemas with RLS, migrations, and validation.
 * PostgREST-specific tooling for database schema management.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createGenerateCommand } from './generate.js';
import { createMigrateCommand } from './migrate.js';
import { createValidateCommand } from './validate.js';
import { createRLSCommand } from './rls.js';
import { createRestructureCommand } from './restructure.js';

/**
 * Create schema command group
 */
export function createSchemaCommand(): Command {
  const command = new Command('schema');
  
  command
    .description('PostgREST schema management')
    .addCommand(createGenerateCommand())
    .addCommand(createMigrateCommand())
    .addCommand(createValidateCommand())
    .addCommand(createRLSCommand())
    .addCommand(createRestructureCommand());
  
  return command;
}