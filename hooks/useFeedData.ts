import { useState, useEffect, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { calculateVoteValue } from '../utils/calculateVoteValue';
import { getHivePriceUSD } from '../utils/getHivePrice';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Define a Snap type for Hive posts/comments
export interface Snap {
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  body: string;
  created: string;
  json_metadata?: string;
  posting_json_metadata?: string;
  avatarUrl?: string;
  [key: string]: any;
}

export type FeedFilter = 'following' | 'newest' | 'trending' | 'my';

interface FeedState {
  snaps: Snap[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

interface UseFeedDataReturn extends FeedState {
  fetchSnaps: (filter: FeedFilter, useCache?: boolean) => Promise<void>;
  refreshSnaps: (filter: FeedFilter) => Promise<void>;
  loadMoreSnaps: (filter: FeedFilter) => Promise<void>;
  clearError: () => void;
}

export const useFeedData = (username: string | null): UseFeedDataReturn => {
  const [state, setState] = useState<FeedState>({
    snaps: [],
    loading: false,
    error: null,
    hasMore: true,
  });

  const [snapsCache, setSnapsCache] = useState<Record<string, Snap[]>>({});
  const [lastFetchTime, setLastFetchTime] = useState<Record<string, number>>({});
  const [avatarCache, setAvatarCache] = useState<Record<string, { url: string; timestamp: number }>>({});

  // Cache management - 5 minute cache
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const isCacheValid = (filterKey: string) => {
    const lastFetch = lastFetchTime[filterKey];
    return lastFetch && (Date.now() - lastFetch) < CACHE_DURATION;
  };

  const getCachedSnaps = (filterKey: string) => {
    if (isCacheValid(filterKey) && snapsCache[filterKey]) {
      return snapsCache[filterKey];
    }
    return null;
  };

  const setCachedSnaps = (filterKey: string, snaps: Snap[]) => {
    setSnapsCache(prev => ({ ...prev, [filterKey]: snaps }));
    setLastFetchTime(prev => ({ ...prev, [filterKey]: Date.now() }));
  };

  // Enhanced avatar fetching with time-based caching
  const enhanceSnapsWithAvatar = async (snaps: Snap[]) => {
    const authors = Array.from(new Set(snaps.map(s => s.author)));
    const now = Date.now();
    const AVATAR_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    const uncachedAuthors = authors.filter(author => {
      const cached = avatarCache[author];
      return !cached || (now - cached.timestamp) > AVATAR_CACHE_DURATION;
    });

    if (uncachedAuthors.length > 0) {
      try {
        const accounts = await client.database.getAccounts(uncachedAuthors);
        for (const acc of accounts) {
          let meta = null;
          if (acc.posting_json_metadata) {
            try {
              meta = JSON.parse(acc.posting_json_metadata);
            } catch { }
          }
          if ((!meta || !meta.profile || !meta.profile.profile_image) && acc.json_metadata) {
            try {
              meta = JSON.parse(acc.json_metadata);
            } catch { }
          }
          const url = meta && meta.profile && meta.profile.profile_image
            ? meta.profile.profile_image.replace(/[\\/]+$/, '')
            : '';
          setAvatarCache(prev => ({ ...prev, [acc.name]: { url, timestamp: now } }));
        }
      } catch (e) {
        console.log('Error fetching accounts for avatars:', e);
      }
    }

    return snaps.map(snap => ({
      ...snap,
      avatarUrl: avatarCache[snap.author]?.url || ''
    }));
  };

  const fetchSnaps = useCallback(async (filter: FeedFilter, useCache = true) => {
    const cacheKey = filter === 'my' ? `my-${username}` : filter;

    // Check cache first
    if (useCache) {
      const cachedSnaps = getCachedSnaps(cacheKey);
      if (cachedSnaps) {
        console.log('Using cached snaps for', filter, 'feed');
        setState(prev => ({ ...prev, snaps: cachedSnaps, loading: false }));
        return;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let allSnaps: Snap[] = [];

      if (filter === 'newest') {
        const discussions = await client.database.call('get_discussions_by_blog', [{
          tag: 'peak.snaps',
          limit: 3
        }]);

        const snapPromises = discussions.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
            return replies;
          } catch (err) {
            console.log('Error fetching replies for post:', post.permlink, err);
            return [];
          }
        });

        const snapResults = await Promise.all(snapPromises);
        allSnaps = snapResults.flat();
        allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      } else if (filter === 'following' && username) {
        const followingResult = await client.call('condenser_api', 'get_following', [username, '', 'blog', 100]);
        const following = Array.isArray(followingResult)
          ? followingResult.map((f: any) => f.following)
          : (followingResult && followingResult.following) ? followingResult.following : [];

        const containerPosts = await client.database.call('get_discussions_by_blog', [{ tag: 'peak.snaps', limit: 3 }]);

        const snapPromises = containerPosts.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
            return replies.filter((reply) => following.includes(reply.author));
          } catch (err) {
            console.log('Error fetching replies for post:', post.permlink, err);
            return [];
          }
        });

        const snapResults = await Promise.all(snapPromises);
        allSnaps = snapResults.flat();
        allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      } else if (filter === 'trending') {
        const discussions = await client.database.call('get_discussions_by_blog', [{
          tag: 'peak.snaps',
          limit: 3
        }]);

        const snapPromises = discussions.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
            return replies;
          } catch (err) {
            console.log('Error fetching replies for post:', post.permlink, err);
            return [];
          }
        });

        const snapResults = await Promise.all(snapPromises);
        allSnaps = snapResults.flat();

        allSnaps.sort((a, b) => {
          const payoutA =
            parseFloat(a.pending_payout_value ? a.pending_payout_value.replace(' HBD', '') : '0') +
            parseFloat(a.total_payout_value ? a.total_payout_value.replace(' HBD', '') : '0') +
            parseFloat(a.curator_payout_value ? a.curator_payout_value.replace(' HBD', '') : '0');
          const payoutB =
            parseFloat(b.pending_payout_value ? b.pending_payout_value.replace(' HBD', '') : '0') +
            parseFloat(b.total_payout_value ? b.total_payout_value.replace(' HBD', '') : '0') +
            parseFloat(b.curator_payout_value ? b.curator_payout_value.replace(' HBD', '') : '0');
          return payoutB - payoutA;
        });
      } else if (filter === 'my' && username) {
        const discussions = await client.database.call('get_discussions_by_blog', [{
          tag: 'peak.snaps',
          limit: 3
        }]);

        if (discussions && discussions.length > 0) {
          const snapPromises = discussions.map(async (post: any) => {
            try {
              const replies: Snap[] = await client.database.call('get_content_replies', [post.author, post.permlink]);
              return replies.filter((reply) => reply.author === username);
            } catch (err) {
              console.log('Error fetching replies for post:', post.permlink, err);
              return [];
            }
          });

          const snapResults = await Promise.all(snapPromises);
          allSnaps = snapResults.flat();
          allSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        }
      }

      const limitedSnaps = allSnaps.slice(0, 50);
      const enhanced = await enhanceSnapsWithAvatar(limitedSnaps);
      
      setState(prev => ({ 
        ...prev, 
        snaps: enhanced, 
        loading: false, 
        hasMore: enhanced.length === 50 
      }));
      
      setCachedSnaps(cacheKey, enhanced);
      console.log('Fetched and cached snaps for', filter, ':', enhanced.length);
    } catch (err) {
      console.log('Error fetching snaps:', err);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch snaps' 
      }));
    }
  }, [username, avatarCache]);

  const refreshSnaps = useCallback(async (filter: FeedFilter) => {
    await fetchSnaps(filter, false); // Force refresh without cache
  }, [fetchSnaps]);

  const loadMoreSnaps = useCallback(async (filter: FeedFilter) => {
    // Implementation for pagination would go here
    // For now, we'll just refresh
    await refreshSnaps(filter);
  }, [refreshSnaps]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fetchSnaps,
    refreshSnaps,
    loadMoreSnaps,
    clearError,
  };
};
