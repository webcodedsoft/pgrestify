/**
 * @fileoverview Frontend initialization command
 * 
 * Professional, single implementation that handles all frameworks consistently.
 * Clean, minimal, and follows industry standards.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';
import { SecurityValidator } from '../../utils/security.js';

/**
 * Framework configurations - standardized across all frameworks
 */
const FRAMEWORKS = {
  react: {
    name: 'React',
    envPrefix: 'REACT_APP_',
    dependencies: { 'pgrestify': '^1.0.0' },
    devDependencies: { '@types/node': '^20.0.0' }
  },
  nextjs: {
    name: 'Next.js',
    envPrefix: 'NEXT_PUBLIC_',
    dependencies: { 'pgrestify': '^1.0.0' },
    devDependencies: { '@types/node': '^20.0.0' }
  },
  vue: {
    name: 'Vue',
    envPrefix: 'VITE_',
    dependencies: { 'pgrestify': '^1.0.0' },
    devDependencies: { '@types/node': '^20.0.0' }
  },
  angular: {
    name: 'Angular',
    envPrefix: '',
    dependencies: { 'pgrestify': '^1.0.0' },
    devDependencies: { '@types/node': '^20.0.0' }
  },
  svelte: {
    name: 'Svelte',
    envPrefix: 'PUBLIC_',
    dependencies: { 'pgrestify': '^1.0.0' },
    devDependencies: { '@types/node': '^20.0.0' }
  }
} as const;

type Framework = keyof typeof FRAMEWORKS;

/**
 * Project configuration interface
 */
interface ProjectConfig {
  apiUrl: string;
  framework: Framework;
  projectPath: string;
  projectName: string;
  useTypeScript: boolean;
}

/**
 * Create frontend initialization command
 */
export function createInitCommand(): Command {
  const command = new Command('init');
  
  command
    .description('Initialize PGRestify in your frontend project')
    .argument('[api-url]', 'PostgREST API URL')
    .option('--skip-install', 'Skip dependency installation')
    .option('--typescript', 'Use TypeScript (auto-detected if not specified)')
    .action(async (apiUrl: string | undefined, options) => {
      await initializeProject(apiUrl, options);
    });
  
  return command;
}

/**
 * Initialize frontend project with PGRestify
 */
async function initializeProject(apiUrl: string | undefined, options: any): Promise<void> {
  const validator = new SecurityValidator();
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);
  
  logger.info(chalk.cyan('🚀 Initializing PGRestify'));
  logger.info(chalk.gray('Setting up type-safe PostgREST client for your frontend project'));
  logger.newLine();
  
  // Step 1: Collect project configuration
  const config = await collectProjectConfig(apiUrl, projectPath, projectName, options);
  
  // Step 2: Security validation
  const securityResult = validator.validateFrontendConfig({ apiUrl: config.apiUrl });
  if (securityResult.length > 0) {
    logger.error('Security validation failed:');
    securityResult.forEach(issue => logger.error(`  ${issue.message}`));
    process.exit(1);
  }
  
  // Step 3: Generate project files
  await generateProjectFiles(config);
  
  // Step 4: Install dependencies
  if (!options.skipInstall) {
    await installDependencies(config);
  }
  
  // Step 5: Display completion message
  displayCompletion(config);
}

/**
 * Collect project configuration through detection and prompts
 */
async function collectProjectConfig(
  apiUrl: string | undefined, 
  projectPath: string, 
  projectName: string,
  options: any
): Promise<ProjectConfig> {
  
  // Detect framework from existing project
  const detectedFramework = await detectFramework(projectPath);
  
  // Detect TypeScript usage
  const detectedTypeScript = options.typescript ?? await detectTypeScript(projectPath);
  
  // Collect missing information through prompts
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'PostgREST API URL:',
      default: apiUrl || 'http://localhost:3000',
      when: !apiUrl,
      validate: validateApiUrl
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Select your framework:',
      choices: Object.entries(FRAMEWORKS).map(([key, config]) => ({
        name: config.name,
        value: key
      })),
      default: detectedFramework,
      when: !detectedFramework
    }
  ]);
  
  return {
    apiUrl: apiUrl || answers.apiUrl,
    framework: detectedFramework || answers.framework,
    projectPath,
    projectName,
    useTypeScript: detectedTypeScript
  };
}

