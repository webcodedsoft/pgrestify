/**
 * @fileoverview Secure type definitions for PGRestify CLI
 * 
 * Types focused on security-first architecture, preventing
 * credential exposure and enforcing best practices.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

/**
 * Project types with different security requirements
 */
export type ProjectType = 'frontend' | 'backend' | 'fullstack';

/**
 * Supported frontend frameworks
 */
export type Framework = 
  | 'react' 
  | 'nextjs' 
  | 'vue' 
  | 'angular' 
  | 'svelte' 
  | 'vanilla';

/**
 * Authentication providers
 */
export type AuthProvider = 
  | 'supabase' 
  | 'auth0' 
  | 'clerk' 
  | 'custom' 
  | 'none';

/**
 * Secure initialization options
 */
export interface SecureInitOptions {
  type?: ProjectType;
  framework?: Framework;
  auth?: AuthProvider;
  apiUrl?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Frontend-safe configuration
 */
export interface FrontendConfig {
  project: {
    name: string;
    type: 'frontend';
    framework: Framework;
  };
  
  api: {
    postgrestUrl: string;  // Public API endpoint only
    headers?: Record<string, string>;  // No auth headers here
  };
  
  auth: {
    provider: AuthProvider;
    authUrl?: string;  // Public auth endpoint
    storage: {
      strategy: 'memory' | 'session' | 'secure-storage';
      key: string;
    };
    refresh: {
      enabled: boolean;
      buffer: number;  // Seconds before expiry
    };
  };
  
  generation: {
    output: string;
    introspection: {
      enabled: boolean;
      cache: boolean;
      cacheDir?: string;
    };
  };
  
  dev: {
    debug: boolean;
    mocking?: {
      enabled: boolean;
      delay: number;
    };
  };
}

/**
 * Backend-only configuration (separate package)
 */
export interface BackendConfig {
  project: {
    name: string;
    type: 'backend';
  };
  
  database: {
    // These use environment variables only
    url: string;  // process.env.DATABASE_URL
    poolSize?: number;
  };
  
  postgrest: {
    configPath: string;
    port: number;
    anonRole: string;
    schemas: string[];
  };
  
  jwt: {
    // Secret from environment only
    secret: string;  // process.env.JWT_SECRET
    algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256';
    expiry: number;
  };
  
  security: {
    cors: {
      origins: string[];
      credentials: boolean;
    };
    rateLimit: {
      enabled: boolean;
      window: number;
      max: number;
    };
    ssl: {
      required: boolean;
      rejectUnauthorized: boolean;
    };
  };
}

/**
 * Environment variable configuration
 */
export interface EnvConfig {
  // Frontend-safe environment variables
  frontend: {
    POSTGREST_URL: string;
    AUTH_URL?: string;
    PUBLIC_KEY?: string;  // Public keys are safe
  };
  
  // Backend-only environment variables
  backend: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    ADMIN_PASSWORD?: string;
    API_KEY?: string;
  };
}

/**
 * Security validation options
 */
export interface SecurityValidationOptions {
  projectPath: string;
  projectType: ProjectType;
  strict: boolean;
  autoFix: boolean;
}

/**
 * CLI command context with security info
 */
export interface SecureCommandContext {
  projectType: ProjectType;
  isProduction: boolean;
  hasAuthentication: boolean;
  isSecure: boolean;  // HTTPS
  environmentVariables: Set<string>;
}

/**
 * File generation options with security checks
 */
export interface SecureFileGeneration {
  path: string;
  content: string;
  sensitive: boolean;
  addToGitignore: boolean;
  encrypt: boolean;
}

/**
 * Authentication flow configuration
 */
export interface AuthFlowConfig {
  provider: AuthProvider;
  endpoints: {
    login?: string;
    logout?: string;
    refresh?: string;
    verify?: string;
  };
  tokenStorage: 'memory' | 'session' | 'secure';
  autoRefresh: boolean;
}

/**
 * Type generation configuration (safe)
 */
export interface TypeGenerationConfig {
  sourceUrl: string;  // PostgREST OpenAPI endpoint
  outputPath: string;
  includeComments: boolean;
  includeExamples: boolean;
  customTypes?: Record<string, string>;
}

/**
 * Migration configuration (backend only)
 */
export interface MigrationConfig {
  directory: string;
  tableName: string;
  schema: string;
  runOnStartup: boolean;
}

/**
 * Docker configuration (backend only)
 */
export interface DockerConfig {
  postgres: {
    image: string;
    port: number;
    database: string;
    username: string;  // From env
    password: string;  // From env
  };
  postgrest: {
    image: string;
    port: number;
  };
  network: string;
}

/**
 * Deployment targets
 */
export type DeploymentTarget = 
  | 'vercel'
  | 'netlify' 
  | 'cloudflare'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'docker'
  | 'kubernetes';

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  target: DeploymentTarget;
  frontend?: {
    url: string;
    buildCommand: string;
    outputDir: string;
  };
  backend?: {
    url: string;
    healthCheck: string;
    secrets: string[];  // Secret names only, not values
  };
}

/**
 * Security audit result
 */
export interface SecurityAuditResult {
  passed: boolean;
  score: number;  // 0-100
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  window: number;  // Seconds
  maxRequests: number;
  keyGenerator: 'ip' | 'user' | 'custom';
  skipAuth: boolean;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origins: string[] | '*';
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Error types for security violations
 */
export enum SecurityErrorType {
  CREDENTIAL_EXPOSURE = 'CREDENTIAL_EXPOSURE',
  INSECURE_TRANSPORT = 'INSECURE_TRANSPORT',
  WEAK_SECRET = 'WEAK_SECRET',
  MISSING_AUTH = 'MISSING_AUTH',
  INVALID_CORS = 'INVALID_CORS',
  RATE_LIMIT_BYPASS = 'RATE_LIMIT_BYPASS'
}

/**
 * Security error with details
 */
export interface SecurityError {
  type: SecurityErrorType;
  message: string;
  file?: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fix?: string;
}

/**
 * File template for code generation
 */
export interface FileTemplate {
  content: string;
  variables?: Record<string, string>;
}