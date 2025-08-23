import { Client } from '@hiveio/dhive';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];

const client = new Client(HIVE_NODES);

interface AvatarCacheEntry {
  url: string;
  timestamp: number;
  source: 'metadata' | 'hive-images' | 'fallback';
}

interface AvatarLoadResult {
  url: string;
  fromCache: boolean;
  source: 'metadata' | 'hive-images' | 'fallback';
}

class AvatarService {
  private static instance: AvatarService;
  private cache = new Map<string, AvatarCacheEntry>();
  private loadingPromises = new Map<string, Promise<string>>();
  private listeners = new Set<(username: string, avatarUrl: string) => void>();
  
  // Cache duration: 30 minutes for successful loads, 5 minutes for failures
  private readonly CACHE_DURATION_SUCCESS = 30 * 60 * 1000;
  private readonly CACHE_DURATION_FAILURE = 5 * 60 * 1000;
  private readonly STORAGE_KEY = 'hivesnaps_unified_avatar_cache';

  private constructor() {
    this.loadCacheFromStorage();
  }

  static getInstance(): AvatarService {
    if (!AvatarService.instance) {
      AvatarService.instance = new AvatarService();
    }
    return AvatarService.instance;
  }

  /**
   * Subscribe to avatar updates
   */
  subscribe(listener: (username: string, avatarUrl: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of avatar update
   */
  private notifyListeners(username: string, avatarUrl: string) {
    try {
      console.log(`[Avatar][Service] notify ${username} -> ${avatarUrl || 'EMPTY'}`);
    } catch {}
    this.listeners.forEach(listener => {
      try {
        listener(username, avatarUrl);
      } catch (error) {
        console.warn('Avatar listener error:', error);
      }
    });
  }

  /**
   * Get avatar URL for a user (with fallback strategies)
   */
  async getAvatarUrl(username: string): Promise<AvatarLoadResult> {
    if (!username) {
      return { url: '', fromCache: false, source: 'fallback' };
    }

    // Check cache first
    const cached = this.cache.get(username);
    const now = Date.now();
    
    if (cached) {
      const cacheAge = now - cached.timestamp;
      const maxAge = cached.url ? this.CACHE_DURATION_SUCCESS : this.CACHE_DURATION_FAILURE;
      // Only short-circuit on non-empty cached URLs within TTL AND from images.hive.blog.
      // If the cached URL is from metadata or another host, treat as stale and re-fetch.
      const isImagesHost = typeof cached.url === 'string' && cached.url.startsWith('https://images.hive.blog/');
      if (cached.url && cacheAge < maxAge && isImagesHost) {
        return { url: cached.url, fromCache: true, source: 'hive-images' };
      }
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(username);
    if (existingPromise) {
      const url = await existingPromise;
      return { url, fromCache: false, source: this.cache.get(username)?.source || 'metadata' };
    }

    // Start loading
    const loadPromise = this.fetchAvatarUrl(username);
    this.loadingPromises.set(username, loadPromise);

    try {
      const url = await loadPromise;
      this.loadingPromises.delete(username);
      
      // Notify listeners of the update
      this.notifyListeners(username, url);
      
      return { url, fromCache: false, source: this.cache.get(username)?.source || 'metadata' };
    } catch (error) {
      this.loadingPromises.delete(username);
      console.warn(`Failed to load avatar for ${username}:`, error);
      return { url: '', fromCache: false, source: 'fallback' };
    }
  }

  /**
   * Preload avatars for multiple users
   */
  async preloadAvatars(usernames: string[]): Promise<void> {
    const uniqueUsernames = [...new Set(usernames.filter(Boolean))];
    const loadPromises = uniqueUsernames.map(username => 
      this.getAvatarUrl(username).catch(() => ({ url: '', fromCache: false, source: 'fallback' as const }))
    );
    
    await Promise.all(loadPromises);
    console.log(`✅ Preloaded avatars for ${uniqueUsernames.length} users`);
  }

  /**
   * Get cached avatar URL immediately (no async loading)
   */
  getCachedAvatarUrl(username: string): string {
    const cached = this.cache.get(username);
    if (!cached) return '';
    
    const now = Date.now();
    const cacheAge = now - cached.timestamp;
    const maxAge = cached.url ? this.CACHE_DURATION_SUCCESS : this.CACHE_DURATION_FAILURE;

    if (cacheAge >= maxAge) return '';

    // Normalize: always prefer images.hive.blog. If cached is not images, return images URL and update cache.
    const imagesUrl = `https://images.hive.blog/u/${username}/avatar/original`;
    if (!cached.url || !cached.url.startsWith('https://images.hive.blog/')) {
      this.cache.set(username, { url: imagesUrl, timestamp: Date.now(), source: 'hive-images' });
      this.persistCacheToStorage();
      return imagesUrl;
    }
    return cached.url;
  }

  /**
   * Force refresh avatar for a user
   */
  async refreshAvatar(username: string): Promise<string> {
    this.cache.delete(username);
    this.loadingPromises.delete(username);
    const result = await this.getAvatarUrl(username);
    return result.url;
  }

  /**
   * Clear all cached avatars
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Could be implemented with usage tracking
    };
  }

  /**
   * Actual avatar fetching with multiple strategies
   */
  private async fetchAvatarUrl(username: string): Promise<string> {
    let avatarUrl = '';
    let source: 'metadata' | 'hive-images' | 'fallback' = 'hive-images';

    try {
      // Always use the deterministic Hive images service URL.
      // We intentionally avoid metadata because many accounts reference dead hosts (e.g., snag.gy).
      const hiveImageUrl = `https://images.hive.blog/u/${username}/avatar/original`;
      avatarUrl = hiveImageUrl;
      source = 'hive-images';

    } catch (error) {
      console.warn(`Error fetching avatar for ${username}:`, error);
    }

    // Cache the result (even if empty)
    this.cache.set(username, {
      url: avatarUrl,
      timestamp: Date.now(),
      source,
    });

    // Persist cache to storage periodically
    this.persistCacheToStorage();

    return avatarUrl;
  }

  /**
   * Perform a HEAD request with a timeout; returns true if response.ok
   */
  private async headWithTimeout(url: string, timeoutMs: number): Promise<boolean> {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      );
      const response: Response = await Promise.race([
        fetch(url, { method: 'HEAD' }),
        timeout,
      ]);
      return (response as any)?.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Load cache from AsyncStorage
   */
  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        Object.entries(parsed).forEach(([username, entry]) => {
          const e = entry as AvatarCacheEntry;
          // Migrate any non-images URLs to images.hive.blog
          const normalized: AvatarCacheEntry = e.url && e.url.startsWith('https://images.hive.blog/')
            ? e
            : {
                url: `https://images.hive.blog/u/${username}/avatar/original`,
                timestamp: Date.now(),
                source: 'hive-images',
              };
          this.cache.set(username, normalized);
        });
        console.log(`📱 Loaded ${this.cache.size} avatar cache entries from storage`);
      }
    } catch (error) {
      console.warn('Failed to load avatar cache from storage:', error);
    }
  }

  /**
   * Persist cache to AsyncStorage (debounced)
   */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistCacheToStorage(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    
    this.persistTimer = setTimeout(async () => {
      try {
        const cacheObject = Object.fromEntries(this.cache.entries());
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheObject));
      } catch (error) {
        console.warn('Failed to persist avatar cache to storage:', error);
      }
    }, 1000); // Debounce by 1 second
  }
}

// Export singleton instance
export const avatarService = AvatarService.getInstance();
export type { AvatarLoadResult };