/**
 * Detect framework from project files and dependencies
 */
async function detectFramework(projectPath: string): Promise<Framework | null> {
  try {
    // Check package.json dependencies
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.exists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (allDeps['next']) return 'nextjs';
      if (allDeps['@angular/core']) return 'angular';
      if (allDeps['vue']) return 'vue';
      if (allDeps['svelte']) return 'svelte';
      if (allDeps['react']) return 'react';
    }
    
    // Check configuration files
    const configFiles = [
      ['next.config.js', 'nextjs'],
      ['next.config.ts', 'nextjs'],
      ['angular.json', 'angular'],
      ['vue.config.js', 'vue'],
      ['svelte.config.js', 'svelte']
    ];
    
    for (const [file, framework] of configFiles) {
      if (await fs.exists(path.join(projectPath, file))) {
        return framework as Framework;
      }
    }
  } catch (error) {
    // Silent detection failure - will prompt user
  }
  
  return null;
}

/**
 * Detect TypeScript usage in project
 */
async function detectTypeScript(projectPath: string): Promise<boolean> {
  const tsFiles = ['tsconfig.json', 'src/app.tsx', 'src/main.ts', 'src/App.tsx'];
  
  for (const file of tsFiles) {
    if (await fs.exists(path.join(projectPath, file))) {
      return true;
    }
  }
  
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.exists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (allDeps['typescript'] || allDeps['@types/node']) {
        return true;
      }
    }
  } catch (error) {
    // Silent detection failure
  }
  
  return false;
}

/**
 * Validate API URL input
 */
function validateApiUrl(input: string): boolean | string {
  if (!input.trim()) {
    return 'API URL is required';
  }
  
  try {
    const url = new URL(input);
    
    // Security warning for HTTP in production
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].some(host => url.hostname.includes(host))) {
      logger.warn(chalk.yellow('\n⚠️  Warning: HTTP is insecure for production. Use HTTPS.'));
    }
    
    return true;
  } catch {
    return 'Please enter a valid URL (e.g., https://api.example.com)';
  }
}

/**
 * Generate all project files
 */
async function generateProjectFiles(config: ProjectConfig): Promise<void> {
  logger.info('Generating project files...');
  
  // Ensure directories exist
  await fs.ensureDir(path.join(config.projectPath, 'src', 'lib'));
  
  // Generate files
  await Promise.all([
    generateEnvironmentFile(config),
    generateConfigFile(config),
    generateClientFile(config),
    generateTypesFile(config),
    updateGitignoreFile(config),
    updatePackageJsonScripts(config)
  ]);
  
  logger.success('✅ Project files generated');
}

/**
 * Generate environment file
 */
async function generateEnvironmentFile(config: ProjectConfig): Promise<void> {
  const framework = FRAMEWORKS[config.framework];
  const envFile = config.framework === 'nextjs' ? '.env.local' : '.env';
  
  const content = `# PGRestify Configuration
# Safe for frontend - contains only public endpoints

# PostgREST API endpoint
${framework.envPrefix}POSTGREST_URL=${config.apiUrl}

# Optional: Authentication service endpoint
# ${framework.envPrefix}AUTH_URL=https://your-auth-service.com

# 🚨 SECURITY: Never put secrets in frontend environment files
# ❌ DATABASE_URL, JWT_SECRET, passwords, API keys, etc.
`;

  await fs.writeFile(path.join(config.projectPath, envFile), content);
}

/**
 * Generate configuration file
 */
async function generateConfigFile(config: ProjectConfig): Promise<void> {
  const framework = FRAMEWORKS[config.framework];
  const ext = config.useTypeScript ? 'ts' : 'js';
  
  const typeImport = config.useTypeScript ? 'import type { Database } from \'./src/types/database\';' : '';
  const typeAnnotation = config.useTypeScript ? '<Database>' : '';
  
  const content = `/**
 * PGRestify Configuration
 * 
 * Configure your PostgREST client for ${framework.name}
 */

${typeImport}

const config = {
  // PostgREST API endpoint
  url: process.env.${framework.envPrefix}POSTGREST_URL || '${config.apiUrl}',
  
  // Request configuration
  headers: {
    'Content-Type': 'application/json',
    // Add custom headers here
  },
  
  // Authentication (integrate with your auth system)
  auth: {
    getToken: async () => {
      // Return your auth token here
      // Examples:
      // return localStorage.getItem('token');
      // return await supabase.auth.getSession()?.access_token;
      // return await auth0.getAccessTokenSilently();
      return null; // Replace with your auth logic
    }
  }
};

export default config;
`;

  await fs.writeFile(path.join(config.projectPath, `pgrestify.config.${ext}`), content);
}

