/**
 * @fileoverview Security validation and enforcement utilities
 * 
 * Provides security checks, validation, and enforcement to prevent
 * exposing secrets, credentials, and sensitive data in frontend code.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import chalk from 'chalk';
import crypto from 'crypto';
import { logger } from './logger.js';
import { fs } from './fs.js';
import path from 'path';

/**
 * Project types with security implications
 */
export enum ProjectType {
  FRONTEND = 'frontend',    // Client-side only (React, Vue, etc.)
  BACKEND = 'backend',       // Server-side only (Node.js API)
  FULLSTACK = 'fullstack',   // Both frontend and backend
  UNKNOWN = 'unknown'
}

/**
 * Security risk levels
 */
export enum SecurityRiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  valid: boolean;
  errors: SecurityIssue[];
  warnings: SecurityIssue[];
}

/**
 * Security issue details
 */
export interface SecurityIssue {
  level: SecurityRiskLevel;
  code: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  projectType: ProjectType;
  allowedInFrontend: string[];
  forbiddenInFrontend: string[];
  requireHttps: boolean;
  enforceEnvironmentVariables: boolean;
}

/**
 * Security error messages
 */
export const SECURITY_ERRORS = {
  JWT_SECRET_IN_FRONTEND: {
    code: 'SEC001',
    level: SecurityRiskLevel.CRITICAL,
    message: 'JWT secrets must NEVER be included in frontend code',
    suggestion: 'Use an authentication service to manage JWT tokens'
  },
  
  DATABASE_URL_IN_FRONTEND: {
    code: 'SEC002',
    level: SecurityRiskLevel.CRITICAL,
    message: 'Database credentials must NEVER be exposed to browsers',
    suggestion: 'Connect through PostgREST API endpoint only'
  },
  
  HARDCODED_CREDENTIALS: {
    code: 'SEC003',
    level: SecurityRiskLevel.CRITICAL,
    message: 'Hardcoded credentials detected',
    suggestion: 'Use environment variables or secure secret management'
  },
  
  INSECURE_HTTP: {
    code: 'SEC004',
    level: SecurityRiskLevel.HIGH,
    message: 'HTTP is insecure for production use',
    suggestion: 'Always use HTTPS in production environments'
  },
  
  WEAK_SECRET: {
    code: 'SEC005',
    level: SecurityRiskLevel.HIGH,
    message: 'Weak or predictable secret detected',
    suggestion: 'Use cryptographically secure random generation'
  },
  
  EXPOSED_ENV_FILE: {
    code: 'SEC006',
    level: SecurityRiskLevel.HIGH,
    message: 'Environment file may be exposed',
    suggestion: 'Ensure .env files are in .gitignore'
  },
  
  NO_AUTH_CONFIGURED: {
    code: 'SEC007',
    level: SecurityRiskLevel.MEDIUM,
    message: 'No authentication configured',
    suggestion: 'Implement proper authentication for production'
  },
  
  PLAIN_TEXT_SECRETS: {
    code: 'SEC008',
    level: SecurityRiskLevel.HIGH,
    message: 'Secrets stored in plain text',
    suggestion: 'Use encryption or secure secret storage'
  }
};

/**
 * Security validator class
 */
