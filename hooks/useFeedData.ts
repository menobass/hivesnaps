import { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@hiveio/dhive';

// Types for a Snap (feed item)
export interface SnapData {
  author: string;
  avatarUrl?: string;
  body: string;
  created: string;
  voteCount?: number;
  replyCount?: number;
  payout?: number;
  permlink?: string;
  hasUpvoted?: boolean;
  active_votes?: any[];
}

export type FeedType = 'newest' | 'following' | 'trending' | 'my' | 'hashtag';

interface UseFeedDataOptions {
  feedType: FeedType;
  hashtag?: string;
  username?: string; // For 'my' or 'following' feeds
}

interface UseFeedDataResult {
  snaps: SnapData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

/**
 * useFeedData - Custom hook to fetch and manage feed data for various feed types (newest, trending, following, my, hashtag).
 * Keeps logic modular and reusable for FeedScreen, HashtagScreen, etc.
 *
 * @param options { feedType, hashtag, username }
 * @returns { snaps, loading, error, refresh }
 */
export function useFeedData(options: UseFeedDataOptions): UseFeedDataResult {
  // TODO: Implement feed fetching, avatar enhancement, and error handling logic here.
  // This is a scaffold for safe incremental refactor.
  const [snaps, setSnaps] = useState<SnapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In-memory avatar/profile cache for this session (per hook instance)
  const avatarProfileCache = useRef<Record<string, string | undefined>>({});

  // Helper: Enhance snaps with avatar/profile info
  const enhanceSnapsWithAvatar = async (snaps: SnapData[]): Promise<SnapData[]> => {
    // Collect all unique authors not already cached
    const authorsToFetch = Array.from(new Set(snaps.map(s => s.author))).filter(a => !(a in avatarProfileCache.current));
    let accountsArr: any[] = [];
    if (authorsToFetch.length > 0) {
      try {
        accountsArr = await client.database.call('get_accounts', [authorsToFetch]);
      } catch (e) {
        accountsArr = [];
      }
      // Update cache with fetched avatars
      for (const acc of accountsArr) {
        let meta = acc.posting_json_metadata;
        if (!meta || meta === '{}') {
          meta = acc.json_metadata;
        }
        if (meta) {
          let profile;
          try {
            profile = JSON.parse(meta).profile;
          } catch (e) {
            profile = undefined;
          }
          if (profile && profile.profile_image) {
            avatarProfileCache.current[acc.name] = profile.profile_image;
          } else {
            avatarProfileCache.current[acc.name] = undefined;
          }
        } else {
          avatarProfileCache.current[acc.name] = undefined;
        }
      }
    }
    // Attach avatarUrl to each snap
    return snaps.map(snap => ({ ...snap, avatarUrl: avatarProfileCache.current[snap.author] }));
  };

  // Main feed fetcher
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let rawSnaps: any[] = [];
      // Fetch based on feed type
      if (options.feedType === 'newest') {
        // Get latest posts tagged with 'hivesnaps'
        const res = await fetch('https://api.hive.blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_discussions_by_created',
            params: [{ tag: 'hivesnaps', limit: 40 }],
            id: 1,
          }),
        });
        const data = await res.json();
        rawSnaps = data.result || [];
      } else if (options.feedType === 'trending') {
        const res = await fetch('https://api.hive.blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_discussions_by_trending',
            params: [{ tag: 'hivesnaps', limit: 40 }],
            id: 1,
          }),
        });
        const data = await res.json();
        rawSnaps = data.result || [];
      } else if (options.feedType === 'following' && options.username) {
        // Get posts from followed authors
        // 1. Get following list
        const followingRes = await fetch('https://api.hive.blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_following',
            params: [options.username, '', 'blog', 100],
            id: 1,
          }),
        });
        const followingData = await followingRes.json();
        const following = (followingData.result || []).map((f: any) => f.following);
        if (following.length === 0) {
          setSnaps([]);
          setLoading(false);
          return;
        }
        // 2. Get posts for each followed author (parallel, then flatten)
        const postsArr = await Promise.all(
          following.map(async (author: string) => {
            const res = await fetch('https://api.hive.blog', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'condenser_api.get_discussions_by_blog',
                params: [{ tag: author, limit: 10 }],
                id: 1,
              }),
            });
            const data = await res.json();
            return data.result || [];
          })
        );
        rawSnaps = postsArr.flat();
      } else if (options.feedType === 'my' && options.username) {
        // Get posts by the user
        const res = await fetch('https://api.hive.blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_discussions_by_author',
            params: [options.username, 'hivesnaps', 40],
            id: 1,
          }),
        });
        const data = await res.json();
        rawSnaps = data.result || [];
      } else if (options.feedType === 'hashtag' && options.hashtag) {
        // Get posts by hashtag (tag)
        const res = await fetch('https://api.hive.blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'condenser_api.get_discussions_by_created',
            params: [{ tag: options.hashtag, limit: 40 }],
            id: 1,
          }),
        });
        const data = await res.json();
        rawSnaps = data.result || [];
      } else {
        setSnaps([]);
        setLoading(false);
        return;
      }

      // Map to SnapData type
      const mappedSnaps: SnapData[] = rawSnaps.map((post: any) => ({
        author: post.author,
        body: post.body,
        created: post.created,
        voteCount: post.net_votes,
        replyCount: post.children,
        payout: parseFloat(post.pending_payout_value ? post.pending_payout_value.replace(' HBD', '') : '0'),
        permlink: post.permlink,
        active_votes: post.active_votes,
      }));

      // Enhance with avatar/profile info
      const enhanced = await enhanceSnapsWithAvatar(mappedSnaps);
      setSnaps(enhanced);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch feed.');
      setSnaps([]);
    } finally {
      setLoading(false);
    }
  }, [options.feedType, options.hashtag, options.username]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const refresh = useCallback(() => {
    fetchFeed();
  }, [fetchFeed]);

  return { snaps, loading, error, refresh };
}
