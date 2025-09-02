import { useState, useCallback, useRef, useEffect } from 'react';
import { Client } from '@hiveio/dhive';
import { useFollowingList, useCurrentUser } from '../store/context';
import { avatarService } from '../services/AvatarService';
import { ModerationService } from '../services/ModerationService';
import type { ActiveVote } from '../services/ModerationService';

/**
 * Refactored Feed Data Hook with Ordered Container Map and Shared State Integration
 *
 * This hook manages Hive snaps using a clean, robust ordered dictionary structure:
 * - OrderedContainerMap: Map keyed by permlink, value is container metadata with snaps
 * - Containers are ordered by insertion (latest at head, oldest at tail)
 * - Pagination uses the last permlink as cursor for fetching additional containers
 * - For initial fetch: omits start_permlink (API best practice)
 * - For pagination: includes start_permlink from last container
 * - Memory efficient with configurable max containers
 * - Integrates with shared state management for following lists (eliminates redundant API calls)
 */

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
  // Optional moderation-related fields returned by Hive APIs
  active_votes?: ActiveVote[];
  net_votes?: number;
  [key: string]: any;
}

export type FeedFilter = 'following' | 'newest' | 'trending' | 'my';

// Container metadata with ordered dictionary structure
interface ContainerMetadata {
  permlink: string;
  snaps: Snap[];
  created: string; // Blockchain timestamp for ordering
  author: string; // Container author (usually 'peak.snaps')
  fetchedAt: number; // When this container was fetched by the app
}

// Ordered container map - Map maintains insertion order
class OrderedContainerMap {
  containers: Map<string, ContainerMetadata> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 4) {
    this.maxSize = maxSize;
  }

  // Set a container (maintains insertion order)
  set(permlink: string, container: ContainerMetadata): void {
    if (this.containers.size >= this.maxSize) {
      // Temporary solution: warn if max size reached
      console.warn(
        '📦 [OrderedContainerMap] Max size reached, cannot add more containers'
      );
      return;
    }
    this.containers.set(permlink, container);
    console.log(
      '📦 [ContainerMap] Set container',
      permlink,
      'with',
      container.snaps.length,
      'snaps'
    );
  }

  // Get all snaps in insertion order (flattened array)
  getAllSnaps(): Snap[] {
    const allSnaps: Snap[] = [];
    for (const [permlink, container] of this.containers) {
      allSnaps.push(...container.snaps);
    }
    return allSnaps;
  }

  // Debug: Log the current state of the ordered dictionary
  logState(): void {
    console.log('\n📚 [OrderedContainerMap] Current State:');
    console.log(
      '📚 [OrderedContainerMap] Size:',
      this.containers.size,
      '/',
      this.maxSize
    );

    let totalSnaps = 0;
    for (const [permlink, container] of this.containers) {
      console.log(
        `📚 [OrderedContainerMap] - "${permlink}": ${container.snaps.length} snaps (created: ${container.created})`
      );
      totalSnaps += container.snaps.length;
    }

    console.log('📚 [OrderedContainerMap] Total snaps:', totalSnaps);
    console.log(
      '📚 [OrderedContainerMap] Insertion order maintained:',
      Array.from(this.containers.keys())
    );
    console.log('📚 [OrderedContainerMap] End State\n');
  }

  // Get containers as array of [permlink, container] pairs in insertion order
  entries(): [string, ContainerMetadata][] {
    return Array.from(this.containers.entries());
  }

  // Get memory stats
  getStats(): {
    containersInMemory: number;
    totalSnaps: number;
    memoryUsage: string;
    registryInfo?: {
      totalTracked: number;
      inMemory: number;
      freed: number;
      snapsInRegistry: number;
    };
  } {
    const totalSnaps = this.getAllSnaps().length;
    return {
      containersInMemory: this.containers.size,
      totalSnaps,
      memoryUsage: this.containers.size + '/' + this.maxSize + ' containers',
      registryInfo: {
        totalTracked: this.containers.size,
        inMemory: this.containers.size,
        freed: 0,
        snapsInRegistry: totalSnaps,
      },
    };
  }

  // Clear all containers
  clear(): void {
    this.containers.clear();
  }

  // Get the last (most recently added) container permlink
  getLastPermlink(): string | undefined {
    const keys = Array.from(this.containers.keys());
    return keys[keys.length - 1];
  }

  // Get the last (most recently added) container author
  getLastAuthor(): string | undefined {
    const lastPermlink = this.getLastPermlink();
    if (lastPermlink) {
      const container = this.containers.get(lastPermlink);
      if (container) {
        return container.author;
      }
    }
    return undefined;
  }

  // Add public method to get keys in insertion order
  getKeys(): string[] {
    return Array.from(this.containers.keys());
  }

  // Add public method to delete a container by key
  delete(key: string): void {
    this.containers.delete(key);
  }

  // Add public method to get max size
  getMaxSize(): number {
    return this.maxSize;
  }

  // Add public method to check if a key exists
  has(key: string): boolean {
    return this.containers.has(key);
  }

  // Add public method to prepend a container and handle max size
  prepend(permlink: string, container: ContainerMetadata): void {
    if (this.containers.size >= this.maxSize) {
      console.warn(
        '📦 [OrderedContainerMap] Max size reached, cannot add more containers'
      );
      return;
    }

    // TODO: Implement a more robust prepend logic, and shift out the oldest if needed
    const entries = Array.from(this.containers.entries());
    // if (this.containers.size >= this.maxSize) {
    //   // Remove the oldest (first) entry
    //   entries.shift();
    // }
    this.containers = new Map([[permlink, container], ...entries]);
  }
}