export class SecurityValidator {
  private config: SecurityConfig;
  
  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      projectType: ProjectType.UNKNOWN,
      allowedInFrontend: [
        'NEXT_PUBLIC_',
        'REACT_APP_',
        'VITE_',
        'PUBLIC_',
        'VUE_APP_'
      ],
      forbiddenInFrontend: [
        'JWT_SECRET',
        'DATABASE_URL',
        'DB_PASSWORD',
        'API_KEY',
        'SECRET_KEY',
        'PRIVATE_KEY',
        'ACCESS_TOKEN',
        'REFRESH_TOKEN'
      ],
      requireHttps: true,
      enforceEnvironmentVariables: true,
      ...config
    };
  }
  
  /**
   * Detect project type from package.json and file structure
   */
  async detectProjectType(projectPath: string): Promise<ProjectType> {
    try {
      // Check package.json for frontend frameworks
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.exists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };
        
        // Frontend framework detection
        const frontendFrameworks = [
          'react', 'vue', '@angular/core', 'svelte', 
          'next', 'gatsby', 'nuxt', '@angular/cli'
        ];
        
        const hasFrontend = frontendFrameworks.some(fw => deps[fw]);
        
        // Backend framework detection
        const backendIndicators = [
          'express', 'fastify', 'koa', 'hapi',
          '@nestjs/core', 'postgrest'
        ];
        
        const hasBackend = backendIndicators.some(fw => deps[fw]);
        
        // Check for server files
        const serverFiles = [
          'server.js', 'server.ts', 'app.js', 'app.ts',
          'postgrest.conf', 'docker-compose.yml'
        ];
        
        const hasServerFiles = await Promise.all(
          serverFiles.map(file => fs.exists(path.join(projectPath, file)))
        ).then(results => results.some(exists => exists));
        
        if (hasFrontend && (hasBackend || hasServerFiles)) {
          return ProjectType.FULLSTACK;
        } else if (hasFrontend) {
          return ProjectType.FRONTEND;
        } else if (hasBackend || hasServerFiles) {
          return ProjectType.BACKEND;
        }
      }
      
      // Check for index.html (likely frontend)
      if (await fs.exists(path.join(projectPath, 'index.html')) ||
          await fs.exists(path.join(projectPath, 'public/index.html'))) {
        return ProjectType.FRONTEND;
      }
      
      return ProjectType.UNKNOWN;
    } catch {
      return ProjectType.UNKNOWN;
    }
  }
  
  /**
   * Validate configuration for security issues
   */
  validateConfig(config: any, projectType: ProjectType): SecurityValidationResult {
    const errors: SecurityIssue[] = [];
    const warnings: SecurityIssue[] = [];
    
    // Check for JWT secrets in frontend
    if (projectType === ProjectType.FRONTEND) {
      if (config.jwtSecret || config.jwt_secret || config.JWT_SECRET) {
        errors.push({
          ...SECURITY_ERRORS.JWT_SECRET_IN_FRONTEND,
          file: 'pgrestify.config'
        });
      }
      
      // Check for database URLs in frontend
      if (config.databaseUrl || config.database_url || config.DATABASE_URL || 
          config.dbUri || config.db_uri || config.DB_URI) {
        errors.push({
          ...SECURITY_ERRORS.DATABASE_URL_IN_FRONTEND,
          file: 'pgrestify.config'
        });
      }
      
      // Check for any connection strings
      const configStr = JSON.stringify(config);
      if (configStr.includes('postgresql://') || 
          configStr.includes('postgres://') ||
          configStr.includes('mysql://')) {
        errors.push({
          ...SECURITY_ERRORS.DATABASE_URL_IN_FRONTEND,
          file: 'pgrestify.config'
        });
      }
    }
    
    // Check for hardcoded credentials
    if (config.password || config.apiKey || config.secretKey) {
      errors.push({
        ...SECURITY_ERRORS.HARDCODED_CREDENTIALS,
        file: 'pgrestify.config'
      });
    }
    
    // Check for insecure HTTP in production
    if (config.url && config.url.startsWith('http://') && 
        !config.url.includes('localhost') && 
        !config.url.includes('127.0.0.1')) {
      warnings.push({
        ...SECURITY_ERRORS.INSECURE_HTTP,
        file: 'pgrestify.config'
      });
    }
    
    // Check for missing authentication
    if (!config.auth || config.auth === 'none') {
      warnings.push({
        ...SECURITY_ERRORS.NO_AUTH_CONFIGURED,
        file: 'pgrestify.config'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate frontend configuration specifically
   */
  validateFrontendConfig(config: any): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // List of forbidden keys in frontend
    const forbiddenKeys = [
      'jwtSecret', 'jwt_secret', 'JWT_SECRET',
      'databaseUrl', 'database_url', 'DATABASE_URL',
      'dbUri', 'db_uri', 'DB_URI',
      'password', 'PASSWORD',
      'apiKey', 'api_key', 'API_KEY',
      'secretKey', 'secret_key', 'SECRET_KEY',
      'privateKey', 'private_key', 'PRIVATE_KEY'
    ];
    
    // Check each forbidden key
    forbiddenKeys.forEach(key => {
      if (hasNestedProperty(config, key)) {
        issues.push({
          level: SecurityRiskLevel.CRITICAL,
          code: 'SEC001',
          message: `Forbidden key "${key}" found in frontend configuration`,
          suggestion: 'Remove this key from frontend configuration'
        });
      }
    });
    
    // Check for connection strings in any value
    const configStr = JSON.stringify(config);
    const connectionPatterns = [
      /postgresql:\/\/[^"'\s]+/g,
      /postgres:\/\/[^"'\s]+/g,
      /mysql:\/\/[^"'\s]+/g,
      /mongodb:\/\/[^"'\s]+/g,
      /redis:\/\/[^"'\s]+/g
    ];
    
    connectionPatterns.forEach(pattern => {
      const matches = configStr.match(pattern);
      if (matches) {
        issues.push({
          level: SecurityRiskLevel.CRITICAL,
          code: 'SEC002',
          message: `Database connection string found: ${matches[0].substring(0, 20)}...`,
          suggestion: 'Remove database URLs from frontend code'
        });
      }
    });
    
    return issues;
  }
  
  /**
   * Validate environment variables
   */
  validateEnvironmentVariables(envVars: Record<string, string>, projectType: ProjectType): SecurityValidationResult {
    const errors: SecurityIssue[] = [];
    const warnings: SecurityIssue[] = [];
    
    if (projectType === ProjectType.FRONTEND) {
      // Check that frontend env vars have proper prefixes
      Object.keys(envVars).forEach(key => {
        const hasAllowedPrefix = this.config.allowedInFrontend.some(prefix => 
          key.startsWith(prefix)
        );
        
        if (!hasAllowedPrefix) {
          // Check if it's a forbidden variable
          const isForbidden = this.config.forbiddenInFrontend.some(forbidden =>
            key.includes(forbidden)
          );
          
          if (isForbidden) {
            errors.push({
              level: SecurityRiskLevel.CRITICAL,
              code: 'SEC009',
              message: `Forbidden environment variable "${key}" in frontend`,
              suggestion: `Frontend env vars should start with NEXT_PUBLIC_, REACT_APP_, etc.`
            });
          } else {
            warnings.push({
              level: SecurityRiskLevel.MEDIUM,
              code: 'SEC010',
              message: `Environment variable "${key}" may not be accessible in frontend`,
              suggestion: `Use proper prefix for frontend env vars`
            });
          }
        }
      });
    }
    
    // Check for exposed secrets in values
    Object.entries(envVars).forEach(([key, value]) => {
      if (value && value.length > 0) {
        // Check for common secret patterns
        if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
          if (value === 'changeme' || value === 'secret' || value === 'password') {
            warnings.push({
              level: SecurityRiskLevel.HIGH,
              code: 'SEC011',
              message: `Weak secret value for "${key}"`,
              suggestion: 'Use strong, randomly generated secrets'
            });
          }
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if a file contains security issues
   */
  async validateFile(filePath: string, projectType: ProjectType): Promise<SecurityValidationResult> {
    const errors: SecurityIssue[] = [];
    const warnings: SecurityIssue[] = [];
    
    if (!await fs.exists(filePath)) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const content = await fs.readFile(filePath);
    const lines = content.toString().split('\n');
    
    // Patterns to check
    const securityPatterns = [
      {
        pattern: /jwt[_-]?secret\s*[:=]\s*["']([^"']+)["']/gi,
        error: SECURITY_ERRORS.JWT_SECRET_IN_FRONTEND,
        condition: () => projectType === ProjectType.FRONTEND
      },
      {
        pattern: /(?:postgresql|postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/gi,
        error: SECURITY_ERRORS.DATABASE_URL_IN_FRONTEND,
        condition: () => projectType === ProjectType.FRONTEND
      },
      {
        pattern: /password\s*[:=]\s*["'](?!process\.env)[^"']+["']/gi,
        error: SECURITY_ERRORS.HARDCODED_CREDENTIALS,
        condition: () => true
      },
      {
        pattern: /api[_-]?key\s*[:=]\s*["'](?!process\.env)[^"']+["']/gi,
        error: SECURITY_ERRORS.HARDCODED_CREDENTIALS,
        condition: () => true
      }
    ];
    
    // Check each line
    lines.forEach((line, lineNum) => {
      securityPatterns.forEach(({ pattern, error, condition }) => {
        if (condition() && pattern.test(line)) {
          errors.push({
            ...error,
            file: filePath,
            line: lineNum + 1
          });
        }
      });
      
      // Check for HTTP URLs in production config
      if (line.includes('http://') && 
          !line.includes('localhost') && 
          !line.includes('127.0.0.1') &&
          !line.includes('//')) { // Skip comments
        warnings.push({
          ...SECURITY_ERRORS.INSECURE_HTTP,
          file: filePath,
          line: lineNum + 1
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Display security validation results
   */
  displayResults(result: SecurityValidationResult): void {
    if (result.errors.length > 0) {
      logger.error(chalk.red('\n🚨 Security Errors Found:\n'));
      result.errors.forEach(error => {
        logger.error(chalk.red(`  ${error.code}: ${error.message}`));
        if (error.file) {
          const fileLocation = error.line ? `${error.file}:${error.line}` : error.file;
          logger.error(chalk.gray(`    File: ${fileLocation}`));
        }
        if (error.suggestion) {
          logger.info(chalk.yellow(`    Fix: ${error.suggestion}`));
        }
      });
    }
    
    if (result.warnings.length > 0) {
      logger.warn(chalk.yellow('\n⚠️  Security Warnings:\n'));
      result.warnings.forEach(warning => {
        logger.warn(chalk.yellow(`  ${warning.code}: ${warning.message}`));
        if (warning.file) {
          const fileLocation = warning.line ? `${warning.file}:${warning.line}` : warning.file;
          logger.warn(chalk.gray(`    File: ${fileLocation}`));
        }
        if (warning.suggestion) {
          logger.info(chalk.cyan(`    Suggestion: ${warning.suggestion}`));
        }
      });
    }
    
    if (result.valid && result.warnings.length === 0) {
      logger.success(chalk.green('✅ No security issues found'));
    }
  }
  
  /**
   * Prompt user to fix security issues
   */
  async promptForSecurityFix(issues: SecurityIssue[]): Promise<boolean> {
    const criticalIssues = issues.filter(i => i.level === SecurityRiskLevel.CRITICAL);
    
    if (criticalIssues.length > 0) {
      logger.error(chalk.red('\n🚨 CRITICAL SECURITY ISSUES DETECTED!\n'));
      logger.error('The following critical security issues must be resolved:');
      
      criticalIssues.forEach(issue => {
        logger.error(chalk.red(`  • ${issue.message}`));
      });
      
      logger.newLine();
      logger.error('These issues could expose sensitive data to attackers.');
      logger.error('Please fix them before continuing.');
      
      return false;
    }
    
    return true;
  }
}

/**
 * Helper function to check for nested properties
 */
function hasNestedProperty(obj: any, key: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  
  // Case-insensitive check
  const lowerKey = key.toLowerCase();
  
  for (const prop in obj) {
    if (prop.toLowerCase() === lowerKey) return true;
    
    if (typeof obj[prop] === 'object') {
      if (hasNestedProperty(obj[prop], key)) return true;
    }
  }
  
  return false;
}

/**
 * Generate secure random string
 */
export function generateSecureSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, length);
}

/**
 * Check if running in CI/CD environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL
  );
}

/**
 * Security best practices message
 */
export function displaySecurityBestPractices(): void {
  logger.info(chalk.cyan('\n🔒 Security Best Practices:\n'));
  
  const practices = [
    'Never commit .env files or secrets to version control',
    'Use environment variables for all sensitive configuration',
    'Always use HTTPS in production environments',
    'Implement Row-Level Security (RLS) in PostgreSQL',
    'Use separate backend service for authentication',
    'Rotate secrets regularly',
    'Monitor for suspicious activity',
    'Keep dependencies up to date',
    'Use Content Security Policy (CSP) headers',
    'Implement rate limiting on APIs'
  ];
  
  practices.forEach(practice => {
    logger.info(chalk.gray(`  • ${practice}`));
  });
  
  logger.newLine();
  logger.info(chalk.cyan('Learn more: https://pgrestify.dev/security'));
}

/**
 * Export singleton instance
 */
export const securityValidator = new SecurityValidator();