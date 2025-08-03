/**
 * Global cache for Hive post previews to prevent duplicate API calls
 * and improve performance across the app
 */

import { HivePostInfo } from './extractHivePostInfo';

interface CacheEntry {
  data: HivePostInfo | null;
  timestamp: number;
  loading?: boolean;
  error?: string;
}

class HivePostPreviewCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly loadingPromises = new Map<
    string,
    Promise<HivePostInfo | null>
  >();

  /**
   * Generate cache key from URL
   */
  private getCacheKey(url: string): string {
    return url.toLowerCase().trim();
  }

  /**
   * Check if cache entry is valid
   */
  private isValidCacheEntry(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.TTL;
  }

  /**
   * Get cached post info if available and valid
   */
  getCachedPostInfo(url: string): HivePostInfo | null {
    const key = this.getCacheKey(url);
    const entry = this.cache.get(key);

    if (entry && this.isValidCacheEntry(entry)) {
      return entry.data;
    }

    return null;
  }

  /**
   * Check if a URL is currently being loaded
   */
  isLoading(url: string): boolean {
    const key = this.getCacheKey(url);
    return (
      this.loadingPromises.has(key) || this.cache.get(key)?.loading === true
    );
  }

  /**
   * Set loading state for a URL
   */
  setLoading(url: string, promise: Promise<HivePostInfo | null>): void {
    const key = this.getCacheKey(url);
    this.loadingPromises.set(key, promise);

    // Set cache entry as loading
    this.cache.set(key, {
      data: null,
      timestamp: Date.now(),
      loading: true,
    });

    // Clean up promise when done
    promise.finally(() => {
      this.loadingPromises.delete(key);
    });
  }

  /**
   * Cache post info result
   */
  setCachedPostInfo(
    url: string,
    postInfo: HivePostInfo | null,
    error?: string
  ): void {
    const key = this.getCacheKey(url);
    this.cache.set(key, {
      data: postInfo,
      timestamp: Date.now(),
      loading: false,
      error,
    });
  }

  /**
   * Get existing loading promise if available
   */
  getLoadingPromise(url: string): Promise<HivePostInfo | null> | null {
    const key = this.getCacheKey(url);
    return this.loadingPromises.get(key) || null;
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      totalEntries: this.cache.size,
      loadingEntries: this.loadingPromises.size,
      validEntries: Array.from(this.cache.values()).filter(entry =>
        this.isValidCacheEntry(entry)
      ).length,
    };
  }
}

// Export singleton instance
export const hivePostPreviewCache = new HivePostPreviewCache();

// Cleanup expired entries every 2 minutes
setInterval(
  () => {
    hivePostPreviewCache.cleanup();
  },
  2 * 60 * 1000
);
