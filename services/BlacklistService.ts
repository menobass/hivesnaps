/**
 * BlacklistService - Global Blacklist Management
 * 
 * Fetches and caches the global blacklist of users that should be
 * permanently muted for all HiveSnaps users regardless of personal preferences.
 * 
 * This list is maintained by the HiveSnaps team and includes known toxic users,
 * spammers, and other bad actors that should be hidden from all users.
 */

import { BLACKLIST_API_URL } from '../app/config/api';

interface BlacklistApiResponse {
  users?: string[];
  blacklisted?: string[];
  // Allow for flexible API response structure
  [key: string]: unknown;
}

/**
 * Configuration for blacklist fetching
 */
const BLACKLIST_CONFIG = {
  TIMEOUT_MS: 10000,
  CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  MAX_RETRIES: 2,
} as const;

/**
 * In-memory cache for the global blacklist
 */
let blacklistCache: {
  users: Set<string>;
  lastFetched: number;
} | null = null;

/**
 * Fetches the global blacklist with timeout and error handling
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = BLACKLIST_CONFIG.TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validates and normalizes the API response
 */
function validateBlacklistResponse(data: unknown): string[] {
  if (!data || typeof data !== 'object') {
    console.warn('[BlacklistService] Invalid API response format');
    return [];
  }

  const response = data as BlacklistApiResponse;

  // Try different possible response structures
  const candidates = [
    response.users,
    response.blacklisted,
    Array.isArray(data) ? data : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const validUsers = candidate
        .filter((user): user is string => 
          typeof user === 'string' && 
          user.length > 0 && 
          user.length <= 20 && // Reasonable username length limit
          /^[a-z0-9.-]+$/.test(user) // Valid Hive username format
        );
      
      if (validUsers.length > 0) {
        return validUsers;
      }
    }
  }

  console.warn('[BlacklistService] No valid users found in API response');
  return [];
}

/**
 * Fetches the global blacklist from the backend
 * Returns a Set of usernames that should be permanently muted
 */
export async function fetchGlobalBlacklist(): Promise<Set<string>> {
  try {
    console.log('[BlacklistService] Fetching global blacklist...');
    
    let lastError: Error | null = null;
    
    // Retry mechanism
    for (let attempt = 1; attempt <= BLACKLIST_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(BLACKLIST_API_URL);
        
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const users = validateBlacklistResponse(data);
        
        console.log(`[BlacklistService] Successfully fetched ${users.length} blacklisted users`);
        
        // Update cache
        blacklistCache = {
          users: new Set(users),
          lastFetched: Date.now(),
        };
        
        return blacklistCache.users;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`[BlacklistService] Attempt ${attempt} failed:`, error);
        
        if (attempt < BLACKLIST_CONFIG.MAX_RETRIES) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
    
  } catch (error) {
    console.error('[BlacklistService] Failed to fetch global blacklist:', error);
    
    // Return cached data if available, otherwise empty set
    if (blacklistCache?.users) {
      console.log('[BlacklistService] Using cached blacklist due to fetch failure');
      return new Set(blacklistCache.users);
    }
    
    return new Set();
  }
}

/**
 * Gets the global blacklist with caching
 * Automatically refetches if cache is expired
 */
export async function getGlobalBlacklist(): Promise<Set<string>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (blacklistCache && (now - blacklistCache.lastFetched) < BLACKLIST_CONFIG.CACHE_TTL_MS) {
    console.log(`[BlacklistService] Using cached blacklist (${blacklistCache.users.size} users)`);
    return new Set(blacklistCache.users);
  }
  
  // Fetch fresh data
  return await fetchGlobalBlacklist();
}

/**
 * Clears the blacklist cache
 * Useful for testing or forcing a refresh
 */
export function clearBlacklistCache(): void {
  blacklistCache = null;
  console.log('[BlacklistService] Cache cleared');
}

/**
 * Gets cached blacklist without making network requests
 * Returns empty set if no cache exists
 */
export function getCachedBlacklist(): Set<string> {
  return blacklistCache?.users ? new Set(blacklistCache.users) : new Set();
}
