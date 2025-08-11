import { useState, useCallback } from 'react';
import { Client } from '@hiveio/dhive';
import { useOptimisticUpdates } from './useOptimisticUpdates';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Configuration for testing different strategies
type FetchStrategy =
  | 'container-pagination'
  | 'hybrid-caching'
  | 'smart-container';

/*
  TESTING INSTRUCTIONS:
  To test different strategies, change the FETCH_STRATEGY value below:

  1. 'container-pagination': True pagination using start_author/start_permlink
     - Pros: True pagination, efficient memory usage
     - Cons: More complex state management
     - Best for: Apps with heavy usage and large datasets

  2. 'hybrid-caching': Large batch fetching with smart caching
     - Pros: Fast subsequent loads, good user experience
     - Cons: Higher initial memory usage
     - Best for: Apps with frequent refreshing

  3. 'smart-container': Analyzes container freshness and prioritizes active ones
     - Pros: Better content discovery, finds trending containers
     - Cons: More API calls for analysis
     - Best for: Apps wanting to surface the most active content

  Check the console logs to see how each strategy performs!
*/
const FETCH_STRATEGY: FetchStrategy = 'container-pagination';

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
  // Strategy-specific state
  containerCache?: Snap[];
  allSnaps?: Snap[]; // Store all fetched snaps for client-side filtering
  followingList?: string[]; // Cache the following list
  lastContainerIndex?: number;
  lastContainerAuthor?: string;
  lastContainerPermlink?: string;
  cacheTimestamp?: number;
  containerFreshness?: Record<string, number>;
}

interface UseFeedDataReturn extends FeedState {
  fetchSnaps: (filter: FeedFilter, useCache?: boolean) => Promise<void>;
  refreshSnaps: (filter: FeedFilter) => Promise<void>;
  loadMoreSnaps: (filter: FeedFilter) => Promise<void>;
  clearError: () => void;
  updateSnap: (
    author: string,
    permlink: string,
    updates: Partial<Snap>
  ) => void;
  setHasMore: (hasMore: boolean) => void; // Add function to control hasMore
}

