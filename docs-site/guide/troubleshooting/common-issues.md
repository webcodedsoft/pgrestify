# Troubleshooting Guide

Comprehensive troubleshooting guide for common issues with PGRestify.

## Database Setup Issues

### Credential Configuration Problems (NEW)

**Symptoms:**
- Database connection errors after running `pgrestify setup database`
- "password authentication failed" errors
- Configuration files not updating properly

**Solutions:**

1. **Verify Configuration Updates**
   ```bash
   # Check if pgrestify.config.ts was updated
   cat pgrestify.config.ts | grep "url:"
   
   # Check if .env.example was updated
   cat .env.example | grep "DATABASE_URL"
   ```

2. **Regenerate All Files**
   ```bash
   # Force regeneration of all dependent files
   pgrestify setup database --regenerate-all
   ```

3. **Manual Credential Update**
   If automatic update fails, manually edit `pgrestify.config.ts`:
   ```typescript
   database: {
     url: 'postgresql://username:password@localhost:5432/dbname',
     schemas: ['api']
   }
   ```

4. **Admin Credentials for Database Creation**
   ```bash
   # Set admin credentials environment variable
   export ADMIN_DATABASE_URL='postgresql://postgres:admin_pass@localhost:5432/postgres'
   pgrestify setup database --regenerate-all
   ```

### Database Creation Errors

**Symptoms:**
- "database does not exist" errors
- Permission denied when creating database
- Role/user creation failures

**Solutions:**

1. **Use Admin User for Setup**
   ```bash
   # Run setup script with postgres admin user
   sudo -u postgres psql -f sql/setup-database.sql
   ```

2. **Manual Database Creation**
   ```sql
   -- Connect as postgres admin
   CREATE DATABASE your_db_name;
   CREATE USER your_username WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE your_db_name TO your_username;
   ```

3. **Check PostgreSQL Service**
   ```bash
   # Verify PostgreSQL is running
   systemctl status postgresql  # Linux
   brew services list           # macOS with Homebrew
   ```

## Connection Issues

### PostgREST Connection Failed

**Symptoms:**
- Unable to connect to PostgREST
- Network errors
- Connection timeout

**Troubleshooting Steps:**

1. **Verify PostgREST is Running**
   ```bash
   # Check PostgREST service
   curl http://localhost:3000
   ```

2. **Check Environment Variables**
   ```typescript
   // Verify POSTGREST_URL
   console.log(process.env.POSTGREST_URL);
   ```

3. **Network Connectivity**
   ```typescript
   import { createClient } from 'pgrestify';

   async function testConnection() {
     try {
       const client = createClient('http://localhost:3000');
       await client.from('test_table').select('*').limit(1);
     } catch (error) {
       console.error('Connection error:', error);
     }
   }
   ```

## Authentication Problems

### JWT Token Issues

**Symptoms:**
- 401 Unauthorized errors
- Token validation failures

**Troubleshooting:**

```typescript
import { createClient } from 'pgrestify';

const client = createClient('http://localhost:3000', {
  // Enable detailed token logging
  auth: {
    debug: true,
    validateToken: (token) => {
      // Custom token validation
      console.log('Token details:', decodeJWT(token));
    }
  }
});
```

## TypeScript Errors

### Common Type-Related Issues

1. **Incorrect Type Definitions**
   ```typescript
   // Ensure correct interface definition
   interface User {
     id: number;
     name: string;
     email: string;
   }

   // Use type generics correctly
   const userRepo = client.getRepository<User>('users');
   ```

2. **Strict Mode Configurations**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true
     }
   }
   ```

## Performance and Optimization

### Slow Queries

**Debugging Techniques:**

```typescript
const client = createClient('http://localhost:3000', {
  performance: {
    // Enable query logging
    logSlowQueries: true,
    slowQueryThreshold: 500 // ms
  }
});
```

## CORS and Browser Issues

### Cross-Origin Errors

**PostgREST CORS Configuration:**
```ini
# postgrest.conf
server-cors-allowed-origins = "http://localhost:3000"
server-cors-max-age = 86400
```

**Client-Side Configuration:**
```typescript
const client = createClient('http://localhost:3000', {
  cors: {
    origins: ['http://localhost:3000'],
    credentials: true
  }
});
```

## Debugging Techniques

### Logging and Monitoring

```typescript
const client = createClient('http://localhost:3000', {
  logging: {
    level: 'debug',
    format: 'json',
    transport: {
      type: 'console', // or 'file'
      options: {
        filename: 'pgrestify.log'
      }
    }
  }
});
```

## Common Error Types

```typescript
enum PGRestifyErrorType {
  NETWORK_ERROR = 'NetworkError',
  AUTH_ERROR = 'AuthenticationError',
  VALIDATION_ERROR = 'ValidationError',
  NOT_FOUND = 'NotFoundError'
}

function handlePGRestifyError(error: Error) {
  switch (error.name) {
    case PGRestifyErrorType.NETWORK_ERROR:
      // Handle network issues
      break;
    case PGRestifyErrorType.AUTH_ERROR:
      // Handle authentication problems
      break;
  }
}
```

## Environment-Specific Troubleshooting

### Development vs Production

```typescript
const client = createClient(process.env.POSTGREST_URL, {
  // Different configurations per environment
  ...(process.env.NODE_ENV === 'development' && {
    logging: { level: 'debug' },
    performance: { logSlowQueries: true }
  }),
  
  ...(process.env.NODE_ENV === 'production' && {
    logging: { level: 'error' },
    performance: { 
      logSlowQueries: false,
      slowQueryThreshold: 200 
    }
  })
});
```

## Getting Help

1. **Check Documentation**
   - [Official Documentation](https://pgrestify.dev)
   - [GitHub Issues](https://github.com/pgrestify/pgrestify/issues)

2. **Community Support**
   - [Discord Community](https://discord.gg/pgrestify)
   - [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/pgrestify)

3. **Reporting Issues**
   - Provide detailed error messages
   - Include minimal reproducible example
   - Specify your environment (Node.js version, PGRestify version)

## Best Practices

- Keep dependencies updated
- Use environment variables for configuration
- Implement proper error handling
- Monitor performance
- Use type safety
- Follow security best practices

## Recommended Tools

- **Debugging:** 
  - Node.js Inspector
  - Chrome DevTools
  - VS Code Debugger

- **Monitoring:**
  - Prometheus
  - Grafana
  - New Relic

## Disclaimer

Troubleshooting is an iterative process. Be patient, methodical, and don't hesitate to seek community support.