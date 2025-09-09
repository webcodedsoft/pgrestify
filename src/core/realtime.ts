/**
 * Real-time subscriptions for PostgREST using WebSockets or Server-Sent Events
 */

import type {
  RealtimeSubscription,
  PostgresChangesPayload,
  PostgresChangesFilter,
  SubscriptionCallback,
  AuthManager,
} from '../types';

export interface RealtimeConfig {
  /** WebSocket URL for real-time connection */
  url: string;
  
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  
  /** Reconnection settings */
  reconnect?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
  };

  /** Authentication for real-time connection */
  auth?: {
    token?: string;
  };
}

export interface RealtimeChannel {
  subscribe: () => RealtimeSubscription;
  unsubscribe: () => void;
  on: (event: string, callback: SubscriptionCallback) => RealtimeChannel;
}

/**
 * Real-time client for PostgREST changes
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private readonly channels = new Map<string, RealtimeChannel>();
  private reconnectAttempts = 0;
  private heartbeatTimer?: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer?: ReturnType<typeof setTimeout> | undefined;
  private _isConnected = false;
  private readonly eventCallbacks = new Map<string, Set<SubscriptionCallback>>();

  constructor(
    private readonly config: RealtimeConfig,
    private readonly auth?: AuthManager
  ) {}

  get isConnected(): boolean {
    return this._isConnected;
  }

  get authManager(): AuthManager | undefined {
    return this.auth;
  }

  /**
   * Connect to real-time server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const wsUrl = this.buildWebSocketUrl();
    this.ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('Failed to create WebSocket'));

      this.ws.onopen = () => {
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this.stopHeartbeat();
        this.handleReconnection();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  /**
   * Disconnect from real-time server
   */
  disconnect = (): void => {
    this._isConnected = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear all channels
    this.channels.clear();
    this.eventCallbacks.clear();
  }

  /**
   * Create a channel for table changes
   */
  channel(
    tableName: string,
    filter?: PostgresChangesFilter
  ): RealtimeChannel {
    const channelName = this.buildChannelName(tableName, filter);
    
    if (!this.channels.has(channelName)) {
      const channel = new RealtimeChannelImpl(
        tableName,
        filter,
        this
      );
      this.channels.set(channelName, channel);
    }

    return this.channels.get(channelName)!;
  }

  /**
   * Subscribe to changes on a specific table
   */
  from(tableName: string): RealtimeTableBuilder {
    return new RealtimeTableBuilder(tableName, this);
  }

  /**
   * Internal method to handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'postgres_changes') {
        this.handlePostgresChanges(data.payload);
      } else if (data.type === 'heartbeat') {
        // Handle heartbeat response
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle PostgreSQL changes
   */
  private handlePostgresChanges(payload: PostgresChangesPayload): void {
    const eventKey = `${payload.schema}:${payload.table}:${payload.eventType}`;
    const callbacks = this.eventCallbacks.get(eventKey);
    
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      });
    }

    // Also trigger generic table callbacks
    const tableEventKey = `${payload.schema}:${payload.table}:*`;
    const tableCallbacks = this.eventCallbacks.get(tableEventKey);
    
    if (tableCallbacks) {
      tableCallbacks.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      });
    }
  }

  /**
   * Add callback for specific event
   */
  addCallback(eventKey: string, callback: SubscriptionCallback): void {
    if (!this.eventCallbacks.has(eventKey)) {
      this.eventCallbacks.set(eventKey, new Set());
    }
    this.eventCallbacks.get(eventKey)!.add(callback);
  }

  /**
   * Remove callback for specific event
   */
  removeCallback(eventKey: string, callback: SubscriptionCallback): void {
    const callbacks = this.eventCallbacks.get(eventKey);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.eventCallbacks.delete(eventKey);
      }
    }
  }

  /**
   * Build WebSocket URL
   */
  private buildWebSocketUrl(): string {
    if (!this.config.url) {
      throw new Error('Real-time URL is required');
    }

    const url = new URL(this.config.url);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Add authentication if available
    if (this.config.auth?.token) {
      url.searchParams.set('token', this.config.auth.token);
    }

    return url.toString();
  }

  /**
   * Build channel name for subscription
   */
  private buildChannelName(tableName: string, filter?: PostgresChangesFilter): string {
    let name = `realtime:${tableName}`;
    
    if (filter) {
      if (filter.schema) name += `:${filter.schema}`;
      if (filter.filter) name += `:${filter.filter}`;
    }

    return name;
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000; // 30 seconds
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, interval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(): void {
    const reconnectConfig = this.config.reconnect;
    
    if (!reconnectConfig?.enabled) {
      return;
    }

    if (this.reconnectAttempts >= reconnectConfig.maxAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = reconnectConfig.delay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${reconnectConfig.maxAttempts})`);
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined as unknown as ReturnType<typeof setTimeout>;
    }
  }
}

/**
 * Real-time channel implementation
 */
class RealtimeChannelImpl implements RealtimeChannel {
  private readonly callbacks = new Map<string, Set<SubscriptionCallback>>();
  private isSubscribed = false;

  constructor(
    private readonly tableName: string,
    private readonly filter: PostgresChangesFilter | undefined,
    private readonly client: RealtimeClient
  ) {}

  on(event: string, callback: SubscriptionCallback): RealtimeChannel {
    const eventKey = this.buildEventKey(event);
    
    if (!this.callbacks.has(eventKey)) {
      this.callbacks.set(eventKey, new Set());
    }
    
    this.callbacks.get(eventKey)!.add(callback);
    this.client.addCallback(eventKey, callback);

    return this;
  }

  subscribe(): RealtimeSubscription {
    if (!this.isSubscribed) {
      this.isSubscribed = true;
      // Send subscription message to server
      // This would depend on your WebSocket protocol
    }

    return {
      unsubscribe: () => this.unsubscribe(),
    };
  }

  unsubscribe(): void {
    if (this.isSubscribed) {
      this.isSubscribed = false;
      
      // Remove all callbacks
      for (const [eventKey, callbacks] of this.callbacks) {
        callbacks.forEach(callback => {
          this.client.removeCallback(eventKey, callback);
        });
      }
      
      this.callbacks.clear();
    }
  }

  private buildEventKey(event: string): string {
    const schema = this.filter?.schema || 'public';
    return `${schema}:${this.tableName}:${event}`;
  }
}

/**
 * Builder for table-specific real-time subscriptions
 */
class RealtimeTableBuilder {
  constructor(
    private readonly tableName: string,
    private readonly client: RealtimeClient
  ) {}

  /**
   * Subscribe to INSERT events
   */
  on(
    event: import('../types').RealtimeEvent | 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: SubscriptionCallback,
    filter?: PostgresChangesFilter
  ): RealtimeSubscription {
    const channel = this.client.channel(this.tableName, filter);
    channel.on(event, callback);
    return channel.subscribe();
  }

  /**
   * Subscribe to all events
   */
  onAll(callback: SubscriptionCallback): RealtimeSubscription {
    return this.on('*', callback);
  }

  /**
   * Subscribe to INSERT events only
   */
  onInsert(callback: SubscriptionCallback): RealtimeSubscription {
    return this.on('INSERT', callback);
  }

  /**
   * Subscribe to UPDATE events only
   */
  onUpdate(callback: SubscriptionCallback): RealtimeSubscription {
    return this.on('UPDATE', callback);
  }

  /**
   * Subscribe to DELETE events only
   */
  onDelete(callback: SubscriptionCallback): RealtimeSubscription {
    return this.on('DELETE', callback);
  }
}

/**
 * Helper functions for real-time subscriptions
 */
export class RealtimeHelpers {
  /**
   * Create a real-time client with default configuration
   */
  static createClient(
    url: string,
    options?: Partial<RealtimeConfig>
  ): RealtimeClient {
    return new RealtimeClient({
      url,
      heartbeatInterval: 30000,
      reconnect: {
        enabled: true,
        maxAttempts: 5,
        delay: 1000,
      },
      ...options,
    });
  }

  /**
   * Create a real-time client from PostgREST URL
   */
  static fromPostgRESTUrl(
    postgrestUrl: string,
    options?: Partial<RealtimeConfig>
  ): RealtimeClient {
    // Convert HTTP URL to WebSocket URL
    const url = new URL(postgrestUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/realtime/v1/websocket';

    return this.createClient(url.toString(), options);
  }
}