# Real-time Subscriptions

PGRestify provides comprehensive real-time capabilities through WebSocket connections, enabling applications to receive live updates for database changes. The real-time system supports event subscriptions, filtering, automatic reconnection, and scaling considerations.

## Basic Setup

### WebSocket Connection

Configure real-time connections when creating your client:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000',
  realtime: {
    url: 'ws://localhost:3001', // WebSocket URL
    heartbeatInterval: 30000,   // 30 seconds
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      delay: 1000
    }
  }
});
```

### Connection Management

```typescript
// Connect to real-time server
await client.realtime.connect();

// Check connection status
console.log('Connected:', client.realtime.isConnected);

// Listen for connection events
client.realtime.on('connect', () => {
  console.log('Real-time connection established');
});

client.realtime.on('disconnect', () => {
  console.log('Real-time connection lost');
});

client.realtime.on('reconnect', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});
```

## Event Subscriptions

### Basic Table Subscriptions

Subscribe to changes on specific tables:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

// Subscribe to all changes on users table
const userSubscription = client.realtime
  .channel('users')
  .on('*', (payload) => {
    console.log('User change:', payload);
    
    switch (payload.eventType) {
      case 'INSERT':
        console.log('New user:', payload.new);
        break;
      case 'UPDATE':
        console.log('Updated user:', payload.new);
        console.log('Previous data:', payload.old);
        break;
      case 'DELETE':
        console.log('Deleted user:', payload.old);
        break;
    }
  })
  .subscribe();

// Unsubscribe when done
// userSubscription.unsubscribe();
```

### Event-Specific Subscriptions

Listen to specific types of database events:

```typescript
// Listen only to new records
client.realtime
  .channel('posts')
  .on('INSERT', (payload) => {
    console.log('New post created:', payload.new);
    // Update UI with new post
    addPostToList(payload.new);
  })
  .subscribe();

// Listen only to updates
client.realtime
  .channel('users')
  .on('UPDATE', (payload) => {
    console.log('User updated:', payload.new);
    // Update user profile in UI
    updateUserProfile(payload.new);
  })
  .subscribe();

// Listen only to deletions
client.realtime
  .channel('comments')
  .on('DELETE', (payload) => {
    console.log('Comment deleted:', payload.old);
    // Remove comment from UI
    removeCommentFromList(payload.old.id);
  })
  .subscribe();
```

## React Integration

### useRealtimeSubscription Hook

```typescript
import { useEffect, useState } from 'react';
import { useRealtimeSubscription } from '@webcoded/pgrestify/react';

function LivePostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  
  // Subscribe to real-time updates
  useRealtimeSubscription('posts', {
    event: '*',
    onInsert: (post) => {
      setPosts(prev => [post, ...prev]);
    },
    onUpdate: (post) => {
      setPosts(prev => prev.map(p => 
        p.id === post.id ? { ...p, ...post } : p
      ));
    },
    onDelete: (post) => {
      setPosts(prev => prev.filter(p => p.id !== post.id));
    }
  });
  
  return (
    <div>
      <h2>Live Posts ({posts.length})</h2>
      {posts.map(post => (
        <div key={post.id} className="post">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  );
}
```

## Reconnection Handling

### Automatic Reconnection

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  realtime: {
    url: 'ws://localhost:3001',
    reconnect: {
      enabled: true,
      maxAttempts: 10,        // Try 10 times
      delay: 1000,            // Start with 1 second
      delayMultiplier: 1.5,   // Exponential backoff
      maxDelay: 30000         // Max 30 seconds between attempts
    }
  }
});
```

### Connection State Management

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

function useConnectionState() {
  const [state, setState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const client = usePGRestifyClient();
    
    client.realtime.on('connecting', () => {
      setState(ConnectionState.CONNECTING);
      setError(null);
    });
    
    client.realtime.on('connect', () => {
      setState(ConnectionState.CONNECTED);
      setError(null);
    });
    
    client.realtime.on('disconnect', () => {
      setState(ConnectionState.DISCONNECTED);
    });
    
    client.realtime.on('reconnecting', () => {
      setState(ConnectionState.RECONNECTING);
    });
    
    client.realtime.on('error', (err: Error) => {
      setState(ConnectionState.ERROR);
      setError(err.message);
    });
  }, []);
  
  return { state, error };
}
```

## Best Practices

### 1. Subscription Management

```typescript
// Good: Use subscription managers
class SubscriptionManager {
  private subscriptions = new Map<string, Function>();
  
  add(key: string, unsubscribe: Function) {
    // Clean up existing subscription
    this.remove(key);
    this.subscriptions.set(key, unsubscribe);
  }
  
  remove(key: string) {
    const unsubscribe = this.subscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(key);
    }
  }
  
  removeAll() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }
}
```

### 2. Error Handling

```typescript
// Robust error handling for real-time subscriptions
client.realtime
  .channel('posts')
  .on('*', (payload) => {
    try {
      handleRealtimeUpdate(payload);
    } catch (error) {
      console.error('Error handling real-time update:', error);
      // Log error to monitoring service
      logError('realtime_handler_error', error, payload);
      
      // Optionally refresh data as fallback
      refreshDataFromServer();
    }
  })
  .on('error', (error) => {
    console.error('Real-time channel error:', error);
    // Handle channel-specific errors
  })
  .subscribe();
```

## Summary

PGRestify's real-time system provides:

- **WebSocket Connections**: Persistent, low-latency real-time communication
- **Event Subscriptions**: Subscribe to INSERT, UPDATE, DELETE events on specific tables
- **Automatic Reconnection**: Robust reconnection handling with exponential backoff
- **React Integration**: Purpose-built hooks for React applications
- **Error Resilience**: Comprehensive error handling and fallback mechanisms

Real-time subscriptions enable building responsive, collaborative applications with live data updates and excellent user experiences.