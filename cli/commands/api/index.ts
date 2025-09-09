/**
 * @fileoverview API/Backend commands for PostgREST
 * 
 * All PostgREST-specific commands grouped under 'api' for better organization.
 * Includes schema management, functions, configuration, and advanced features.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createInitCommand } from './init.js';
import { createMigrateCommand } from './migrate.js';
import { createApplyCommand } from './apply.js';
import { createSchemaCommand } from './schema/index.js';
import { createFunctionsCommand } from './functions/index.js';
import { createConfigCommand } from './config/index.js';
import { createFeaturesCommand } from './features/index.js';
import { createGenerateCommand } from './generate/index.js';
import { createTestingDataCommand } from './testing-data.js';
import { createPullCommand } from './pull.js';
import { createUpdateCommand } from './update/index.js';
import { createSyncCommand } from './sync.js';
import { createMigrationsCommand } from './migrations.js';
import { createSetupCommand } from './setup/index.js';

/**
 * Create API command group
 */
export function createAPICommand(): Command {
  const command = new Command('api');
  
  command
    .description('PostgREST API and backend commands')
    .addCommand(createInitCommand())
    .addCommand(createMigrateCommand())
    .addCommand(createApplyCommand())
    .addCommand(createPullCommand())
    .addCommand(createSetupCommand())
    .addCommand(createSchemaCommand())
    .addCommand(createFunctionsCommand())
    .addCommand(createConfigCommand())
    .addCommand(createFeaturesCommand())
    .addCommand(createGenerateCommand())
    .addCommand(createTestingDataCommand())
    .addCommand(createUpdateCommand())
    .addCommand(createSyncCommand())
    .addCommand(createMigrationsCommand());
  
  return command;
}