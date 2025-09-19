#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

const REQUIRED_NODE_VERSION = 18;
const REQUIRED_FILES = [
  'README.md',
  'LICENSE',
  'package.json'
];

const CHECKS = [
  {
    name: 'Node.js version',
    check: async () => {
      const nodeVersion = process.version.slice(1).split('.')[0];
      if (parseInt(nodeVersion) < REQUIRED_NODE_VERSION) {
        throw new Error(`Node.js ${REQUIRED_NODE_VERSION}+ is required. Current: ${process.version}`);
      }
      return `✓ Node.js ${process.version}`;
    }
  },
  {
    name: 'Required files',
    check: async () => {
      const missing = [];
      for (const file of REQUIRED_FILES) {
        try {
          await fs.access(path.resolve(file));
        } catch {
          missing.push(file);
        }
      }
      if (missing.length > 0) {
        throw new Error(`Missing required files: ${missing.join(', ')}`);
      }
      return `✓ All ${REQUIRED_FILES.length} required files present`;
    }
  },
  {
    name: 'Package size',
    check: async () => {
      const { stdout } = await execAsync('npm pack --dry-run --json');
      const packInfo = JSON.parse(stdout);
      const sizeMB = packInfo[0].size / (1024 * 1024);
      
      if (sizeMB > 5) {
        console.warn(chalk.yellow(`⚠ Package size is ${sizeMB.toFixed(2)} MB (recommended: < 5 MB)`));
      }
      
      return `✓ Package size: ${sizeMB.toFixed(2)} MB`;
    }
  },
  {
    name: 'Git status',
    check: async () => {
      const { stdout } = await execAsync('git status --porcelain');
      if (stdout.trim()) {
        throw new Error('Uncommitted changes detected. Please commit or stash changes before publishing.');
      }
      return '✓ Working directory clean';
    }
  },
  {
    name: 'Branch check',
    check: async () => {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
      const branch = stdout.trim();
      if (branch !== 'main' && !process.env.FORCE_PUBLISH) {
        throw new Error(`Publishing from '${branch}' branch. Use main branch or set FORCE_PUBLISH=true`);
      }
      return `✓ On branch: ${branch}`;
    }
  },
  {
    name: 'Registry authentication',
    check: async () => {
      try {
        const { stdout } = await execAsync('npm whoami');
        return `✓ Authenticated as: ${stdout.trim()}`;
      } catch {
        throw new Error('Not authenticated to npm registry. Run: npm login');
      }
    }
  },
  {
    name: 'Version check',
    check: async () => {
      const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const localVersion = pkg.version;
      
      try {
        const { stdout } = await execAsync(`npm view ${pkg.name} version`);
        const remoteVersion = stdout.trim();
        
        if (localVersion === remoteVersion) {
          throw new Error(`Version ${localVersion} already published. Bump version before publishing.`);
        }
        
        return `✓ Version: ${localVersion} (current npm: ${remoteVersion})`;
      } catch (error) {
        if (error.message.includes('E404')) {
          return `✓ First-time publish: ${localVersion}`;
        }
        throw error;
      }
    }
  }
];

async function runChecks() {
  console.log(chalk.blue.bold('\n🔍 Running pre-publish checks...\n'));
  
  let hasErrors = false;
  
  for (const { name, check } of CHECKS) {
    process.stdout.write(chalk.gray(`Checking ${name}... `));
    try {
      const result = await check();
      console.log(chalk.green(result));
    } catch (error) {
      console.log(chalk.red(`✗ ${error.message}`));
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.log(chalk.red.bold('\n✗ Pre-publish checks failed. Fix errors and try again.\n'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('\n✓ All pre-publish checks passed!\n'));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChecks().catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  });
}