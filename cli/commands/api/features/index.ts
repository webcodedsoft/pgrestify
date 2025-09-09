/**
 * @fileoverview PostgREST features commands
 * 
 * Additional PostgREST features like views, triggers, procedures,
 * and other database utilities optimized for PostgREST usage.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createViewsCommand } from './views.js';
import { createTriggersCommand } from './triggers.js';
import { createIndexesCommand } from './indexes.js';

/**
 * Create features command group
 */
export function createFeaturesCommand(): Command {
  const command = new Command('features');
  
  command
    .description('PostgREST advanced features')
    .addCommand(createViewsCommand())
    .addCommand(createTriggersCommand())
    .addCommand(createIndexesCommand());
  
  return command;
}