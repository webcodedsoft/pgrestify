/**
 * @fileoverview Generate commands for PGRestify CLI
 * 
 * Advanced generation commands using intelligent database analysis
 * for creating optimized database objects (policies, views, functions, indexes).
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { createPolicyCommand } from './policy.js';
import { createViewCommand } from './view.js';
import { createFunctionCommand } from './function.js';
import { createIndexOptimizationCommand } from './index-optimization.js';

/**
 * Create generate command group
 */
export function createGenerateCommand(): Command {
  const command = new Command('generate');
  
  command
    .description('Generate optimized database objects using intelligent analysis')
    .addCommand(createPolicyCommand())
    .addCommand(createViewCommand()) 
    .addCommand(createFunctionCommand())
    .addCommand(createIndexOptimizationCommand());
  
  return command;
}