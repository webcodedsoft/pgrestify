# Configuration

PGRestify offers comprehensive configuration options to customize your client's behavior and adapt to various environments.

## Basic Configuration

```typescript
import { createClient } from 'pgrestify';

const client = createClient({
  // Required: PostgREST URL
  url: 'http://localhost:3000',
  
  // Optional: JWT token for authenticated requests
  token: 'your-jwt-token',
  
  // Optional: Default role
  role: 'authenticated',
  
  // Optional: Database schema
  schema: 'public'
});
```

## Advanced Configuration Options

### Authentication Settings

```typescript
const client = createClient({
  auth: {
    // Automatically refresh expired tokens
    autoRefreshToken: true,
    
    // Persist session between page reloads
    persistSession: true,
    
    // Detect session from URL (useful for OAuth)
    detectSessionInUrl: true
  }
});
```

### Caching Configuration

```typescript
const client = createClient({
  cache: {
    // Enable intelligent caching
    enabled: true,
    
    // Time-to-live for cached queries (in milliseconds)
    ttl: 300000, // 5 minutes
    
    // Custom cache storage (optional)
    storage: customCacheStorage
  }
});
```

### Real-time Configuration

```typescript
const client = createClient({
  realtime: {
    // Enable real-time subscriptions
    enabled: true,
    
    // Custom WebSocket URL
    url: 'ws://localhost:3000/realtime',
    
    // Reconnection settings
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      delay: 1000 // milliseconds
    }
  }
});
```

### CORS Configuration

```typescript
const client = createClient({
  cors: {
    // Allowed origins
    origins: ['https://myapp.com', 'http://localhost:3000'],
    
    // Allow credentials
    credentials: true,
    
    // Allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
```

## Environment-Based Configuration

```typescript
const client = createClient({
  url: process.env.POSTGREST_URL,
  token: process.env.JWT_TOKEN,
  role: process.env.APP_ROLE
});
```

## Best Practices

- Always use environment variables for sensitive configuration
- Set appropriate cache TTL based on data volatility
- Configure CORS strictly for production environments
- Use role-based access control for enhanced security

## Troubleshooting

- Verify your PostgREST URL is correct
- Check network connectivity
- Ensure proper JWT token format
- Validate schema and role permissions