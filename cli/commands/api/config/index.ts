/**
 * @fileoverview PostgREST configuration commands
 * 
 * Generates PostgREST configuration files and Docker setups
 * optimized for different deployment scenarios.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createPostgrestCommand } from './postgrest.js';
import { createDockerCommand } from './docker.js';

/**
 * Create config command group
 */
export function createConfigCommand(): Command {
  const command = new Command('config');
  
  command
    .description('PostgREST configuration management')
    .addCommand(createPostgrestCommand())
    .addCommand(createDockerCommand());
  
  return command;
}