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
type FetchStrategy = 'container-pagination' | 'hybrid-caching' | 'smart-container';

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
  const applyFilter = useCallback((allSnaps: Snap[], filter: FeedFilter, followingList?: string[]): Snap[] => {
    if (!allSnaps || allSnaps.length === 0) return [];

    console.log(`[Filter] Applying ${filter} filter to ${allSnaps.length} snaps`);

    let filteredSnaps: Snap[] = [];

    switch (filter) {
      case 'newest':
        // Show all snaps, sorted by creation time (newest first)
        filteredSnaps = [...allSnaps].sort((a, b) => 
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        break;

      case 'following':
        // Show only snaps from users you follow
        if (!username || !followingList || followingList.length === 0) {
          console.log('[Filter] No following list available for filtering');
          filteredSnaps = [];
        } else {
          filteredSnaps = allSnaps
            .filter(snap => followingList!.includes(snap.author))
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
          console.log(`[Filter] Filtered to ${filteredSnaps.length} snaps from followed users`);
        }
        break;

      case 'trending':
        // Sort by payout value (highest first)
        filteredSnaps = [...allSnaps].sort((a, b) => {
          const payoutA = parseFloat(
            a.pending_payout_value ? a.pending_payout_value.replace(' HBD', '') : '0'
          ) + parseFloat(
            a.total_payout_value ? a.total_payout_value.replace(' HBD', '') : '0'
          );
          const payoutB = parseFloat(
            b.pending_payout_value ? b.pending_payout_value.replace(' HBD', '') : '0'
          ) + parseFloat(
            b.total_payout_value ? b.total_payout_value.replace(' HBD', '') : '0'
          );
          return payoutB - payoutA;
        });
        break;

      case 'my':
        // Show only snaps from current user
        if (!username) {
          console.log('[Filter] No username available for "my" filter');
          filteredSnaps = [];
        } else {
          filteredSnaps = allSnaps
            .filter(snap => snap.author === username)
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
          console.log(`[Filter] Filtered to ${filteredSnaps.length} snaps from current user`);
        }
        break;

      default:
        filteredSnaps = allSnaps;
    }

    console.log(`[Filter] ${filter} filter result: ${filteredSnaps.length} snaps`);
    return filteredSnaps;
  }, [username]);

  // Fetch following list if needed
  const fetchFollowingList = useCallback(async (): Promise<string[]> => {
    if (!username) return [];
    
    try {
      console.log('[Following] Fetching following list...');
      const followingResult = await client.call('condenser_api', 'get_following', [
        username, '', 'blog', 100
      ]);
      
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
      console.log(`[Container Pagination] Fetching ${filter} - Load more: ${isLoadMore}`);
      
      // Simple approach: just get containers and replies
      const discussions = await client.database.call('get_discussions_by_blog', [
        {
          tag: 'peak.snaps',
          limit: 5
        }
      ]);

      console.log(`[Container Pagination] Found ${discussions.length} containers`);

      if (!discussions || discussions.length === 0) {
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Fetch replies for these containers
      const snapPromises = discussions.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call('get_content_replies', [
            post.author, 
            post.permlink
          ]);
          console.log(`Container ${post.permlink} has ${replies.length} replies`);
          return replies;
        } catch (err) {
          console.error('Error fetching replies:', err);
          return [];
        }
      });

      const snapResults = await Promise.allSettled(snapPromises);
      const allSnaps = snapResults
        .filter((result): result is PromiseFulfilledResult<Snap[]> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value)
        .flat();

      // Sort by creation time
      allSnaps.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      console.log(`[Container Pagination] Total snaps: ${allSnaps.length}`);

      // For now, just show all snaps (no pagination logic to avoid loops)
      setState(prev => ({
        ...prev,
        snaps: allSnaps,
        hasMore: false, // Disable load more for now
        loading: false,
      }));

      return allSnaps;
    },
    [] // Remove all dependencies to avoid loops
  );

  // Strategy 2: Hybrid Caching + Batching - SIMPLIFIED
  const fetchSnapsHybridCaching = useCallback(
    async (filter: FeedFilter, isLoadMore = false) => {
      console.log(`[Hybrid Caching] Fetching ${filter} - Load more: ${isLoadMore}`);
      
      // Simple caching: check if we have recent data
      const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
      const now = Date.now();
      
      if (!isLoadMore && state.containerCache && state.cacheTimestamp && 
          (now - state.cacheTimestamp) < CACHE_DURATION && state.containerCache.length > 0) {
        console.log('[Hybrid Caching] Using cached data');
        setState(prev => ({ ...prev, snaps: prev.containerCache || [], loading: false }));
        return state.containerCache;
      }

      console.log('[Hybrid Caching] Fetching fresh data');

      // Fetch containers
      const discussions = await client.database.call('get_discussions_by_blog', [
        {
          tag: 'peak.snaps',
          limit: 8 // Larger batch for caching
        }
      ]);

      console.log(`[Hybrid Caching] Found ${discussions.length} containers`);

      if (!discussions || discussions.length === 0) {
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Fetch all replies
      const snapPromises = discussions.map(async (post: any) => {
        try {
          const replies: Snap[] = await client.database.call('get_content_replies', [
            post.author, 
            post.permlink
          ]);
          return replies;
        } catch (err) {
          console.error('Error fetching replies:', err);
          return [];
        }
      });

      const snapResults = await Promise.allSettled(snapPromises);
      const allSnaps = snapResults
        .filter((result): result is PromiseFulfilledResult<Snap[]> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value)
        .flat();

      // Sort
      allSnaps.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      console.log(`[Hybrid Caching] Total snaps found: ${allSnaps.length}, caching for future use`);

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
      console.log(`[Smart Container] Fetching ${filter} - Load more: ${isLoadMore}`);
      
      // Get containers
      const discussions = await client.database.call('get_discussions_by_blog', [
        {
          tag: 'peak.snaps',
          limit: 6,
        }
      ]);

      console.log(`[Smart Container] Analyzing ${discussions.length} containers`);

      if (!discussions || discussions.length === 0) {
        setState(prev => ({ ...prev, hasMore: false, loading: false }));
        return [];
      }

      // Analyze container activity (simplified)
      const containerAnalysis = await Promise.all(
        discussions.map(async (post: any) => {
          try {
            const replies: Snap[] = await client.database.call('get_content_replies', [
              post.author, 
              post.permlink
            ]);
            
            return {
              post,
              replies,
              replyCount: replies.length,
              latestReply: replies.length > 0 ? Math.max(...replies.map(r => new Date(r.created).getTime())) : 0
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

      console.log('[Smart Container] Activity scores:', 
        containerAnalysis.map(c => ({ 
          permlink: c.post.permlink, 
          replies: c.replyCount 
        }))
      );

      // Combine all replies from top containers
      const allSnaps = containerAnalysis.map(c => c.replies).flat();

      allSnaps.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
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
      // Access current state inside the function to avoid stale closures
      setState(prev => {
        const currentState = prev;
        
        // If we have cached data and just switching filters, apply filter only
        if (useCache && currentState.allSnaps && currentState.allSnaps.length > 0) {
          console.log(`\n=== 🚀 CLIENT-SIDE FILTERING: ${filter} (using ${currentState.allSnaps.length} cached snaps) ===`);
          
          const filteredSnaps = applyFilter(currentState.allSnaps, filter, currentState.followingList);
          
          console.log(`✅ Filter applied instantly - showing ${filteredSnaps.length} snaps for "${filter}" filter`);
          
          // Return updated state
          return {
            ...prev,
            snaps: filteredSnaps,
            loading: false,
          };
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
        console.log(`\n=== Fetching Fresh Data with Strategy: ${FETCH_STRATEGY} ===`);
        
        // Get current following list
        let followingList: string[] = [];
        setState(prev => {
          followingList = prev.followingList || [];
          return prev;
        });
        
        // Fetch following list if needed and not cached
        if (filter === 'following' && followingList.length === 0) {
          followingList = await fetchFollowingList();
        }
        
        let allSnaps: Snap[] = [];
        
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

        console.log(`[${FETCH_STRATEGY}] Fetched ${allSnaps.length} total snaps`);
        
        // Apply the requested filter
        const filteredSnaps = applyFilter(allSnaps, filter, followingList);

        // Update state with both all snaps and filtered snaps
        setState(prev => ({
          ...prev,
          allSnaps: allSnaps,
          snaps: filteredSnaps,
          followingList: followingList,
          loading: false,
        }));

        console.log(`[${FETCH_STRATEGY}] Final result: ${filteredSnaps.length} snaps after ${filter} filter`);

      } catch (err) {
        console.error(`Error with strategy ${FETCH_STRATEGY}:`, err);
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch snaps',
        }));
      }
    },
    [FETCH_STRATEGY, applyFilter, fetchFollowingList, fetchSnapsContainerPagination, fetchSnapsHybridCaching, fetchSnapsSmartContainer]
  );

  const loadMoreSnaps = useCallback(
    async (filter: FeedFilter) => {
      if (!state.hasMore || state.loading) return;
      
      console.log(`\n=== Load More with Strategy: ${FETCH_STRATEGY} ===`);
      
      try {        
        const strategy = FETCH_STRATEGY as FetchStrategy;
        switch (strategy) {
          case 'container-pagination':
            await fetchSnapsContainerPagination(filter, true);
            break;
          case 'hybrid-caching':
            await fetchSnapsHybridCaching(filter, true);
            break;
          case 'smart-container':
            await fetchSnapsSmartContainer(filter, true);
            break;
        }
      } catch (err) {
        console.error(`Error loading more with strategy ${FETCH_STRATEGY}:`, err);
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load more snaps',
        }));
      }
    },
    [state.hasMore, state.loading, fetchSnapsContainerPagination, fetchSnapsHybridCaching, fetchSnapsSmartContainer]
  );

  const refreshSnaps = useCallback(
    async (filter: FeedFilter) => {
      // Reset pagination state and fetch fresh
      setState(prev => ({
        ...prev,
        lastContainerIndex: 0,
        lastContainerAuthor: undefined,
        lastContainerPermlink: undefined,
        cacheTimestamp: 0,
        containerCache: undefined,
      }));
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
