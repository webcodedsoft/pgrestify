/**
 * @fileoverview Update/modify commands for PGRestify
 * 
 * Commands for updating existing configurations.
 * Provides safe modification capabilities with backup and validation features.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createUpdateConfigCommand } from './config.js';

/**
 * Create update command group
 */
export function createUpdateCommand(): Command {
  const command = new Command('update');
  
  command
    .description('Update and modify existing PGRestify configurations')
    .addCommand(createUpdateConfigCommand());
  
  return command;
}