import { useEffect, useState, useCallback, useRef } from 'react';
import { avatarService, AvatarLoadResult } from '../services/AvatarService';

interface UseAvatarResult {
  avatarUrl: string;
  loading: boolean;
  error: boolean;
  fromCache: boolean;
  source: 'metadata' | 'hive-images' | 'fallback';
  refresh: () => Promise<void>;
}

/**
 * Hook for loading a single user's avatar
 */
export function useAvatar(username: string | null | undefined): UseAvatarResult {
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [source, setSource] = useState<'metadata' | 'hive-images' | 'fallback'>('fallback');
  const mountedRef = useRef(true);

  const loadAvatar = useCallback(async () => {
    if (!username) {
      setAvatarUrl('');
      setLoading(false);
      setError(false);
      setFromCache(false);
      setSource('fallback');
      return;
    }

    // Check cache immediately for instant display
    const cachedUrl = avatarService.getCachedAvatarUrl(username);
    if (cachedUrl) {
      setAvatarUrl(cachedUrl);
      setFromCache(true);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const result: AvatarLoadResult = await avatarService.getAvatarUrl(username);
      
      if (mountedRef.current) {
        setAvatarUrl(result.url);
        setFromCache(result.fromCache);
        setSource(result.source);
        setLoading(false);
        setError(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(true);
        setLoading(false);
        setAvatarUrl('');
      }
    }
  }, [username]);

  const refresh = useCallback(async () => {
    if (!username) return;
    
    setLoading(true);
    setError(false);
    
    try {
      const refreshedUrl = await avatarService.refreshAvatar(username);
      if (mountedRef.current) {
        setAvatarUrl(refreshedUrl);
        setLoading(false);
        setFromCache(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(true);
        setLoading(false);
      }
    }
  }, [username]);

  // Load avatar when username changes
  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  // Subscribe to avatar updates from the service
  useEffect(() => {
    if (!username) return;

    const unsubscribe = avatarService.subscribe((updatedUsername, updatedAvatarUrl) => {
      if (updatedUsername === username && mountedRef.current) {
        setAvatarUrl(updatedAvatarUrl);
        setFromCache(false);
      }
    });

    return unsubscribe;
  }, [username]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    avatarUrl,
    loading,
    error,
    fromCache,
    source,
    refresh,
  };
}

interface UseBatchAvatarsOptions {
  preload?: boolean;
  limit?: number;
}

/**
 * Hook for loading multiple users' avatars efficiently
 */
export function useBatchAvatars(
  usernames: (string | null | undefined)[],
  options: UseBatchAvatarsOptions = {}
): { [username: string]: string } {
  const { preload = true, limit = 50 } = options;
  const [avatars, setAvatars] = useState<{ [username: string]: string }>({});
  const mountedRef = useRef(true);

  const validUsernames = usernames
    .filter((username): username is string => Boolean(username))
    .slice(0, limit); // Limit to prevent excessive requests

  const loadAvatars = useCallback(async () => {
    if (validUsernames.length === 0) {
      setAvatars({});
      return;
    }

    // Get immediate cache results
    const immediateResults: { [username: string]: string } = {};
    const needsLoading: string[] = [];

    validUsernames.forEach(username => {
      const cachedUrl = avatarService.getCachedAvatarUrl(username);
      if (cachedUrl) {
        immediateResults[username] = cachedUrl;
      } else {
        immediateResults[username] = '';
        needsLoading.push(username);
      }
    });

    // Set immediate results
    if (mountedRef.current) {
      setAvatars(immediateResults);
    }

    // Preload missing avatars if enabled
    if (preload && needsLoading.length > 0) {
      try {
        await avatarService.preloadAvatars(needsLoading);
        
        // Update with loaded results
        if (mountedRef.current) {
          const updatedResults = { ...immediateResults };
          needsLoading.forEach(username => {
            updatedResults[username] = avatarService.getCachedAvatarUrl(username);
          });
          setAvatars(updatedResults);
        }
      } catch (error) {
        console.warn('Batch avatar preload failed:', error);
      }
    }
  }, [validUsernames.join(','), preload]);

  // Load avatars when usernames change
  useEffect(() => {
    loadAvatars();
  }, [loadAvatars]);

  // Subscribe to avatar updates
  useEffect(() => {
    if (validUsernames.length === 0) return;

    const unsubscribe = avatarService.subscribe((updatedUsername, updatedAvatarUrl) => {
      if (validUsernames.includes(updatedUsername) && mountedRef.current) {
        setAvatars(prev => ({
          ...prev,
          [updatedUsername]: updatedAvatarUrl,
        }));
      }
    });

    return unsubscribe;
  }, [validUsernames.join(',')]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return avatars;
}

/**
 * Hook for avatar service utilities
 */
export function useAvatarService() {
  const clearCache = useCallback(() => {
    avatarService.clearCache();
  }, []);

  const getCacheStats = useCallback(() => {
    return avatarService.getCacheStats();
  }, []);

  const preloadAvatars = useCallback(async (usernames: string[]) => {
    await avatarService.preloadAvatars(usernames);
  }, []);

  return {
    clearCache,
    getCacheStats,
    preloadAvatars,
  };
}
