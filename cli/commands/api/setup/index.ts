/**
 * @fileoverview API Setup commands
 * 
 * Commands for setting up various aspects of the PostgREST API
 * including database roles, configurations, and initial setup.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createRolesCommand } from './roles.js';

/**
 * Create setup command with subcommands
 */
export function createSetupCommand(): Command {
  const command = new Command('setup');
  
  command
    .description('Setup database and configuration for PostgREST API')
    .addCommand(createRolesCommand());
  
  return command;
}