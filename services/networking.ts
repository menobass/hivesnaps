import { BASE_API_URL } from '../app/config/env';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface NetworkTarget {
  path: string;
  method: HTTPMethod;
  params?: Record<string, any>; // For query params (GET) or body (POST)
  headers?: Record<string, string>;
  shouldCache?: boolean;
  body?: any;
  timeoutMs?: number;
  retries?: number; // Optional: number of retry attempts
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
): Promise<T> {
  let url = baseUrl + target.path;
  console.log('[makeRequest] URL:', url, 'method:', target.method, 'params:', target.params, 'body:', target.body);
  let options: RequestInit = {
    method: target.method,
    headers: target.headers,
  };

  if (target.method === 'GET' && target.params) {
    url += buildQueryString(target.params);
  } else if (target.body) {
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
      try {
        return await res.json();
      } catch {
        return (await res.text()) as any;
      }
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