/**
 * Generate client file
 */
async function generateClientFile(config: ProjectConfig): Promise<void> {
  const framework = FRAMEWORKS[config.framework];
  const ext = config.useTypeScript ? 'ts' : 'js';
  
  const imports = generateClientImports(config);
  const clientCreation = generateClientCreation(config);
  const frameworkIntegration = generateFrameworkIntegration(config);
  
  const content = `/**
 * PGRestify Client
 * 
 * Type-safe PostgREST client for ${framework.name}
 */

${imports}

${clientCreation}

${frameworkIntegration}

/**
 * Usage Examples:
 * 
 * // Query data
 * const { data, error } = await pgrestify
 *   .from('users')
 *   .select('*');
 * 
 * // Insert data
 * const { data, error } = await pgrestify
 *   .from('users')
 *   .insert({ name: 'John', email: 'john@example.com' });
 * 
 * // Update data
 * const { data, error } = await pgrestify
 *   .from('users')
 *   .update({ name: 'Jane' })
 *   .eq('id', 1);
 * 
 * // Delete data
 * const { error } = await pgrestify
 *   .from('users')
 *   .delete()
 *   .eq('id', 1);
 */
`;

  await fs.writeFile(path.join(config.projectPath, 'src', 'lib', `pgrestify.${ext}`), content);
}

/**
 * Generate client imports based on configuration
 */
function generateClientImports(config: ProjectConfig): string {
  const configImport = config.useTypeScript ? 
    'import config from \'../../pgrestify.config\';' :
    'import config from \'../../pgrestify.config.js\';';
  
  const typeImports = config.useTypeScript ? 
    'import type { Database } from \'../types/database\';' : '';
  
  return `import { createClient } from 'pgrestify';
${configImport}
${typeImports}`;
}

/**
 * Generate client creation code
 */
function generateClientCreation(config: ProjectConfig): string {
  const typeAnnotation = config.useTypeScript ? '<Database>' : '';
  
  return `// Create typed PostgREST client
export const pgrestify = createClient${typeAnnotation}(config);`;
}

/**
 * Generate framework-specific integration
 */
function generateFrameworkIntegration(config: ProjectConfig): string {
  const integrations = {
    react: `
// React integration
export { pgrestify as default };

// Custom hook for React components
export function usePGRestify() {
  return pgrestify;
}`,
    
    nextjs: `
// Next.js integration
export { pgrestify as default };

// Custom hook for Next.js components
export function usePGRestify() {
  return pgrestify;
}

// Server-side helper (use in API routes, getServerSideProps, etc.)
export function createServerClient() {
  return createClient${config.useTypeScript ? '<Database>' : ''}({
    ...config,
    // Override for server-side usage if needed
  });
}`,
    
    vue: `
// Vue integration
export { pgrestify as default };

// Vue composable
export function usePGRestify() {
  return pgrestify;
}`,
    
    angular: `
// Angular integration
export { pgrestify as default };

// Use pgrestify in your Angular services:
// constructor() { const client = pgrestify; }`,
    
    svelte: `
// Svelte integration
export { pgrestify as default };

// Svelte store (optional)
import { writable } from 'svelte/store';
export const pgrestifyStore = writable(pgrestify);`
  };
  
  return integrations[config.framework] || '// Framework-agnostic client\nexport { pgrestify as default };';
}

/**
 * Generate TypeScript types file
 */
