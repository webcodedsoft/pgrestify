# Environment Variables

PGRestify provides flexible environment variable configuration for seamless deployment across different environments.

## Basic Environment Configuration

```typescript
// .env file
PGRESTIFY_URL=http://localhost:3000
PGRESTIFY_TOKEN=your-jwt-token
PGRESTIFY_ROLE=authenticated
```

## Client Initialization with Environment Variables

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: process.env.PGRESTIFY_URL,
  token: process.env.PGRESTIFY_TOKEN,
  role: process.env.PGRESTIFY_ROLE
});
```

## Comprehensive Environment Configuration

```typescript
const client = createClient({
  // Basic connection
  url: process.env.POSTGREST_URL,
  
  // Authentication
  token: process.env.JWT_TOKEN,
  role: process.env.APP_ROLE,
  
  // Database configuration
  schema: process.env.DB_SCHEMA || 'public',
  
  // CORS settings
  cors: {
    origins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },
  
  // Caching
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '300000')
  },
  
  // Real-time configuration
  realtime: {
    enabled: process.env.REALTIME_ENABLED === 'true',
    url: process.env.REALTIME_URL
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'warn'
  }
});
```

## Environment-Specific Configurations

```typescript
// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const client = createClient({
  url: isDevelopment 
    ? 'http://localhost:3000' 
    : isProduction 
      ? 'https://api.myapp.com' 
      : 'https://staging-api.myapp.com',
  
  // Environment-specific settings
  ...(isDevelopment && {
    logging: { level: 'debug' },
    cache: { enabled: false }
  }),
  
  ...(isProduction && {
    logging: { level: 'error' },
    cache: { 
      enabled: true,
      ttl: 600000 // 10 minutes
    }
  })
});
```

## Secure Secrets Management

```typescript
// Using a secrets management service
const client = createClient({
  url: process.env.POSTGREST_URL,
  token: getSecretFromVault('JWT_TOKEN'),
  
  // Additional secure configuration
  auth: {
    secretKey: getSecretFromVault('AUTH_SECRET_KEY'),
    encryptionKey: getSecretFromVault('ENCRYPTION_KEY')
  }
});

// Example vault retrieval function
function getSecretFromVault(secretName: string): string {
  // Implement secure secret retrieval
  // Could use AWS Secrets Manager, HashiCorp Vault, etc.
  return secretManagerClient.getSecret(secretName);
}
```

## Docker and Containerized Environments

```typescript
const client = createClient({
  // Automatic Docker service discovery
  url: process.env.POSTGREST_SERVICE_HOST 
    ? `http://${process.env.POSTGREST_SERVICE_HOST}:${process.env.POSTGREST_SERVICE_PORT}` 
    : 'http://localhost:3000',
  
  // Docker-specific retry logic
  retry: {
    enabled: true,
    maxAttempts: parseInt(process.env.RETRY_ATTEMPTS || '5'),
    delay: parseInt(process.env.RETRY_DELAY || '2000'),
    
    // Retry only on connection-related errors
    shouldRetry: (error) => 
      error.code === 'ECONNREFUSED' || 
      error.name === 'NetworkError'
  }
});
```

## Kubernetes and Cluster Environments

```typescript
const client = createClient({
  // Kubernetes service discovery
  url: process.env.KUBERNETES_SERVICE_HOST
    ? `http://${process.env.KUBERNETES_SERVICE_HOST}/postgrest`
    : 'http://localhost:3000',
  
  // Cluster-specific configuration
  cluster: {
    enabled: process.env.CLUSTER_MODE === 'true',
    nodeId: process.env.CLUSTER_NODE_ID
  }
});
```

## Environment Variable Validation

```typescript
function validateEnvironment() {
  const requiredVars = [
    'POSTGREST_URL', 
    'JWT_TOKEN', 
    'APP_ROLE'
  ];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  });
}

// Call validation before client initialization
validateEnvironment();
const client = createClient({...});
```

## Best Practices

- Use `.env` files for local development
- Never commit secrets to version control
- Use different `.env` files per environment
- Validate environment variables
- Use secure secret management services
- Implement fallback values
- Log configuration (without sensitive data)
- Rotate secrets regularly

## Security Considerations

- Encrypt sensitive environment variables
- Use least-privilege principle
- Avoid hardcoding secrets
- Implement proper access controls
- Use environment-specific configurations
- Sanitize and validate all environment inputs

## Troubleshooting

- Check environment variable spelling
- Verify variable values
- Use logging to diagnose configuration issues
- Validate environment-specific settings
- Check secret management integration

## Framework-Specific Notes

### Next.js

```typescript
// next.config.js
module.exports = {
  env: {
    POSTGREST_URL: process.env.POSTGREST_URL,
    JWT_TOKEN: process.env.JWT_TOKEN
  }
};
```

### Create React App

```typescript
// .env file
REACT_APP_POSTGREST_URL=http://localhost:3000
REACT_APP_JWT_TOKEN=your-token
```

## Performance Monitoring

```typescript
const client = createClient({
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    reportUrl: process.env.MONITORING_REPORT_URL,
    
    // Performance tracking
    trackEnvConfig: true
  }
});
```