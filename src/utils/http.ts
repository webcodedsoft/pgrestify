/**
 * HTTP client implementation with retry logic and error handling
 */

import { 
  createErrorFromResponse, 
  NetworkError, 
  isRetriableError 
} from '../types/errors';
import type { 
  HttpClient, 
  HttpResponse, 
  RetryConfig 
} from '../types';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  attempts: 3,
  delay: 1000,
  backoff: 2,
  shouldRetry: (error: Error, attempt: number) => {
    if (attempt >= 3) return false;
    return isRetriableError(error);
  },
};

/**
 * Fetch-based HTTP client with retry logic and error handling
 */
export class FetchHttpClient implements HttpClient {
  private retryConfig: RetryConfig;

  constructor(
    private readonly baseUrl: string,
    private defaultHeaders: Record<string, string> = {},
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    
    // Ensure baseUrl doesn't end with a slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    
    // Bind fetch to maintain context
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async get<T = unknown>(
    url: string, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, headers);
  }

  async post<T = unknown>(
    url: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, data, headers);
  }

  async patch<T = unknown>(
    url: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', url, data, headers);
  }

  async put<T = unknown>(
    url: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, data, headers);
  }

  async delete<T = unknown>(
    url: string, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, headers);
  }

  async head(
    url: string, 
    headers?: Record<string, string>
  ): Promise<HttpResponse<never>> {
    return this.request<never>('HEAD', url, undefined, headers);
  }

  /**
   * Main request method with retry logic
   */
  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    headers?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<HttpResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const requestHeaders = this.buildHeaders(method, data, headers);

    let lastError: Error;

    for (let attempt = 0; attempt < this.retryConfig.attempts; attempt++) {
      try {
        const timeoutController = new AbortController();
        const combinedSignal = this.combineAbortSignals(signal, timeoutController.signal);
        
        // Set timeout for request
        const timeoutId = setTimeout(() => timeoutController.abort(), 30000); // 30s timeout

        const body = this.prepareBody(method, data);
        const response = await this.fetchImpl(fullUrl, {
          method,
          headers: requestHeaders,
          body: body ?? null,
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await createErrorFromResponse(response);
          
          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            lastError = error;
            break;
          }
          
          lastError = error;
        }

        const responseData = await this.parseResponseData<T>(response, method);
        const responseHeaders = this.extractHeaders(response.headers);

        return {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        };

      } catch (error) {
        lastError = this.handleRequestError(error as Error);
        
        // Check if we should retry
        if (
          attempt < this.retryConfig.attempts - 1 && 
          this.retryConfig.shouldRetry(lastError, attempt)
        ) {
          const delay = this.retryConfig.delay * Math.pow(this.retryConfig.backoff, attempt);
          await this.delay(delay);
          continue;
        }
        
        break;
      }
    }

    throw lastError!;
  }

  /**
   * Build request headers
   */
  private buildHeaders(
    method: string,
    data: unknown,
    customHeaders?: Record<string, string>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...customHeaders,
    };

    // Add content-type for requests with body
    if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    // Add accept header if not present
    if (!headers['Accept'] && !headers['accept']) {
      headers['Accept'] = 'application/json';
    }

    return headers;
  }

  /**
   * Prepare request body
   */
  private prepareBody(method: string, data: unknown): string | FormData | undefined {
    if (data === undefined || method === 'GET' || method === 'HEAD') {
      return undefined;
    }

    if (data instanceof FormData) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    return JSON.stringify(data);
  }

  /**
   * Parse response data based on content type
   */
  private async parseResponseData<T>(response: Response, method: string): Promise<T> {
    if (method === 'HEAD') {
      return null as T;
    }

    const contentType = response.headers.get('content-type');
    
    if (!contentType) {
      const text = await response.text();
      return (text as unknown) as T;
    }

    if (contentType.includes('application/json') || contentType.includes('application/vnd.pgrst')) {
      const text = await response.text();
      return text ? JSON.parse(text) : null as T;
    }

    if (contentType.includes('text/')) {
      return (await response.text()) as unknown as T;
    }

    // For binary data, return as ArrayBuffer
    return (await response.arrayBuffer()) as unknown as T;
  }

  /**
   * Extract headers from Response
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }

  /**
   * Handle and normalize request errors
   */
  private handleRequestError(error: Error): Error {
    if (error.name === 'AbortError') {
      return new NetworkError('Request was aborted', error, true);
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError('Network request failed', error, false);
    }

    // Return the error as-is if it's already a PostgREST error
    if ('statusCode' in error) {
      return error;
    }

    return new NetworkError('Request failed', error, false);
  }

  /**
   * Combine multiple AbortSignals
   */
  private combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const validSignals = signals.filter((signal): signal is AbortSignal => 
      signal !== undefined
    );

    if (validSignals.length === 0) {
      return new AbortController().signal;
    }

    if (validSignals.length === 1) {
      return validSignals[0]!;
    }

    const controller = new AbortController();

    for (const signal of validSignals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }

  /**
   * Delay execution for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update default headers
   */
  public setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * Remove default header
   */
  public removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  /**
   * Get current default headers
   */
  public getDefaultHeaders(): Record<string, string> {
    return { ...this.defaultHeaders };
  }

  /**
   * Update retry configuration
   */
  public setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Get current retry configuration
   */
  public getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}