export const useFeedData = (username: string | null): UseFeedDataReturn => {
  const [state, setState] = useState<FeedState>({
    snaps: [],
    loading: false,
    error: null,
    hasMore: false, // Default to false - can be controlled from FeedScreen
    containerCache: [],
    allSnaps: [], // Store all fetched snaps
    followingList: [], // Cache following list
    lastContainerIndex: 0,
    cacheTimestamp: 0,
    containerFreshness: {},
  });

  // Client-side filtering functions
  const applyFilter = useCallback(
    (
      allSnaps: Snap[],
      filter: FeedFilter,
      followingList?: string[]
    ): Snap[] => {
      if (!allSnaps || allSnaps.length === 0) {
        console.log(
          `⚠️ [Filter] No snaps available to filter - need to fetch more data!`
        );
        return [];
      }

      console.log(
        `🔍 [Filter] Applying ${filter} filter to ${allSnaps.length} cached snaps`
      );

      let filteredSnaps: Snap[] = [];

      switch (filter) {
        case 'newest':
          // Show all snaps without any filtering (they're already sorted newest first from API)
          console.log(
            `✅ [Filter] Showing all ${allSnaps.length} snaps (no filtering applied)`
          );
          filteredSnaps = allSnaps;
          break;

        case 'following':
          // Show only snaps from users you follow
          if (!username || !followingList || followingList.length === 0) {
            console.log(
              '⚠️ [Filter] No following list available for filtering - may need to fetch following data'
            );
            filteredSnaps = [];
          } else {
            filteredSnaps = allSnaps
              .filter(snap => followingList!.includes(snap.author))
              .sort(
                (a, b) =>
                  new Date(b.created).getTime() - new Date(a.created).getTime()
              );
            console.log(
              `✅ [Filter] Filtered to ${filteredSnaps.length} snaps from ${followingList.length} followed users`
            );

            if (filteredSnaps.length === 0) {
              console.log(
                `⚠️ [Filter] No snaps found from followed users - might need more containers or no followed users have posted`
              );
            }
          }
          break;

        case 'trending':
          // Sort by payout value (highest first)
          filteredSnaps = [...allSnaps].sort((a, b) => {
            const payoutA =
              parseFloat(
                a.pending_payout_value
                  ? a.pending_payout_value.replace(' HBD', '')
                  : '0'
              ) +
              parseFloat(
                a.total_payout_value
                  ? a.total_payout_value.replace(' HBD', '')
                  : '0'
              );
            const payoutB =
              parseFloat(
                b.pending_payout_value
                  ? b.pending_payout_value.replace(' HBD', '')
                  : '0'
              ) +
              parseFloat(
                b.total_payout_value
                  ? b.total_payout_value.replace(' HBD', '')
                  : '0'
              );
            return payoutB - payoutA;
          });
          break;

        case 'my':
          // Show only snaps from current user
          if (!username) {
            console.log('⚠️ [Filter] No username available for "my" filter');
            filteredSnaps = [];
          } else {
            filteredSnaps = allSnaps
              .filter(snap => snap.author === username)
              .sort(
                (a, b) =>
                  new Date(b.created).getTime() - new Date(a.created).getTime()
              );
            console.log(
              `✅ [Filter] Filtered to ${filteredSnaps.length} snaps from current user (@${username})`
            );

            if (filteredSnaps.length === 0) {
              console.log(
                `⚠️ [Filter] No snaps found from current user - might need more containers or user hasn't posted`
              );
            }
          }
          break;

        default:
          filteredSnaps = allSnaps;
      }

      console.log(
        `📊 [Filter] ${filter} filter result: ${filteredSnaps.length} snaps`
      );

      if (filteredSnaps.length < 5) {
        console.log(
          `⚠️ [Filter] Low snap count (${filteredSnaps.length}) - consider fetching more containers for better UX`
        );
      }

      return filteredSnaps;
    },
    [username]
  );

  // Fetch following list if needed
  const fetchFollowingList = useCallback(async (): Promise<string[]> => {
    if (!username) return [];

    try {
      console.log('[Following] Fetching following list...');
      const followingResult = await client.call(
        'condenser_api',
        'get_following',
        [username, '', 'blog', 100]
      );

      const following = Array.isArray(followingResult)
        ? followingResult.map((f: any) => f.following)
        : followingResult && followingResult.following
          ? followingResult.following
          : [];

      console.log(`[Following] Found ${following.length} followed users`);
      return following;
    } catch (err) {
      console.error('[Following] Error fetching following list:', err);
      return [];
    }
  }, [username]);

  // Strategy 1: Container-Based Pagination - SIMPLIFIED
  const fetchSnapsContainerPagination = useCallback(
    async (filter: FeedFilter, isLoadMore = false) => {
      console.log(
        `🔄 [Container Pagination] Fetching ${filter} - Load more: ${isLoadMore}`
      );

      let startAuthor = '';
      let startPermlink = '';

      // For load more, use pagination from the last container
      if (isLoadMore) {
        setState(prev => {
          startAuthor = prev.lastContainerAuthor || '';
          startPermlink = prev.lastContainerPermlink || '';
          console.log(
            `📄 [Pagination] Loading more from: ${startAuthor}/${startPermlink}`
          );
          return prev;
        });
      } else {
        console.log(`🔄 [Fresh Load] Starting from beginning`);
      }

      // Get containers with pagination
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [
          {
            tag: 'peak.snaps',
            limit: isLoadMore ? 2 : 1, // Get 2 when loading more to ensure we get next container
            start_author: startAuthor,
            start_permlink: startPermlink,
          },
        ]
      );

      console.log(
        `📦 [Container Pagination] Found ${discussions.length} containers`
      );

      if (!discussions || discussions.length === 0) {
        console.log(`⏹️ [Container Pagination] No more containers available`);
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Skip the first result if it's a continuation (same as start)
      let containersToProcess = discussions;
      if (
        isLoadMore &&
        discussions.length > 0 &&
        discussions[0].author === startAuthor &&
        discussions[0].permlink === startPermlink
      ) {
        containersToProcess = discussions.slice(1);
        console.log(
          `⏭️ [Pagination] Skipped duplicate container, processing ${containersToProcess.length} new containers`
        );
      }

      if (containersToProcess.length === 0) {
        console.log(
          `⏹️ [Container Pagination] No new containers after pagination skip`
        );
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Fetch replies for these containers
      const snapPromises = containersToProcess.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call(
            'get_content_replies',
            [post.author, post.permlink]
          );
          console.log(
            `📝 Container ${post.permlink} has ${replies.length} replies`
          );
          return replies;
        } catch (err) {
          console.error('❌ Error fetching replies:', err);
          return [];
        }
      });

      const snapResults = await Promise.allSettled(snapPromises);
      const newSnaps = snapResults
        .filter(
          (result): result is PromiseFulfilledResult<Snap[]> =>
            result.status === 'fulfilled'
        )
        .map(result => result.value)
        .flat();

      // Sort by creation time
      newSnaps.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      console.log(
        `📈 [Container Pagination] Found ${newSnaps.length} new snaps`
      );

      // Update pagination markers for next load
      const lastContainer = containersToProcess[containersToProcess.length - 1];

      if (isLoadMore) {
        // Append to existing snaps and allSnaps
        setState(prev => {
          const updatedAllSnaps = [...(prev.allSnaps || []), ...newSnaps];

          console.log(
            `📚 [Load More] Appending ${newSnaps.length} snaps to existing ${prev.allSnaps?.length || 0} (total: ${updatedAllSnaps.length})`
          );

          return {
            ...prev,
            allSnaps: updatedAllSnaps,
            snaps: [...prev.snaps, ...newSnaps], // For now, just append - could apply filter here
            lastContainerAuthor: lastContainer.author,
            lastContainerPermlink: lastContainer.permlink,
            hasMore: newSnaps.length > 0, // Has more if we got snaps
            loading: false,
          };
        });
      } else {
        // Fresh load - replace existing data
        setState(prev => ({
          ...prev,
          allSnaps: newSnaps,
          snaps: newSnaps,
          lastContainerAuthor: lastContainer.author,
          lastContainerPermlink: lastContainer.permlink,
          hasMore: true, // Always assume there's more after first load
          loading: false,
        }));
      }

      return newSnaps;
    },
    [] // Remove all dependencies to avoid loops
  );

  // Strategy 2: Hybrid Caching + Batching - SIMPLIFIED
  const fetchSnapsHybridCaching = useCallback(
    async (filter: FeedFilter, isLoadMore = false) => {
      console.log(
        `[Hybrid Caching] Fetching ${filter} - Load more: ${isLoadMore}`
      );

      // Simple caching: check if we have recent data
      const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
      const now = Date.now();

      if (
        !isLoadMore &&
        state.containerCache &&
        state.cacheTimestamp &&
        now - state.cacheTimestamp < CACHE_DURATION &&
        state.containerCache.length > 0
      ) {
        console.log('[Hybrid Caching] Using cached data');
        setState(prev => ({
          ...prev,
          snaps: prev.containerCache || [],
          loading: false,
        }));
        return state.containerCache;
      }

      console.log('[Hybrid Caching] Fetching fresh data');

      // Fetch containers
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [
          {
            tag: 'peak.snaps',
            limit: 8, // Larger batch for caching
          },
        ]
      );

      console.log(`[Hybrid Caching] Found ${discussions.length} containers`);

      if (!discussions || discussions.length === 0) {
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Fetch all replies
      const snapPromises = discussions.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call(
            'get_content_replies',
            [post.author, post.permlink]
          );
          return replies;
        } catch (err) {
          console.error('Error fetching replies:', err);
          return [];
        }
      });

      const snapResults = await Promise.allSettled(snapPromises);
      const allSnaps = snapResults
        .filter(
          (result): result is PromiseFulfilledResult<Snap[]> =>
            result.status === 'fulfilled'
        )
        .map(result => result.value)
        .flat();

      // Sort
      allSnaps.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      console.log(
        `[Hybrid Caching] Total snaps found: ${allSnaps.length}, caching for future use`
      );

      // Cache and display
      setState(prev => ({
        ...prev,
        snaps: allSnaps,
        containerCache: allSnaps,
        cacheTimestamp: now,
        hasMore: false, // Disable load more for now
        loading: false,
      }));

      return allSnaps;
    },
    [state.containerCache, state.cacheTimestamp] // Minimal dependencies
  );

  // Strategy 3: Smart Container Selection - SIMPLIFIED
  const fetchSnapsSmartContainer = useCallback(
    async (filter: FeedFilter, isLoadMore = false) => {
      console.log(
        `[Smart Container] Fetching ${filter} - Load more: ${isLoadMore}`
      );

      // Get containers
      const discussions = await client.database.call(
        'get_discussions_by_blog',
        [
          {
            tag: 'peak.snaps',
            limit: 6,
          },
        ]
      );

      console.log(
        `[Smart Container] Analyzing ${discussions.length} containers`
      );

      if (!discussions || discussions.length === 0) {
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Analyze container activity (simplified)
      const containerAnalysis = await Promise.all(
        discussions.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call(
              'get_content_replies',
              [post.author, post.permlink]
            );

            return {
              post,
              replies,
              replyCount: replies.length,
              latestReply:
                replies.length > 0
                  ? Math.max(...replies.map(r => new Date(r.created).getTime()))
                  : 0,
            };
          } catch (err) {
            console.error('Error analyzing container:', err);
            return { post, replies: [], replyCount: 0, latestReply: 0 };
          }
        })
      );

      // Sort by activity (reply count and recency)
      containerAnalysis.sort((a, b) => {
        if (a.replyCount !== b.replyCount) {
          return b.replyCount - a.replyCount; // More replies first
        }
        return b.latestReply - a.latestReply; // More recent activity first
      });

      console.log(
        '[Smart Container] Activity scores:',
        containerAnalysis.map(c => ({
          permlink: c.post.permlink,
          replies: c.replyCount,
        }))
      );

      // Combine all replies from top containers
      const allSnaps = containerAnalysis.map(c => c.replies).flat();

      allSnaps.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      console.log(`[Smart Container] Total snaps: ${allSnaps.length}`);

      setState(prev => ({
        ...prev,
        snaps: allSnaps,
        hasMore: false, // Disable load more for now
        loading: false,
      }));

      return allSnaps;
    },
    [] // No dependencies to avoid loops
  );

  // Main fetch function that delegates to the selected strategy
  const fetchSnaps = useCallback(
    async (filter: FeedFilter, useCache = true) => {
      console.log(
        `\n🔄 [FetchSnaps] Called with filter: "${filter}", useCache: ${useCache}`
      );

      // Prevent concurrent calls by checking if already loading
      if (state.loading) {
        console.log(
          `⏸️ [FetchSnaps] Already loading, skipping concurrent call`
        );
        return;
      }

      // Access current state inside the function to avoid stale closures
      setState(prev => {
        const currentState = prev;

        console.log(
          `📊 [FetchSnaps] Current cache state: ${currentState.allSnaps?.length || 0} total snaps, ${currentState.followingList?.length || 0} following, loading: ${currentState.loading}`
        );

        // If we have cached data and just switching filters, apply filter only
        if (
          useCache &&
          currentState.allSnaps &&
          currentState.allSnaps.length > 0 &&
          !currentState.loading
        ) {
          console.log(
            `\n=== 🚀 CLIENT-SIDE FILTERING: ${filter} (using ${currentState.allSnaps.length} cached snaps) ===`
          );
          console.log(
            `💡 [Cache Hit] No API call needed - filtering cached data instantly!`
          );

          const filteredSnaps = applyFilter(
            currentState.allSnaps,
            filter,
            currentState.followingList
          );

          console.log(
            `✅ Filter applied instantly - showing ${filteredSnaps.length} snaps for "${filter}" filter`
          );

          // Return updated state
          return {
            ...prev,
            snaps: filteredSnaps,
            loading: false,
          };
        } else {
          console.log(`\n=== 📡 CACHE MISS: Need to fetch fresh data ===`);
          console.log(
            `🔍 [Cache Miss Reason] useCache: ${useCache}, allSnaps: ${currentState.allSnaps?.length || 0}, loading: ${currentState.loading}, filter: ${filter}`
          );
        }

        // Mark as loading for fresh fetch
        return { ...prev, loading: true, error: null };
      });

      // Check if we already applied the filter above
      let shouldFetch = true;
      setState(prev => {
        if (useCache && prev.allSnaps && prev.allSnaps.length > 0) {
          shouldFetch = false;
        }
        return prev;
      });

      if (!shouldFetch) return;

      // Otherwise, fetch fresh data
      try {
        console.log(
          `\n=== 📡 Fetching Fresh Data with Strategy: ${FETCH_STRATEGY} ===`
        );
        console.log(
          `🏗️ [Fresh Fetch] About to call API to get more containers...`
        );

        // Get current following list
        let followingList: string[] = [];
        setState(prev => {
          followingList = prev.followingList || [];
          return prev;
        });

        // Fetch following list if needed and not cached
        if (filter === 'following' && followingList.length === 0) {
          console.log(
            `👥 [Following] Need to fetch following list for ${username}...`
          );
          followingList = await fetchFollowingList();
          console.log(
            `✅ [Following] Cached ${followingList.length} followed users`
          );
        }

        let allSnaps: Snap[] = [];

        console.log(
          `🎯 [Strategy] Using "${FETCH_STRATEGY}" strategy to fetch containers...`
        );
        const strategy = FETCH_STRATEGY as FetchStrategy;
        switch (strategy) {
          case 'container-pagination':
            allSnaps = await fetchSnapsContainerPagination(filter, false);
            break;
          case 'hybrid-caching':
            allSnaps = await fetchSnapsHybridCaching(filter, false);
            break;
          case 'smart-container':
            allSnaps = await fetchSnapsSmartContainer(filter, false);
            break;
          default:
            throw new Error(`Unknown strategy: ${strategy}`);
        }

        console.log(
          `📈 [${FETCH_STRATEGY}] Successfully fetched ${allSnaps.length} total snaps from containers`
        );

        if (allSnaps.length === 0) {
          console.log(
            `⚠️ [Empty Result] No snaps found - might need to check container availability or network`
          );
        }

        // Apply the requested filter
        console.log(
          `🔍 [Fresh Data] Now applying "${filter}" filter to ${allSnaps.length} newly fetched snaps...`
        );
        const filteredSnaps = applyFilter(allSnaps, filter, followingList);

        // Update state with both all snaps and filtered snaps
        setState(prev => ({
          ...prev,
          allSnaps: allSnaps,
          snaps: filteredSnaps,
          followingList: followingList,
          loading: false,
        }));

        console.log(
          `🎉 [${FETCH_STRATEGY}] Final result: ${filteredSnaps.length} snaps after ${filter} filter`
        );
        console.log(
          `💾 [Cache] Stored ${allSnaps.length} snaps for future client-side filtering`
        );
      } catch (err) {
        console.error(`Error with strategy ${FETCH_STRATEGY}:`, err);
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch snaps',
        }));
      }
    },
    [
      FETCH_STRATEGY,
      applyFilter,
      fetchFollowingList,
      fetchSnapsContainerPagination,
      fetchSnapsHybridCaching,
      fetchSnapsSmartContainer,
    ]
  );

  const loadMoreSnaps = useCallback(
    async (filter: FeedFilter) => {
      console.log(
        `\n📜 [LoadMore] User reached end of list - checking if more data available...`
      );
      console.log(
        `📊 [LoadMore] Current state: hasMore=${state.hasMore}, loading=${state.loading}, currentSnaps=${state.snaps.length}`
      );

      if (!state.hasMore || state.loading) {
        console.log(
          `⏹️ [LoadMore] Skipping - hasMore: ${state.hasMore}, loading: ${state.loading}`
        );
        return;
      }

      console.log(`\n=== 🔄 Load More with Strategy: ${FETCH_STRATEGY} ===`);
      console.log(
        `🏗️ [LoadMore] Fetching additional containers to get more snaps...`
      );

      try {
        const strategy = FETCH_STRATEGY as FetchStrategy;
        switch (strategy) {
          case 'container-pagination':
            console.log(
              `📦 [LoadMore] Using container pagination to fetch next batch...`
            );
            await fetchSnapsContainerPagination(filter, true);
            break;
          case 'hybrid-caching':
            console.log(
              `🔄 [LoadMore] Using hybrid caching to fetch more data...`
            );
            await fetchSnapsHybridCaching(filter, true);
            break;
          case 'smart-container':
            console.log(
              `🧠 [LoadMore] Using smart container selection to fetch more...`
            );
            await fetchSnapsSmartContainer(filter, true);
            break;
        }
        console.log(`✅ [LoadMore] Successfully loaded more data!`);
      } catch (err) {
        console.error(
          `❌ [LoadMore] Error loading more with strategy ${FETCH_STRATEGY}:`,
          err
        );
        setState(prev => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error ? err.message : 'Failed to load more snaps',
        }));
      }
    },
    [
      state.hasMore,
      state.loading,
      fetchSnapsContainerPagination,
      fetchSnapsHybridCaching,
      fetchSnapsSmartContainer,
    ]
  );

  const refreshSnaps = useCallback(
    async (filter: FeedFilter) => {
      console.log(
        `\n🔄 [Refresh] User pulled to refresh - clearing cache and fetching fresh data...`
      );
      console.log(
        `🗑️ [Refresh] Clearing all cached data for filter: ${filter}`
      );

      // Reset pagination state and fetch fresh
      setState(prev => ({
        ...prev,
        allSnaps: [], // Clear cached snaps
        followingList: [], // Clear following cache
        lastContainerIndex: 0,
        lastContainerAuthor: undefined,
        lastContainerPermlink: undefined,
        cacheTimestamp: 0,
        containerCache: undefined,
      }));

      console.log(`📡 [Refresh] Forcing fresh fetch (useCache=false)...`);
      await fetchSnaps(filter, false);
    },
    [fetchSnaps]
  );

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const { updateSnapInArray } = useOptimisticUpdates();

  const updateSnap = useCallback(
    (author: string, permlink: string, updates: Partial<Snap>) => {
      setState(prev => ({
        ...prev,
        snaps: updateSnapInArray(prev.snaps, author, permlink, updates),
      }));
    },
    [updateSnapInArray]
  );

  const setHasMore = useCallback((hasMore: boolean) => {
    setState(prev => ({ ...prev, hasMore }));
  }, []);

  return {
    ...state,
    fetchSnaps,
    refreshSnaps,
    loadMoreSnaps,
    clearError,
    updateSnap,
    setHasMore,
  };
};
