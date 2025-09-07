import { makeRequest } from './networking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BLACKLIST_CACHE_KEY = 'hivesnaps_blacklist_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface BlacklistCacheData {
  blacklist: string[];
  timestamp: number;
}

interface BlacklistApiResponse {
  data?: string[];
  blacklist?: string[];
  users?: string[];
  blacklistedUsers?: string[]; // The actual field name from your API
}

// Union type for all possible API response formats
type BlacklistResponseData = string[] | BlacklistApiResponse | null | undefined;

/**
 * Service for fetching and caching the global blacklist of users
 * from the HiveSnaps team's API. Uses the networking layer for requests.
 */
export class BlacklistService {

  /**
   * Get the cached blacklist if it's still valid, otherwise fetch fresh data
   */
  static async getBlacklist(): Promise<string[]> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedBlacklist();
      if (cached) {
        console.log('[BlacklistService] Using cached blacklist:', cached.length, 'users');
        return cached;
      }

      // Cache miss or expired, fetch fresh data
      console.log('[BlacklistService] Cache miss, fetching fresh blacklist');
      return await this.fetchFreshBlacklist();
    } catch (error) {
      console.error('[BlacklistService] Error getting blacklist:', error);
      // Return empty array as fallback
      return [];
    }
  }

  /**
   * Get blacklist from cache if it's still valid
   */
  private static async getCachedBlacklist(): Promise<string[] | null> {
    try {
      const cacheStr = await AsyncStorage.getItem(BLACKLIST_CACHE_KEY);
      if (!cacheStr) return null;

      const cached: BlacklistCacheData = JSON.parse(cacheStr);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - cached.timestamp < CACHE_DURATION) {
        return cached.blacklist;
      }

      // Cache expired
      console.log('[BlacklistService] Cache expired, will fetch fresh data');
      return null;
    } catch (error) {
      console.error('[BlacklistService] Error reading cache:', error);
      return null;
    }
  }

  /**
   * Fetch fresh blacklist data from API and cache it
   */
  private static async fetchFreshBlacklist(): Promise<string[]> {
    try {
      console.log('[BlacklistService] Fetching blacklist from /blacklisted');
      
      // Use networking layer with the single blacklist endpoint
      const response = await makeRequest<BlacklistApiResponse>({
        path: '/blacklisted',
        method: 'GET',
        timeoutMs: 10000,
        retries: 2
      });

      const blacklist = this.extractBlacklistFromResponse(response.body);
      
      if (blacklist.length > 0) {
        console.log('[BlacklistService] Successfully fetched blacklist:', blacklist.length, 'users');
        await this.cacheBlacklist(blacklist);
        return blacklist;
      } else {
        console.warn('[BlacklistService] Empty blacklist received');
        return [];
      }
    } catch (error) {
      console.error('[BlacklistService] Failed to fetch blacklist:', error);
      throw new Error(`Failed to fetch blacklist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract blacklist array from various API response formats
   * @param data - The response data from the blacklist API
   * @returns Array of blacklisted usernames
   */
  private static extractBlacklistFromResponse(data: BlacklistResponseData): string[] {
    if (!data) {
      console.log('[BlacklistService] ❌ No data received');
      return [];
    }

    console.log('[BlacklistService] 🔍 Raw API response:', JSON.stringify(data, null, 2));

    // Handle different response formats
    if (Array.isArray(data)) {
      const filtered = data.filter(item => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found array format:', filtered.length, 'users');
      return filtered;
    }
    
    // Check for blacklistedUsers field (the actual field from your API)
    if (data.blacklistedUsers && Array.isArray(data.blacklistedUsers)) {
      const filtered = data.blacklistedUsers.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found blacklistedUsers field:', filtered.length, 'users');
      console.log('[BlacklistService] 📋 Blacklisted users:', filtered);
      return filtered;
    }
    
    if (data.data && Array.isArray(data.data)) {
      const filtered = data.data.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found data field:', filtered.length, 'users');
      return filtered;
    }
    
    if (data.blacklist && Array.isArray(data.blacklist)) {
      const filtered = data.blacklist.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found blacklist field:', filtered.length, 'users');
      return filtered;
    }
    
    if (data.users && Array.isArray(data.users)) {
      const filtered = data.users.filter((item: unknown): item is string => typeof item === 'string');
      console.log('[BlacklistService] ✅ Found users field:', filtered.length, 'users');
      return filtered;
    }

    console.warn('[BlacklistService] ❌ Unexpected response format:', data);
    return [];
  }

  /**
   * Cache the blacklist data
   */
  private static async cacheBlacklist(blacklist: string[]): Promise<void> {
    try {
      const cacheData: BlacklistCacheData = {
        blacklist,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(BLACKLIST_CACHE_KEY, JSON.stringify(cacheData));
      console.log('[BlacklistService] Cached blacklist:', blacklist.length, 'users');
    } catch (error) {
      console.error('[BlacklistService] Error caching blacklist:', error);
      // Don't throw, caching failure shouldn't break the flow
    }
  }

  /**
   * Clear the cached blacklist (useful for testing or forcing refresh)
   */
  static async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BLACKLIST_CACHE_KEY);
      console.log('[BlacklistService] Cache cleared');
    } catch (error) {
      console.error('[BlacklistService] Error clearing cache:', error);
    }
  }

  /**
   * Force refresh the blacklist by clearing cache and fetching fresh data
   */
  static async forceRefresh(): Promise<string[]> {
    await this.clearCache();
    return await this.getBlacklist();
  }
}