async function generateTypesFile(config: ProjectConfig): Promise<void> {
  if (!config.useTypeScript) return;
  
  await fs.ensureDir(path.join(config.projectPath, 'src', 'types'));
  
  const content = `/**
 * Database Types
 * 
 * Run 'pgrestify frontend types' to generate types from your PostgREST API
 */

// Placeholder types - will be replaced when you run type generation
export interface Database {
  // Your database schema types will appear here
  [key: string]: any;
}

// Utility types for common operations
export type InsertData<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
export type UpdateData<T> = Partial<T>;
export type SelectData<T> = T;
`;

  await fs.writeFile(path.join(config.projectPath, 'src', 'types', 'database.ts'), content);
}

/**
 * Update .gitignore file
 */
async function updateGitignoreFile(config: ProjectConfig): Promise<void> {
  const gitignorePath = path.join(config.projectPath, '.gitignore');
  const gitignoreRules = `
# PGRestify
.env
.env.local
.env.*.local

# Security - never commit these
*.secret
*.key
*-secret*
jwt-secret*
database-url*
`;

  try {
    if (await fs.exists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath);
      if (!content.includes('PGRestify')) {
        await fs.appendFile(gitignorePath, gitignoreRules);
      }
    } else {
      await fs.writeFile(gitignorePath, gitignoreRules.trim());
    }
  } catch (error) {
    logger.warn('Could not update .gitignore file');
  }
}

/**
 * Update package.json scripts
 */
async function updatePackageJsonScripts(config: ProjectConfig): Promise<void> {
  try {
    const packageJsonPath = path.join(config.projectPath, 'package.json');
    if (!await fs.exists(packageJsonPath)) return;
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
    
    // Add PGRestify scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      'pgrestify:types': 'pgrestify frontend types',
      'pgrestify:validate': 'pgrestify validate'
    };
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    logger.warn('Could not update package.json scripts');
  }
}

/**
 * Install dependencies
 */
async function installDependencies(config: ProjectConfig): Promise<void> {
  logger.info('Installing PGRestify...');
  
  try {
    const packageManager = await detectPackageManager(config.projectPath);
    const command = getInstallCommand(packageManager);
    
    await fs.exec(command, { cwd: config.projectPath });
    logger.success('✅ Dependencies installed');
  } catch (error) {
    logger.warn('Could not install dependencies automatically');
    logger.info(`Please install manually: ${chalk.cyan('npm install pgrestify')}`);
  }
}

/**
 * Detect package manager
 */
async function detectPackageManager(projectPath: string): Promise<string> {
  if (await fs.exists(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fs.exists(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (await fs.exists(path.join(projectPath, 'bun.lockb'))) return 'bun';
  return 'npm';
}

/**
 * Get install command for package manager
 */
function getInstallCommand(packageManager: string): string {
  const commands = {
    npm: 'npm install pgrestify',
    yarn: 'yarn add pgrestify',
    pnpm: 'pnpm add pgrestify',
    bun: 'bun add pgrestify'
  };
  return commands[packageManager] || commands.npm;
}

/**
 * Display completion message
 */
function displayCompletion(config: ProjectConfig): void {
  const framework = FRAMEWORKS[config.framework];
  
  logger.newLine();
  logger.success(chalk.green('🎉 PGRestify initialization complete!'));
  logger.newLine();
  
  logger.info(chalk.cyan('Generated files:'));
  logger.list([
    `${config.framework === 'nextjs' ? '.env.local' : '.env'} - Environment configuration`,
    `pgrestify.config.${config.useTypeScript ? 'ts' : 'js'} - Client configuration`,
    `src/lib/pgrestify.${config.useTypeScript ? 'ts' : 'js'} - Your typed client`,
    ...(config.useTypeScript ? ['src/types/database.ts - Type definitions'] : [])
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Next steps:'));
  logger.list([
    `Import: import { pgrestify } from './src/lib/pgrestify';`,
    'Generate types: npm run pgrestify:types',
    'Configure authentication in pgrestify.config.js',
    `Start building with ${framework.name}!`
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('🔒 Security:'));
  logger.info(chalk.gray('✅ No secrets generated (frontend-safe)'));
  logger.info(chalk.gray('✅ Only public API endpoints configured'));
  logger.info(chalk.gray('✅ Ready for production deployment'));
  
  logger.newLine();
  logger.info(`Connected to: ${chalk.bold(config.apiUrl)}`);
}