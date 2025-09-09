/**
 * @fileoverview Testing data generation command
 * 
 * Generate realistic dummy/testing data for schema templates.
 * Supports different templates with customizable record counts and options.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';
import { TestingDataGenerator, TestingDataConfig } from '../../generators/TestingDataGenerator.js';

/**
 * Create testing data command
 */
export function createTestingDataCommand(): Command {
  const command = new Command('testing-data');
  
  command
    .description('Generate realistic testing/dummy data for schema templates')
    .option('--template <type>', 'Schema template (basic|blog|ecommerce)', 'basic')
    .option('--records <count>', 'Number of records to generate per table', '50')
    .option('--output <path>', 'Output file path', './sql/testing_data.sql')
    .option('--with-images', 'Include placeholder images where applicable')
    .option('--realistic', 'Generate realistic data (names, emails, etc.)', true)
    .option('--skip-prompts', 'Skip interactive prompts (use defaults)')
    .action(async (options) => {
      await generateTestingData(options);
    });
  
  return command;
}

/**
 * Generate testing data
 */
async function generateTestingData(options: any) {
  logger.info(chalk.cyan('🎲 PGRestify Testing Data Generator'));
  logger.info('Generate realistic dummy data for your schema templates.');
  logger.newLine();
  
  // Collect configuration
  const config = await collectConfig(options);
  
  // Generate testing data
  await createTestingData(config);
  
  // Display completion message
  displayCompletion(config);
}

/**
 * Collect configuration
 */
async function collectConfig(options: any) {
  if (options.skipPrompts) {
    return {
      template: options.template as 'basic' | 'blog' | 'ecommerce',
      recordCount: parseInt(options.records) || 50,
      outputPath: options.output || './sql/testing_data.sql',
      includeImages: options.withImages || false,
      generateRealistic: options.realistic !== false,
      projectPath: process.cwd()
    };
  }
  
  logger.info(chalk.cyan('📋 Testing Data Configuration'));
  logger.newLine();
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Choose schema template:',
      choices: [
        { name: 'Basic - Simple users and profiles', value: 'basic' },
        { name: 'Blog - Posts, comments, categories', value: 'blog' },
        { name: 'E-commerce - Products, orders, customers', value: 'ecommerce' }
      ],
      default: options.template
    },
    {
      type: 'input',
      name: 'recordCount',
      message: 'Number of records per table:',
      default: parseInt(options.records) || 50,
      validate: (input: string) => {
        const count = parseInt(input);
        return (count > 0 && count <= 1000) || 'Must be between 1 and 1000';
      },
      filter: (input: string) => parseInt(input)
    },
    {
      type: 'input',
      name: 'outputPath',
      message: 'Output file path:',
      default: options.output || './sql/testing_data.sql',
      validate: (input: string) => input.trim().length > 0 || 'Output path is required'
    },
    {
      type: 'confirm',
      name: 'includeImages',
      message: 'Include placeholder images?',
      default: options.withImages || false
    },
    {
      type: 'confirm',
      name: 'generateRealistic',
      message: 'Generate realistic data (names, emails, addresses)?',
      default: options.realistic !== false
    }
  ]);
  
  return {
    ...answers,
    projectPath: process.cwd()
  };
}

/**
 * Create testing data
 */
async function createTestingData(config: any) {
  logger.info(chalk.blue(`🔧 Generating ${config.template} template data...`));
  logger.info(`Records per table: ${config.recordCount}`);
  logger.info(`Realistic data: ${config.generateRealistic ? 'Yes' : 'No'}`);
  logger.info(`Include images: ${config.includeImages ? 'Yes' : 'No'}`);
  logger.newLine();
  
  try {
    const generator = new TestingDataGenerator(config.projectPath);
    const testingConfig: TestingDataConfig = {
      template: config.template,
      recordCount: config.recordCount,
      includeImages: config.includeImages,
      generateRealistic: config.generateRealistic
    };
    
    const sql = await generator.generateTestingData(testingConfig);
    
    // Ensure output directory exists
    const outputDir = config.outputPath.substring(0, config.outputPath.lastIndexOf('/'));
    if (outputDir && outputDir !== '.') {
      await fs.ensureDir(outputDir);
    }
    
    // Write SQL file
    await fs.writeFile(config.outputPath, sql);
    
    config.outputFile = config.outputPath;
    logger.success(`✅ Testing data generated successfully!`);
    
  } catch (error) {
    logger.error(`Failed to generate testing data: ${error}`);
    throw error;
  }
}

/**
 * Display completion message
 */
function displayCompletion(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('📄 Generated Testing Data Summary:'));
  logger.newLine();
  
  logger.list([
    `Template: ${config.template}`,
    `Records per table: ${config.recordCount}`,
    `Realistic data: ${config.generateRealistic ? 'Yes' : 'No'}`,
    `Include images: ${config.includeImages ? 'Yes' : 'No'}`,
    `Output file: ${config.outputFile}`
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('🚀 Next Steps:'));
  logger.newLine();
  
  logger.info('1. Review the generated SQL file:');
  logger.code(`cat ${config.outputFile}`);
  logger.newLine();
  
  logger.info('2. Load the data into your database:');
  logger.code(`# Using psql
psql -h localhost -U username -d database -f ${config.outputFile}

# Using Docker Compose
docker compose exec -T postgres psql -U username -d database < ${config.outputFile}`);
  logger.newLine();
  
  logger.info('3. Verify the data was loaded:');
  logger.code(`# Connect to your database and run:
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = t.table_name) as record_count
FROM information_schema.tables t 
WHERE table_schema = 'api'
ORDER BY table_name;`);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Tips:'));
  logger.list([
    'Use --with-images flag to include placeholder images from picsum.photos',
    'Adjust --records count based on your testing needs (1-1000)',
    'Run multiple times with different settings to create varied datasets',
    'The generated data includes relationships between tables',
    'All generated passwords are hashed versions of "password123"'
  ]);
  
  logger.newLine();
  logger.info(chalk.green('Testing data is ready for use! 🎉'));
}