interface FeedState {
  snaps: Snap[];
  loading: boolean;
  error: string | null;
  containerMap: OrderedContainerMap;
  currentFilter: FeedFilter; // Add internal filter state
}

interface UseFeedDataReturn extends FeedState {
  followingList: string[]; // From shared state
  fetchSnaps: (useCache?: boolean) => Promise<void>; // Remove filter parameter
  refreshSnaps: () => Promise<void>; // Remove filter parameter
  loadMoreSnaps: () => Promise<void>; // Remove filter parameter
  clearError: () => void;
  updateSnap: (
    author: string,
    permlink: string,
    updates: Partial<Snap>
  ) => void;
  fetchAndCacheFollowingList: (username: string) => Promise<string[]>;
  ensureFollowingListCached: (username: string) => Promise<void>;
  onScrollPositionChange: (index: number) => void;
  setFilter: (filter: FeedFilter) => void; // Add filter setter
  getMemoryStats: () => {
    containersInMemory: number;
    totalSnaps: number;
    memoryUsage: string;
    registryInfo?: {
      totalTracked: number;
      inMemory: number;
      freed: number;
      snapsInRegistry: number;
    };
  };
  canFetchMore: () => boolean; // Check if more snaps can be fetched
}

// Remove username param from useFeedData
export function useFeedData(): UseFeedDataReturn {
  // Always use the context username
  const username = useCurrentUser();
  const [state, setState] = useState<FeedState>({
    snaps: [],
    loading: false,
    error: null,
    containerMap: new OrderedContainerMap(4),
    currentFilter: 'newest', // Default filter
  });

  // Use shared state for following list (eliminates redundant API calls)
  const {
    followingList,
    needsRefresh: needsFollowingRefresh,
    setFollowingList,
    setLoading: setFollowingLoading,
    setError: setFollowingError,
  } = useFollowingList(username || '');

  const followingListRef = useRef(followingList);
  const needsFollowingRefreshRef = useRef(needsFollowingRefresh);
  useEffect(() => {
    followingListRef.current = followingList;
    needsFollowingRefreshRef.current = needsFollowingRefresh;
  }, [followingList, needsFollowingRefresh]);

  // Debug: Track username changes
  const prevUsernameRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevUsernameRef.current !== username) {
      console.log(
        '[useFeedData] username changed:',
        prevUsernameRef.current,
        '→',
        username
      );
      prevUsernameRef.current = username;
    } else {
      console.log('[useFeedData] username did NOT change:', username);
    }
  }, [username]);

  // Utility function to apply filtering to snaps
  const applyFilter = useCallback(
    (
      snaps: Snap[],
      filter: FeedFilter,
      followingList: string[],
      currentUsername: string | null
    ): Snap[] => {
      console.log(
        `🔍 [applyFilter] Applying filter "${filter}" to ${snaps.length} snaps`
      );

  let filteredSnaps = snaps;

      switch (filter) {
        case 'following':
          // Filter snaps from followed users
          console.log('🔍 [applyFilter] followingList:', followingList);
          filteredSnaps = snaps.filter(snap =>
            followingList.includes(snap.author)
          );
          console.log(
            `🔍 [applyFilter] Following filter: ${snaps.length} → ${filteredSnaps.length} snaps`
          );
          break;

        case 'my':
          // Filter snaps from current user
          console.log('🔍 [applyFilter] Current user:', currentUsername);
          filteredSnaps = snaps.filter(snap => snap.author === currentUsername);
          console.log(
            `🔍 [applyFilter] My snaps filter: ${snaps.length} → ${filteredSnaps.length} snaps`
          );
          break;

        case 'newest':
          // All snaps, sorted by newest (already sorted by default from containers)
          filteredSnaps = snaps;
          console.log(
            `🔍 [applyFilter] Newest filter: ${snaps.length} snaps (no filtering)`
          );
          break;

        case 'trending':
          // Sort by payout (trending) - create a new array to avoid mutating original
          filteredSnaps = [...snaps].sort((a, b) => {
            const payoutA =
              parseFloat(a.pending_payout_value?.replace(' HBD', '') || '0') +
              parseFloat(a.total_payout_value?.replace(' HBD', '') || '0') +
              parseFloat(a.curator_payout_value?.replace(' HBD', '') || '0');
            const payoutB =
              parseFloat(b.pending_payout_value?.replace(' HBD', '') || '0') +
              parseFloat(b.total_payout_value?.replace(' HBD', '') || '0') +
              parseFloat(b.curator_payout_value?.replace(' HBD', '') || '0');
            return payoutB - payoutA;
          });
          console.log(
            `🔍 [applyFilter] Trending filter: ${snaps.length} snaps sorted by payout`
          );
          break;

        default:
          console.log(
            `🔍 [applyFilter] Unknown filter "${filter}", using all snaps`
          );
          filteredSnaps = snaps;
      }

      // Moderation: drop items blocked by allowlisted moderators
      // Fast path: if active_votes present on snaps, apply immediately.
      const afterModeration = filteredSnaps.filter(s => {
        // If we already have a cached verdict and it is blocked, drop now
        const cached = ModerationService.getCached(s.author, s.permlink);
        if (cached?.isBlocked) return false;
        // If active_votes exist, evaluate once and cache
        if (Array.isArray(s.active_votes)) {
          const verdict = ModerationService.fromActiveVotes(s.author, s.permlink, s.active_votes);
          if (verdict?.isBlocked) return false;
        }
        return true;
      });

      return afterModeration;
    },
    []
  ); // Remove dependencies for stability

  // Helper: identifies snaps without loaded active_votes and with negative net_votes
  const isNegativeUnvotedSnap = useCallback((s: Snap): boolean => {
    return (
      (typeof s.active_votes === 'undefined' || s.active_votes === null) &&
      typeof s.net_votes === 'number' &&
      s.net_votes < 0
    );
  }, []);

  // Fire-and-forget avatar enrichment using unified AvatarService
  // This does not return enriched snaps; it updates state asynchronously when avatar URLs are resolved.
  const updateSnapsWithAvatars = useCallback(
    async (snaps: Snap[]) => {
      if (!snaps || snaps.length === 0) return;

      // Extract unique authors from the provided snaps
      const authors = Array.from(new Set(snaps.map(s => s.author)));

      // Immediately apply any cached URLs (or deterministic images.hive.blog fallback) to reduce empty avatars on first render
      const cachedUrls: Record<string, string> = {};
      authors.forEach(a => {
        const cached = avatarService.getCachedAvatarUrl(a);
        cachedUrls[a] = cached || `https://images.hive.blog/u/${a}/avatar/original`;
        try {
          console.log(`[Avatar][Feed] initial ${a} -> ${cachedUrls[a] || 'EMPTY'}`);
        } catch {}
      });
      setState(prev => ({
        ...prev,
        snaps: prev.snaps.map(s =>
          authors.includes(s.author) && !s.avatarUrl
            ? { ...s, avatarUrl: cachedUrls[s.author] }
            : s
        ),
      }));

      // Start loading avatars for all authors (fire-and-forget)
      avatarService.preloadAvatars(authors).catch(() => {});

      // Listener now handled by a single useEffect subscription with cleanup
      authors.forEach(author => {
        // Intentionally left for clarity; updates arrive via global subscription
      });
    },
    []
  );

  // Subscribe once to avatar updates and clean up on unmount
  useEffect(() => {
    const unsubscribe = avatarService.subscribe((updatedUsername, avatarUrl) => {
      try { console.log(`[Avatar][Feed] updated ${updatedUsername} -> ${avatarUrl || 'EMPTY'}`); } catch {}
      setState(prev => {
        let changed = false;
        const snaps = prev.snaps.map(s => {
          if (s.author === updatedUsername && s.avatarUrl !== avatarUrl) {
            changed = true;
            return { ...s, avatarUrl };
          }
          return s;
        });
        return changed ? { ...prev, snaps } : prev;
      });
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // Fetch snaps from containers and store in ordered dictionary
  const fetchSnaps = useCallback(
    async (useCache = false, limit: number = 1) => {
      console.log(
        '📦 [useFeedData] fetchSnaps called with useCache:',
        useCache,
        'currentFilter:',
        state.currentFilter,
        'limit:',
        limit
      );
      if (limit <= 0 || limit > 100) {
        console.warn(
          '📦 [useFeedData] Invalid limit:',
          limit,
          'using default limit of 1'
        );
        return;
      }

      try {
        console.log('📦 [QCP] permlink', state.containerMap.getLastPermlink());
        // Fetch containers from peak.snaps (using limit parameter)
        console.log('📦 [FetchSnaps] Fetching containers with limit', limit);
        const discussions = await client.database.call(
          'get_discussions_by_blog',
          [
            {
              tag: 'peak.snaps',
              limit,
              start_author: state.containerMap.getLastAuthor() || '',
              start_permlink: state.containerMap.getLastPermlink() || '',
            },
          ]
        );

        console.log('📦 [FetchSnaps] Found', discussions.length, 'containers');

        if (!discussions || discussions.length === 0) {
          setState(prev => ({
            ...prev,
            loading: false,
            snaps: prev.snaps,
          }));
          return;
        }

        // Get the first (and only) container
        for (const discussion of discussions) {
          if (!discussion.permlink || !discussion.author) {
            console.warn(
              '📦 [FetchSnaps] Skipping invalid discussion:',
              discussion
            );
            continue;
          }
          console.log(
            '📦 [FetchSnaps] Processing container:',
            discussion.permlink
          );
          // Fetch all snaps (replies) for this container
          const replies: Snap[] = await client.database.call(
            'get_content_replies',
            [discussion.author, discussion.permlink]
          );

          console.log(
            '📝 [FetchSnaps] Container',
            discussion.permlink,
            'has',
            replies.length,
            'snaps'
          );
          // Sort snaps by creation time (newest first)
          const sortedSnaps = replies.sort(
            (a, b) =>
              new Date(b.created).getTime() - new Date(a.created).getTime()
          );

          // Create container metadata
          const containerMetadata: ContainerMetadata = {
            permlink: discussion.permlink,
            snaps: sortedSnaps,
            created: discussion.created,
            author: discussion.author,
            fetchedAt: Date.now(),
          };

          setState(prev => {
            prev.containerMap.set(discussion.permlink, containerMetadata);
            return prev;
          });

          updateSnapsWithAvatars(containerMetadata.snaps);
        }

        setState(prev => {
          prev.containerMap.logState();
          const allSnaps = prev.containerMap.getAllSnaps();
          const filteredSnaps = applyFilter(
            allSnaps,
            prev.currentFilter,
            followingListRef.current || [],
            username
          );
          // Immediate enrichment for first paint
          const authors = Array.from(new Set(filteredSnaps.map(s => s.author)));
          const enriched = filteredSnaps.map(s => {
            const cached = avatarService.getCachedAvatarUrl(s.author);
            const chosen = s.avatarUrl || cached || `https://images.hive.blog/u/${s.author}/avatar/original`;
            try { console.log(`[Avatar][Feed] initial ${s.author} -> ${chosen || 'EMPTY'}`); } catch {}
            return { ...s, avatarUrl: chosen };
          });
          // Fire-and-forget preloading to backfill better sizes or late cache
          try { avatarService.preloadAvatars(authors).catch(() => {}); } catch {}
          return { ...prev, snaps: enriched, loading: false };
        });

        // Background moderation checks for negative-hinted items (no active_votes)
        try {
          const snapsToCheck = state.containerMap
            .getAllSnaps()
            .filter(isNegativeUnvotedSnap)
            .slice(0, 20); // limit checks per fetch
          // Ensure checks and filter updates arrive via state refresh on completion
          await Promise.all(
            snapsToCheck.map(async s => {
              const verdict = await ModerationService.ensureChecked(s.author, s.permlink);
              if (verdict.isBlocked) {
                setState(prev => ({
                  ...prev,
                  snaps: prev.snaps.filter(x => !(x.author === s.author && x.permlink === s.permlink)),
                }));
              }
            })
          );
        } catch {}
      } catch (error) {
        console.error('❌ [FetchSnaps] Error fetching snaps:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load snaps',
        }));
      }
    },
    [
      applyFilter,
      username,
      updateSnapsWithAvatars,
      state.currentFilter,
      state.containerMap,
    ]
  );

  const refreshSnaps = useCallback(async () => {
    console.log('🔄 [useFeedData] refreshSnaps called');

    // Fetch the latest container
    try {
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [
          {
            tag: 'peak.snaps',
            limit: 1,
          },
        ]
      );
      if (!discussions || discussions.length === 0) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }
      const containerPost = discussions[0];
      const replies: Snap[] = await client.database.call(
        'get_content_replies',
        [containerPost.author, containerPost.permlink]
      );
      const sortedSnaps = replies.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );
      const containerMetadata: ContainerMetadata = {
        permlink: containerPost.permlink,
        snaps: sortedSnaps,
        created: containerPost.created,
        author: containerPost.author,
        fetchedAt: Date.now(),
      };
  setState(prev => {
        const map = prev.containerMap;
        // Find the most recent container by created date
        let mostRecentKey: string | undefined;
        let mostRecentDate = 0;
        for (const [key, c] of map.entries()) {
          const d = new Date(c.created).getTime();
          if (d > mostRecentDate) {
            mostRecentDate = d;
            mostRecentKey = key;
          }
        }
        if (mostRecentKey && map.has(containerPost.permlink)) {
          map.set(containerPost.permlink, containerMetadata);
        } else {
          map.prepend(containerPost.permlink, containerMetadata);
        }
        map.logState();
  const allSnaps = map.getAllSnaps();
  const filteredSnaps = applyFilter(
          allSnaps,
          prev.currentFilter,
          followingListRef.current || [],
          username
        );
        // Immediate enrichment on refresh
        const authors = Array.from(new Set(filteredSnaps.map(s => s.author)));
        const enriched = filteredSnaps.map(s => {
          const cached = avatarService.getCachedAvatarUrl(s.author);
          const chosen = s.avatarUrl || cached || `https://images.hive.blog/u/${s.author}/avatar/original`;
          try { console.log(`[Avatar][Feed] initial ${s.author} -> ${chosen || 'EMPTY'}`); } catch {}
          return { ...s, avatarUrl: chosen };
        });
        try { avatarService.preloadAvatars(authors).catch(() => {}); } catch {}
        return { ...prev, snaps: enriched, loading: false };
      });
      // Kick background checks for negative-hinted items without active_votes
      try {
        const snapsToCheck = containerMetadata.snaps
          .filter(isNegativeUnvotedSnap)
          .slice(0, 20);
        await Promise.all(
          snapsToCheck.map(async s => {
            const verdict = await ModerationService.ensureChecked(s.author, s.permlink);
            if (verdict.isBlocked) {
              setState(prev => ({
                ...prev,
                snaps: prev.snaps.filter(x => !(x.author === s.author && x.permlink === s.permlink)),
              }));
            }
          })
        );
      } catch {}
      updateSnapsWithAvatars(containerMetadata.snaps);
    } catch (error) {
      console.error('❌ [refreshSnaps] Error refreshing snaps:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to refresh snaps',
      }));
    }
  }, [applyFilter, updateSnapsWithAvatars, username]);

  const loadMoreSnaps = useCallback(async () => {
    console.log(
      '📄 [useFeedData] loadMoreSnaps called with currentFilter:',
      state.currentFilter
    );

    setState(prev => {
      // Prevent concurrent loading
      if (prev.loading) {
        console.log('📄 [useFeedData] Already loading, ignoring loadMoreSnaps');
        return prev;
      }

      // Only proceed if we have at least one container (to get the next one)
      if (prev.containerMap.getLastPermlink() === undefined) {
        console.log(
          '📄 [useFeedData] No containers yet, calling fetchSnaps for initial load'
        );
        fetchSnaps();
        return prev;
      }

      console.log(
        '📄 [useFeedData] Loading more snaps from last permlink:',
        prev.containerMap.getLastPermlink()
      );
      fetchSnaps(false); // useCache = false for fresh data
      return prev;
    });
  }, [fetchSnaps, state.currentFilter]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const updateSnap = useCallback(
    (author: string, permlink: string, updates: Partial<Snap>) => {
      console.log(
        '📝 [useFeedData] updateSnap called for',
        author + '/' + permlink
      );
      setState(prev => {
        // Apply updates in-place to the flattened snaps array
        const updatedSnaps = prev.snaps.map(snap => {
          if (snap.author === author && snap.permlink === permlink) {
            // Support functional updaters inside updates values
            const next: any = { ...snap };
            Object.entries(updates).forEach(([key, value]) => {
              if (typeof value === 'function') {
                try {
                  next[key] = (value as any)(snap[key]);
                } catch {
                  next[key] = snap[key];
                }
              } else {
                next[key] = value as any;
              }
            });
            return next;
          }
          return snap;
        });

        // Also update the snap inside any containers we have cached
        const newMap = new OrderedContainerMap(prev.containerMap.getMaxSize());
        for (const [key, container] of prev.containerMap.entries()) {
          const newContainer: ContainerMetadata = {
            ...container,
            snaps: container.snaps.map(s =>
              s.author === author && s.permlink === permlink
                ? {
                    ...s,
                    ...Object.fromEntries(
                      Object.entries(updates).map(([k, v]) => [
                        k,
                        typeof v === 'function' ? (v as any)((s as any)[k]) : v,
                      ])
                    ),
                  }
                : s
            ),
          };
          newMap.set(key, newContainer);
        }

        return { ...prev, snaps: updatedSnaps, containerMap: newMap };
      });
    },
    []
  );

  // Fetch and cache following list (stable reference)
  const fetchAndCacheFollowingList = useCallback(
    async (username: string): Promise<string[]> => {
      console.log(
        '👤 [useFeedData] fetchAndCacheFollowingList called for',
        username
      );
      const cachedList = followingListRef.current;
      const needsRefresh = needsFollowingRefreshRef.current;
      if (cachedList && !needsRefresh) {
        console.log(
          '👤 [fetchAndCacheFollowingList] Using cached following list:',
          cachedList.length,
          'users'
        );
        return cachedList;
      }
      try {
        setFollowingLoading(true);
        const following = await client.database.call('get_following', [
          username,
          '',
          'blog',
          1000,
        ]);
        const followingUsernames = following.map((f: any) => f.following);
        console.log(
          '👤 [fetchAndCacheFollowingList] Fetched',
          followingUsernames.length,
          'users from blockchain'
        );
        setFollowingList(followingUsernames);
        setFollowingError(null);
        return followingUsernames;
      } catch (error) {
        console.error('❌ [fetchAndCacheFollowingList] Error:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to fetch following list';
        setFollowingError(errorMessage);
        return [];
      } finally {
        setFollowingLoading(false);
      }
    },
    [setFollowingList, setFollowingLoading, setFollowingError]
  );

  // Ensure following list is cached (stable reference)
  const ensureFollowingListCached = useCallback(
    async (username: string) => {
      console.log(
        '👤 [useFeedData] ensureFollowingListCached called for',
        username
      );
      const cachedList = followingListRef.current;
      const needsRefresh = needsFollowingRefreshRef.current;
      if (!cachedList || needsRefresh) {
        await fetchAndCacheFollowingList(username);
      } else {
        console.log(
          '👤 [ensureFollowingListCached] Using cached data:',
          cachedList.length,
          'users'
        );
      }
    },
    [fetchAndCacheFollowingList]
  );

  // Debug: Track function reference changes (after functions are defined)
  const prevFetchAndCacheRef = useRef<any>(fetchAndCacheFollowingList);
  const prevEnsureFollowingRef = useRef<any>(ensureFollowingListCached);
  useEffect(() => {
    if (prevFetchAndCacheRef.current !== fetchAndCacheFollowingList) {
      console.log('[useFeedData] fetchAndCacheFollowingList reference changed');
      prevFetchAndCacheRef.current = fetchAndCacheFollowingList;
    }
    if (prevEnsureFollowingRef.current !== ensureFollowingListCached) {
      console.log('[useFeedData] ensureFollowingListCached reference changed');
      prevEnsureFollowingRef.current = ensureFollowingListCached;
    }
  }, [fetchAndCacheFollowingList, ensureFollowingListCached]);

  const onScrollPositionChange = useCallback((index: number) => {
    console.log(
      '📜 [useFeedData] onScrollPositionChange called with index:',
      index
    );
    // Do nothing - just log
  }, []);

  const getMemoryStats = useCallback(() => {
    return state.containerMap.getStats();
  }, [state.containerMap]);

  // Fixed setFilter: now defined AFTER updateSnapsWithAvatars so it's available; avatar enrichment is triggered inside state update.
  const setFilter = useCallback(
    (filter: FeedFilter) => {
      console.log('🎯 [useFeedData] setFilter called:', filter);
      setState(prev => {
        const allSnaps = prev.containerMap.getAllSnaps();
        const filteredSnaps = applyFilter(
          allSnaps,
          filter,
          followingListRef.current || [],
          username
        );
        console.log(
          `🎯 [setFilter] Filter "${filter}": ${allSnaps.length} → ${filteredSnaps.length} snaps`
        );
        // Immediately enrich filtered snaps with cached avatar URLs (images.hive.blog fallback)
        let enrichedSnaps = filteredSnaps;
        if (filteredSnaps.length > 0) {
          const authors = Array.from(new Set(filteredSnaps.map(s => s.author)));
          enrichedSnaps = filteredSnaps.map(snap => ({
            ...snap,
            avatarUrl:
              snap.avatarUrl ||
              avatarService.getCachedAvatarUrl(snap.author) ||
              `https://images.hive.blog/u/${snap.author}/avatar/original`,
          }));
          // Optionally kick off background preloads to ensure updates arrive
          try { avatarService.preloadAvatars(authors).catch(() => {}); } catch {}
        }

        // Fire-and-forget fetch if list is very short
        if (enrichedSnaps.length < 4) {
          const containersToFetch =
            state.containerMap.getMaxSize() -
            state.containerMap.containers.size;
          console.log(
            `🎯 [setFilter] Fetching avatars for ${containersToFetch} containers`
          );
          fetchSnaps(false, containersToFetch); // Fetch more snaps if needed
        }
        return { ...prev, currentFilter: filter, snaps: enrichedSnaps };
      });
    },
    [applyFilter, username, updateSnapsWithAvatars]
  );

  // Add a function to check if we can fetch more containers (internal only)
  const canFetchMore = useCallback(() => {
    const containerCount = state.containerMap.getKeys().length;
    const maxSize = state.containerMap.getMaxSize();
    if (containerCount >= maxSize) return false;
    return true;
  }, [state.containerMap]);

  return {
    ...state,
    followingList: followingList || [], // Include following list from shared state
    fetchSnaps,
    refreshSnaps,
    loadMoreSnaps,
    clearError,
    updateSnap,
    fetchAndCacheFollowingList,
    ensureFollowingListCached,
    onScrollPositionChange,
    getMemoryStats,
    setFilter,
    canFetchMore,
  };
}
