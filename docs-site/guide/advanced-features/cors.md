# CORS Configuration

PGRestify provides comprehensive Cross-Origin Resource Sharing (CORS) configuration to secure and manage cross-origin requests.

## Basic CORS Setup

```typescript
import { createClient } from 'pgrestify';

const client = createClient('http://localhost:3000', {
  cors: {
    // Enable CORS with default settings
    enabled: true
  }
});
```

## Detailed CORS Configuration

```typescript
const client = createClient('http://localhost:3000', {
  cors: {
    // Allowed origins
    origins: [
      'https://myapp.com',
      'http://localhost:3000',
      'https://staging.myapp.com'
    ],

    // HTTP methods allowed
    methods: [
      'GET', 
      'POST', 
      'PUT', 
      'DELETE', 
      'PATCH', 
      'OPTIONS'
    ],

    // Allow credentials (cookies, authorization headers)
    credentials: true,

    // Allowed headers
    headers: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With'
    ],

    // Headers exposed to the browser
    exposedHeaders: [
      'Content-Range', 
      'X-Content-Range'
    ],

    // How long preflight request can be cached
    maxAge: 86400 // 24 hours
  }
});
```

## Dynamic Origin Validation

```typescript
const client = createClient('http://localhost:3000', {
  cors: {
    // Dynamic origin validation function
    origins: (origin) => {
      // Custom origin validation logic
      const allowedDomains = [
        'https://myapp.com',
        'http://localhost:3000'
      ];

      return allowedDomains.includes(origin) || 
             origin?.endsWith('.myapp.com');
    }
  }
});
```

## Environment-Based Configuration

```typescript
const client = createClient('http://localhost:3000', {
  cors: {
    origins: process.env.NODE_ENV === 'production'
      ? ['https://myapp.com', 'https://api.myapp.com']
      : ['http://localhost:3000', 'http://localhost:3001']
  }
});
```

## Strict Security Configuration

```typescript
const client = createClient('http://localhost:3000', {
  cors: {
    // Highly restrictive CORS settings
    origins: ['https://myapp.com'],
    methods: ['GET', 'POST'],
    credentials: false,
    headers: ['Content-Type'],
    
    // Additional security options
    strictOriginCheck: true,
    blockUnsafeOrigins: true
  }
});
```

## Handling Preflight Requests

```typescript
// Automatic preflight request handling
const client = createClient('http://localhost:3000', {
  cors: {
    // Customize preflight response
    preflight: {
      // Custom headers for preflight
      additionalHeaders: {
        'X-Preflight-Validated': 'true'
      },
      
      // Custom status code
      statusCode: 200
    }
  }
});
```

## Logging and Monitoring

```typescript
const client = createClient('http://localhost:3000', {
  cors: {
    // Log CORS-related events
    logging: {
      enabled: true,
      level: 'warn',
      
      // Custom logging handler
      handler: (event) => {
        switch (event.type) {
          case 'origin_blocked':
            console.warn(`Blocked origin: ${event.origin}`);
            break;
          case 'preflight_request':
            console.log(`Preflight from: ${event.origin}`);
            break;
        }
      }
    }
  }
});
```

## Error Handling

```typescript
try {
  const data = await client
    .from('users')
    .select('*')
    .execute();
} catch (error) {
  if (error.name === 'CORSError') {
    // Handle CORS-related errors
    console.error('CORS configuration error:', error.message);
    
    // Potential recovery or fallback mechanism
    fallbackToDefaultCORS();
  }
}
```

## Best Practices

- Be as specific as possible with allowed origins
- Use environment-based configuration
- Implement dynamic origin validation
- Limit allowed methods and headers
- Enable credentials only when necessary
- Log and monitor CORS-related events
- Regularly review and update CORS settings

## Security Considerations

- Never use wildcard `*` in production
- Validate and sanitize origins
- Use HTTPS for all production origins
- Implement additional authentication layers
- Rotate and update allowed origins
- Monitor for potential CORS misconfigurations

## Performance Implications

- CORS checks add minimal overhead
- Caching preflight requests reduces latency
- Use efficient origin validation functions
- Minimize the number of allowed origins
- Consider using a CDN or reverse proxy for advanced CORS management

## Framework-Specific Notes

### Next.js

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://myapp.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' }
        ]
      }
    ];
  }
};
```

### Express.js

```typescript
import cors from 'cors';
import express from 'express';

const app = express();

app.use(cors({
  origin: 'https://myapp.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Troubleshooting

- Check browser console for CORS errors
- Verify server and client configurations match
- Ensure all origins use consistent protocols
- Validate headers and methods
- Test with different browsers and environments