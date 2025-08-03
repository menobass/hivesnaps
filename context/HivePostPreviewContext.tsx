/**
 * Global Hive Post Preview Context
 * Provides persistent caching across all screens and component remounts
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  HivePostInfo,
  fetchMultipleHivePostInfos,
} from '../utils/extractHivePostInfo';

interface HivePostPreviewContextType {
  getPostPreviews: (urls: string[]) => Promise<HivePostInfo[]>;
  preloadPostPreviews: (urls: string[]) => void;
  clearCache: () => void;
}

interface CacheEntry {
  data: HivePostInfo[];
  timestamp: number;
  loading: Promise<HivePostInfo[]> | null;
}

const HivePostPreviewContext = createContext<HivePostPreviewContextType | null>(
  null
);

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200; // Maximum number of cached entries

const HivePostPreviewProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Start cleanup interval on first mount
  React.useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const cache = cacheRef.current;

      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }

      // If cache is too large, remove oldest entries
      if (cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(cache.entries()).sort(
          ([, a], [, b]) => a.timestamp - b.timestamp
        );

        const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
        toRemove.forEach(([key]) => cache.delete(key));
      }
    }, 60000); // Cleanup every minute

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, []);

  const getPostPreviews = useCallback(
    async (urls: string[]): Promise<HivePostInfo[]> => {
      if (urls.length === 0) return [];

      // Filter out invalid URLs before processing
      const validUrls = urls.filter(url => {
        if (!url || typeof url !== 'string') return false;
        if (url.length < 10) return false; // Too short to be valid
        if (!url.includes('@') || !url.includes('/')) return false; // Missing required parts
        return true;
      });

      if (validUrls.length === 0) {
        console.log('[HivePostPreviewContext] No valid URLs to fetch');
        return [];
      }

      if (validUrls.length !== urls.length) {
        console.log('[HivePostPreviewContext] Filtered out invalid URLs:', {
          original: urls.length,
          valid: validUrls.length,
        });
      }

      const cache = cacheRef.current;
      const cacheKey = validUrls.sort().join('|');
      const now = Date.now();

      // Check if we have cached data
      const cached = cache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        // If there's a loading promise, wait for it
        if (cached.loading) {
          try {
            return await cached.loading;
          } catch (error) {
            console.error('Error waiting for cached loading promise:', error);
          }
        }
        // Return cached data
        return cached.data;
      }

      // If already loading, return the existing promise
      if (cached?.loading) {
        try {
          return await cached.loading;
        } catch (error) {
          console.error('Error waiting for existing loading promise:', error);
        }
      }

      // Create new loading promise with error handling
      const loadingPromise = fetchMultipleHivePostInfos(validUrls).catch(
        error => {
          console.error(
            '[HivePostPreviewContext] Error fetching post previews:',
            {
              error,
              urls: validUrls,
              errorMessage:
                error instanceof Error ? error.message : 'Unknown error',
            }
          );
          return []; // Return empty array on error
        }
      );

      // Set cache entry with loading promise
      cache.set(cacheKey, {
        data: cached?.data || [],
        timestamp: now,
        loading: loadingPromise,
      });

      try {
        const result = await loadingPromise;

        // Update cache with results
        cache.set(cacheKey, {
          data: result,
          timestamp: now,
          loading: null,
        });

        return result;
      } catch (error) {
        console.error(
          '[HivePostPreviewContext] Error in loading promise:',
          error
        );

        // Remove loading state on error
        const currentEntry = cache.get(cacheKey);
        if (currentEntry) {
          cache.set(cacheKey, {
            ...currentEntry,
            loading: null,
          });
        }

        return cached?.data || [];
      }
    },
    []
  );

  const preloadPostPreviews = useCallback(
    (urls: string[]) => {
      // Fire and forget preloading
      if (urls.length > 0) {
        getPostPreviews(urls).catch(error => {
          console.error('Error preloading post previews:', error);
        });
      }
    },
    [getPostPreviews]
  );

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const value: HivePostPreviewContextType = {
    getPostPreviews,
    preloadPostPreviews,
    clearCache,
  };

  return (
    <HivePostPreviewContext.Provider value={value}>
      {children}
    </HivePostPreviewContext.Provider>
  );
};

export { HivePostPreviewProvider };

export const useHivePostPreview = (): HivePostPreviewContextType => {
  const context = useContext(HivePostPreviewContext);
  if (!context) {
    throw new Error(
      'useHivePostPreview must be used within a HivePostPreviewProvider'
    );
  }
  return context;
};
