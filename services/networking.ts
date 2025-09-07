import { BASE_API_URL } from '../app/config/env';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface NetworkTarget {
  path: string;
  method: HTTPMethod;
  params?: Record<string, any>; // For query parameters (appended to URL, e.g. GET)
  headers?: Record<string, string>;
  shouldCache?: boolean;
  body?: any;
  timeoutMs?: number;
  retries?: number; // Optional: number of retry attempts
}

// Simple in-memory cache
interface CacheEntry {
  data: { body: any; status: number };
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to generate cache key
function getCacheKey(url: string, method: string, body?: any): string {
  const bodyHash = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyHash}`;
}

// Helper to check if cache entry is valid
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < entry.ttl;
}

// Helper to build query string from params
function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const esc = encodeURIComponent;
  return (
    '?' +
    Object.keys(params)
      .map(k => esc(k) + '=' + esc(params[k]))
      .join('&')
  );
}

// Main request function
export async function makeRequest<T = any>(
  target: NetworkTarget,
  baseUrl: string = BASE_API_URL
): Promise<{ body: T; status: number }> {
  let url = baseUrl + target.path;
  console.log('[makeRequest] URL:', url, 'method:', target.method, 'params:', target.params, 'body:', target.body);
  
  if (target.method === 'GET' && target.params) {
    url += buildQueryString(target.params);
  }

  // Check cache for GET requests if caching is enabled
  if (target.shouldCache && target.method === 'GET') {
    const cacheKey = getCacheKey(url, target.method);
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      console.log('[makeRequest] Cache hit for:', url);
      return cached.data;
    }
  }

  let options: RequestInit = {
    method: target.method,
    headers: target.headers,
  };

  if (target.body) {
    options.body = typeof target.body === 'string' ? target.body : JSON.stringify(target.body);
  }

  // Timeout support (AbortController)
  const timeout = target.timeoutMs || 10000;
  const retries = target.retries ?? 0;
  let attempt = 0;
  let lastError: any;

  while (attempt <= retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;
    try {
      const res = await fetch(url, options);
      clearTimeout(id);
      if (!res.ok) {
        let errorBody;
        try { errorBody = await res.json(); } catch { errorBody = undefined; }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(errorBody)}`);
      }
      // Try to parse JSON, fallback to text
      let result: { body: T; status: number };
      try {
        result = { body: await res.json(), status: res.status };
      } catch {
        result = { body: (await res.text()) as any, status: res.status };
      }

      // Cache successful GET requests if caching is enabled
      if (target.shouldCache && target.method === 'GET' && res.status >= 200 && res.status < 300) {
        const cacheKey = getCacheKey(url, target.method);
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl: DEFAULT_CACHE_TTL
        });
        console.log('[makeRequest] Cached response for:', url);
      }

      return result;
    } catch (e) {
      clearTimeout(id);
      lastError = e;
      if (attempt < retries) {
        // Exponential backoff: 2^attempt * 300ms
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 300));
        attempt++;
        continue;
      } else {
        throw lastError;
      }
    }
  }
  throw lastError; // Should not reach here
}

// Helper function to clear cache (useful for testing or manual cache invalidation)
export function clearCache(): void {
  cache.clear();
  console.log('[makeRequest] Cache cleared');
}

// Helper function to clear specific cache entries by URL pattern
export function clearCacheByPattern(pattern: string): void {
  for (const [key] of cache) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
  console.log('[makeRequest] Cache cleared for pattern:', pattern);
}
