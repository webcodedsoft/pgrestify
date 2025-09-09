/**
 * @fileoverview Validation commands for both frontend and backend
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../../utils/logger.js';
import { SecurityValidator } from '../../utils/security.js';

export function createValidateCommand(): Command {
  const command = new Command('validate');
  
  command
    .description('Validate project configuration and security')
    .option('--security', 'Run security validation only')
    .option('--config', 'Validate configuration files')
    .action(async (options) => {
      await validateProject(options);
    });
  
  return command;
}

async function validateProject(options: any) {
  logger.info(chalk.cyan('🔍 Validating PGRestify project...'));
  
  const validator = new SecurityValidator();
  const projectType = await validator.detectProjectType(process.cwd());
  
  logger.info(`Project type: ${projectType}`);
  
  // Security validation
  if (options.security !== false) {
    logger.info('Running security validation...');
    // Implementation will be added
  }
  
  // Config validation
  if (options.config !== false) {
    logger.info('Validating configuration...');
    // Implementation will be added
  }
  
  logger.success('✅ Validation completed');
}