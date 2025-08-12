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

interface ContainerMetadata {
  author: string;
  permlink: string;
  snaps: Snap[];
  index: number; // Position in the sequence (0, 1, 2, 3, ...)
  timestamp: number; // When it was fetched
}

// Linked list node for efficient prepending/appending
interface ContainerNode {
  data: ContainerMetadata;
  next: ContainerNode | null;
  prev: ContainerNode | null;
}

// Doubly-linked list for container management
class ContainerList {
  private head: ContainerNode | null = null;
  private tail: ContainerNode | null = null;
  private size = 0;
  private maxSize: number;

  constructor(maxSize: number = 4) {
    this.maxSize = maxSize;
  }

  // Add container to the end (most recent)
  append(container: ContainerMetadata): void {
    const newNode: ContainerNode = {
      data: container,
      next: null,
      prev: this.tail,
    };

    if (this.tail) {
      this.tail.next = newNode;
    } else {
      this.head = newNode;
    }
    this.tail = newNode;
    this.size++;

    console.log(
      `📦 [LinkedList] Appended container ${container.index} (${container.author}/${container.permlink}) with ${container.snaps.length} snaps`
    );

    this.enforceSizeLimit();
  }

  // Add container to the beginning (older content)
  prepend(container: ContainerMetadata): void {
    const newNode: ContainerNode = {
      data: container,
      next: this.head,
      prev: null,
    };

    if (this.head) {
      this.head.prev = newNode;
    } else {
      this.tail = newNode;
    }
    this.head = newNode;
    this.size++;

    console.log(
      `📦 [LinkedList] Prepended container ${container.index} (${container.author}/${container.permlink}) with ${container.snaps.length} snaps`
    );

    this.enforceSizeLimit();
  }

  // Enforce size limit by removing from the head (oldest container)
  private enforceSizeLimit(): void {
    if (this.size > this.maxSize) {
      // Since we append new containers to the tail, the head contains the oldest container
      // Remove the head to keep the most recent containers in memory
      this.removeHead();
    }
  }

  // Remove the tail (newest container since we append new ones to tail)
  private removeTail(): ContainerNode | null {
    if (!this.tail) return null;

    const removed = this.tail;

    console.log(
      `🗑️ [LinkedList] MEMORY CLEANUP: Removing tail container ${removed.data.index} (${removed.data.author}/${removed.data.permlink}) with ${removed.data.snaps.length} snaps`
    );

    if (this.tail.prev) {
      this.tail.prev.next = null;
      this.tail = this.tail.prev;
    } else {
      this.head = null;
      this.tail = null;
    }
    this.size--;

    console.log(
      `💾 [LinkedList] Memory optimization: size reduced to ${this.size}/${this.maxSize}`
    );

    return removed;
  }

  // Remove the head (oldest container since we append new ones to tail)
  private removeHead(): ContainerNode | null {
    if (!this.head) return null;

    const removed = this.head;

    console.log(
      `🗑️ [LinkedList] MEMORY CLEANUP: Removing head container ${removed.data.index} (${removed.data.author}/${removed.data.permlink}) with ${removed.data.snaps.length} snaps`
    );

    if (this.head.next) {
      this.head.next.prev = null;
      this.head = this.head.next;
    } else {
      this.head = null;
      this.tail = null;
    }
    this.size--;

    console.log(
      `💾 [LinkedList] Memory optimization: size reduced to ${this.size}/${this.maxSize}`
    );

    return removed;
  }

  // Convert to array for compatibility (ordered from oldest to newest)
  toArray(): ContainerMetadata[] {
    const result: ContainerMetadata[] = [];
    let current = this.head;
    while (current) {
      result.push(current.data);
      current = current.next;
    }
    return result;
  }

  // Get all snaps from all containers
  getAllSnaps(): Snap[] {
    const allSnaps: Snap[] = [];
    let current = this.head;
    while (current) {
      allSnaps.push(...current.data.snaps);
      current = current.next;
    }
    return allSnaps;
  }

  // Get size
  getSize(): number {
    return this.size;
  }

  // Get oldest container (head)
  getOldest(): ContainerMetadata | null {
    return this.head?.data || null;
  }

  // Get newest container (tail)
  getNewest(): ContainerMetadata | null {
    return this.tail?.data || null;
  }

  // Clear all containers
  clear(): void {
    this.head = null;
    this.tail = null;
    this.size = 0;
    console.log(`🗑️ [LinkedList] Cleared all containers`);
  }

  // Get memory stats
  getStats(): {
    containersInMemory: number;
    totalSnaps: number;
    memoryUsage: string;
  } {
    const totalSnaps = this.getAllSnaps().length;
    const avgSnapsPerContainer =
      this.size > 0 ? Math.round(totalSnaps / this.size) : 0;

    return {
      containersInMemory: this.size,
      totalSnaps,
      memoryUsage: `${this.size}/${this.maxSize} containers, ~${avgSnapsPerContainer} snaps/container`,
    };
  }
}

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
  // Memory management for containers
  containerList: ContainerList; // Linked list for efficient prepending/appending
  maxContainers: number; // Maximum containers to keep in memory
  currentPosition: number; // Current scroll position indicator
  currentFilter?: FeedFilter; // Track current filter for prefetching
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
  fetchAndCacheFollowingList: (username: string) => Promise<string[]>; // Add this function
  ensureFollowingListCached: (username: string) => Promise<void>; // Add this function too
  // Memory management functions
  onScrollPositionChange: (index: number) => void; // Track scroll position for prefetching
  getMemoryStats: () => {
    containersInMemory: number;
    totalSnaps: number;
    memoryUsage: string;
  }; // Debug info
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
    containerList: new ContainerList(4), // Initialize with max 4 containers
    maxContainers: 4, // Keep max 4 containers in memory
    currentPosition: 0, // Initialize current position
    currentFilter: 'newest', // Default filter
  });

  // Function to fetch and cache following list - to be called from FeedScreen
  const fetchAndCacheFollowingList = useCallback(async (username: string) => {
    console.log(
      `👤 [FetchFollowing] ===== FETCHING FOLLOWING LIST FOR ${username} =====`
    );

    try {
      const following = await client.database.call('get_following', [
        username,
        '',
        'blog',
        100,
      ]);
      const followingList = following.map((f: any) => f.following);

      console.log(
        `✅ [FetchFollowing] Fetched ${followingList.length} followed users for ${username}`
      );

      setState(prev => ({
        ...prev,
        followingList: followingList,
      }));

      console.log(
        `✅ [FetchFollowing] ===== FOLLOWING LIST STORED IN STATE =====`
      );

      return followingList;
    } catch (error) {
      console.error(
        `❌ [FetchFollowing] Failed to fetch following list for ${username}:`,
        error
      );
      return [];
    }
  }, []);

  // Function to check if following list needs to be fetched
  const ensureFollowingListCached = useCallback(
    async (username: string) => {
      return new Promise<void>(resolve => {
        setState(prev => {
          const hasFollowingList =
            prev.followingList && prev.followingList.length > 0;

          console.log(
            `🔍 [EnsureFollowing] Checking following list for ${username}: ${hasFollowingList ? 'CACHED' : 'MISSING'}`
          );

          if (!hasFollowingList) {
            console.log(
              `📞 [EnsureFollowing] Following list missing - triggering fetch...`
            );
            // Trigger fetch asynchronously
            fetchAndCacheFollowingList(username).then(() => {
              console.log(
                `✅ [EnsureFollowing] Following list fetch completed for ${username}`
              );
              // Add a small delay to ensure state update is processed
              setTimeout(() => {
                console.log(
                  `✅ [EnsureFollowing] State update delay complete - resolving promise`
                );
                resolve();
              }, 50);
            });
          } else {
            console.log(
              `✅ [EnsureFollowing] Following list already cached (${prev.followingList?.length} users)`
            );
            resolve();
          }

          return prev; // Don't modify state here
        });
      });
    },
    [fetchAndCacheFollowingList]
  );

  // Client-side filtering functions
  const applyFilter = useCallback(
    (
      allSnaps: Snap[],
      filter: FeedFilter,
      followingList?: string[]
    ): Snap[] => {
      console.log(
        `\n🔍 [Filter] ===== APPLYING FILTER: ${filter.toUpperCase()} =====`
      );

      if (!allSnaps || allSnaps.length === 0) {
        console.log(
          `⚠️ [Filter] No snaps available to filter - need to fetch more data!`
        );
        return [];
      }

      console.log(
        `🔍 [Filter] Input: ${allSnaps.length} cached snaps, ${followingList?.length || 0} following list`
      );

      let filteredSnaps: Snap[] = [];

      switch (filter) {
        case 'newest':
          // Show all snaps without any filtering (they're already sorted newest first from API)
          console.log(
            `✅ [Filter] NEWEST: Showing all ${allSnaps.length} snaps (no filtering applied)`
          );
          filteredSnaps = allSnaps;
          break;

        case 'following':
          // Show only snaps from users you follow
          console.log(
            `🔍 [Filter] FOLLOWING: Filtering ${allSnaps.length} snaps for followed users...`
          );
          if (!username || !followingList || followingList.length === 0) {
            console.log(
              '⚠️ [Filter] FOLLOWING: No following list available for filtering - may need to fetch following data'
            );
            console.log(
              `⚠️ [Filter] FOLLOWING: username=${username}, followingList.length=${followingList?.length || 0}`
            );

            // If username is available but following list is empty, we should trigger a fetch
            if (username && (!followingList || followingList.length === 0)) {
              console.log(
                `🚨 [Filter] FOLLOWING: Username available but no following list! This suggests the following list hasn't been fetched yet.`
              );
              console.log(
                `💡 [Filter] FOLLOWING: Consider calling fetchAndCacheFollowingList("${username}") from FeedScreen`
              );
            }

            filteredSnaps = [];
          } else {
            filteredSnaps = allSnaps
              .filter(snap => followingList!.includes(snap.author))
              .sort(
                (a, b) =>
                  new Date(b.created).getTime() - new Date(a.created).getTime()
              );
            console.log(
              `✅ [Filter] FOLLOWING: Found ${filteredSnaps.length} snaps from ${followingList.length} followed users`
            );

            if (filteredSnaps.length === 0) {
              console.log(
                `⚠️ [Filter] FOLLOWING: No snaps found from followed users - might need more containers or no followed users have posted`
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
        `📊 [Filter] ===== FILTER RESULT: ${filter.toUpperCase()} =====`
      );
      console.log(
        `📊 [Filter] ${filter} filter result: ${filteredSnaps.length} snaps (from ${allSnaps.length} total)`
      );

      if (filteredSnaps.length < 5) {
        console.log(
          `⚠️ [Filter] Low snap count (${filteredSnaps.length}) - consider fetching more containers for better UX`
        );
      }

      console.log(`✅ [Filter] ===== FILTER COMPLETE =====\n`);

      return filteredSnaps;
    },
    [username]
  );

  // Strategy 1: Container-Based Pagination with Memory Management
  const fetchSnapsContainerPagination = useCallback(
    async (filter: FeedFilter, isLoadMore = false) => {
      console.log(
        `\n📦 [Memory Pagination] ===== CONTAINER PAGINATION API CALL =====`
      );
      console.log(
        `📡 [Memory Pagination] Making API call for ${filter} - Load more: ${isLoadMore}`
      );
      console.log(
        `🧠 [Memory Pagination] Current containers in memory: ${state.containerList.getSize()}/${state.maxContainers}`
      );

      let startAuthor = '';
      let startPermlink = '';
      let containerIndex = 0;

      // For load more, use pagination from the last container
      if (isLoadMore) {
        setState(prev => {
          startAuthor = prev.lastContainerAuthor || '';
          startPermlink = prev.lastContainerPermlink || '';
          containerIndex = (prev.lastContainerIndex || 0) + 1;
          console.log(
            `📄 [Memory Pagination] Loading more from: ${startAuthor}/${startPermlink} (index: ${containerIndex})`
          );
          return prev;
        });
      } else {
        console.log(`🔄 [Memory Pagination] Starting from beginning`);
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
        `📦 [Memory Pagination] Found ${discussions.length} containers`
      );

      if (!discussions || discussions.length === 0) {
        console.log(`⏹️ [Memory Pagination] No more containers available`);
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
          `⏭️ [Memory Pagination] Skipped duplicate container, processing ${containersToProcess.length} new containers`
        );
      }

      if (containersToProcess.length === 0) {
        console.log(
          `⏹️ [Memory Pagination] No new containers after pagination skip`
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
          return { post, replies };
        } catch (err) {
          console.error('❌ Error fetching replies:', err);
          return { post, replies: [] };
        }
      });

      const snapResults = await Promise.allSettled(snapPromises);
      const containerResults = snapResults
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<{ post: any; replies: Snap[] }> =>
            result.status === 'fulfilled'
        )
        .map(result => result.value);

      // Update pagination markers for next load
      const lastContainer = containersToProcess[containersToProcess.length - 1];

      // Create container metadata and update state with memory management
      setState(prev => {
        console.log(
          `🔍 [Container Processing] Initial prev.followingList: ${prev.followingList?.length || 0} users`
        );
        let updatedState = { ...prev };
        console.log(
          `🔍 [Container Processing] Initial updatedState.followingList: ${updatedState.followingList?.length || 0} users`
        );

        // Process each container
        containerResults.forEach((containerResult, idx) => {
          const { post, replies } = containerResult;
          const currentIndex = isLoadMore ? containerIndex + idx : idx;

          // Deduplicate snaps for this container
          const dedupedSnaps = deduplicateSnaps(replies);

          // Create container metadata
          const containerMetadata: ContainerMetadata = {
            author: post.author,
            permlink: post.permlink,
            snaps: dedupedSnaps,
            index: currentIndex,
            timestamp: Date.now(),
          };

          // Add container using memory management
          updatedState = addContainer(containerMetadata, updatedState);
        });

        console.log(
          `🔍 [Container Processing] After all containers, updatedState.followingList: ${updatedState.followingList?.length || 0} users`
        );

        // Get current snaps from all containers in memory
        const currentSnaps = getCurrentSnapsFromContainers(
          updatedState.containerList,
          filter,
          prev.followingList
        );

        console.log(
          `🧠 [Memory Pagination] Memory state: ${updatedState.containerList.getSize()} containers, ${currentSnaps.length} total snaps`
        );

        // Update allSnaps for backward compatibility with other parts of the code
        const allSnapsFromContainers = updatedState.containerList.getAllSnaps();

        console.log(
          `🔍 [Final Container State] Before return, updatedState.followingList: ${updatedState.followingList?.length || 0} users`
        );
        console.log(
          `🔍 [Final Container State] Before return, prev.followingList: ${prev.followingList?.length || 0} users`
        );

        return {
          ...updatedState,
          snaps: currentSnaps,
          allSnaps: deduplicateSnaps(allSnapsFromContainers),
          lastContainerAuthor: lastContainer.author,
          lastContainerPermlink: lastContainer.permlink,
          lastContainerIndex: isLoadMore
            ? containerIndex + containerResults.length - 1
            : containerResults.length - 1,
          hasMore: containerResults.length > 0,
          loading: false,
          currentFilter: filter,
          // Explicitly preserve the following list
          followingList: updatedState.followingList || prev.followingList,
        };
      });

      // Return the snaps for backward compatibility
      const allNewSnaps = containerResults.map(r => r.replies).flat();
      return deduplicateSnaps(allNewSnaps);
    },
    []
    // Note: Dependencies will be added when functions are defined
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
      const rawSnaps = snapResults
        .filter(
          (result): result is PromiseFulfilledResult<Snap[]> =>
            result.status === 'fulfilled'
        )
        .map(result => result.value)
        .flat();

      // Deduplicate snaps before sorting
      const allSnaps = deduplicateSnaps(rawSnaps);

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
      const rawSnaps = containerAnalysis.map(c => c.replies).flat();
      const allSnaps = deduplicateSnaps(rawSnaps);

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
      console.log(`\n🔄 [FetchSnaps] ===== FILTER SWITCH DEBUG =====`);
      console.log(
        `🎯 [FetchSnaps] Called with filter: "${filter}", useCache: ${useCache}`
      );
      console.log(
        `📍 [FetchSnaps] This should use CLIENT-SIDE filtering if switching between cached filters`
      );

      // Check for client-side filtering first (before loading check)
      let canUseClientSideFiltering = false;
      let currentAllSnaps: Snap[] = [];
      let currentFollowingList: string[] = [];
      let isCurrentlyLoading = false;

      // Use setState callback to get the most current state
      await new Promise<void>(resolve => {
        setState(prev => {
          console.log(`📊 [FetchSnaps] ===== CACHE STATE ANALYSIS =====`);
          console.log(
            `📊 [FetchSnaps] Current cache state: ${prev.allSnaps?.length || 0} total snaps, ${prev.followingList?.length || 0} following, loading: ${prev.loading}`
          );
          console.log(
            `📊 [FetchSnaps] useCache: ${useCache}, has allSnaps: ${!!(prev.allSnaps && prev.allSnaps.length > 0)}`
          );

          // Store the current loading state for later use
          isCurrentlyLoading = prev.loading;

          // Check if we can use client-side filtering
          if (useCache && prev.allSnaps && prev.allSnaps.length > 0) {
            console.log(
              `✅ [FetchSnaps] ===== CAN USE CLIENT-SIDE FILTERING! =====`
            );
            canUseClientSideFiltering = true;
            currentAllSnaps = prev.allSnaps;
            currentFollowingList = prev.followingList || [];
            console.log(
              `📋 [FetchSnaps] Captured for filtering: ${currentAllSnaps.length} snaps, ${currentFollowingList.length} following`
            );

            // Debug: Log some of the following list
            if (currentFollowingList.length > 0) {
              console.log(
                `👥 [Debug] First few followed users: ${currentFollowingList.slice(0, 3).join(', ')}`
              );
            } else {
              console.log(
                `❌ [Debug] Following list is empty in state! This is the problem.`
              );
            }
          } else {
            console.log(
              `❌ [FetchSnaps] ===== CANNOT USE CLIENT-SIDE FILTERING =====`
            );
            console.log(
              `❌ [FetchSnaps] Reason: useCache=${useCache}, allSnaps.length=${prev.allSnaps?.length || 0}`
            );
          }

          resolve();
          return prev; // Don't modify state
        });
      });

      // If we can use client-side filtering, do it immediately
      if (canUseClientSideFiltering) {
        console.log(
          `\n🚀 [FetchSnaps] ===== USING CLIENT-SIDE FILTERING =====`
        );
        console.log(
          `🚀 [FetchSnaps] GREAT! Filter "${filter}" will use ${currentAllSnaps.length} cached snaps`
        );
        console.log(`🎯 [FetchSnaps] ===== NO API CALL NEEDED! =====`);

        const filteredSnaps = applyFilter(
          currentAllSnaps,
          filter,
          currentFollowingList
        );

        console.log(
          `✅ [FetchSnaps] CLIENT-SIDE filter complete: ${filteredSnaps.length} snaps for "${filter}"`
        );
        console.log(
          `✅ [FetchSnaps] ===== FILTER SWITCH SUCCESSFUL - NO API CALL! =====\n`
        );

        // Update only the filtered snaps, don't change loading state
        setState(prev => ({
          ...prev,
          snaps: filteredSnaps,
        }));

        console.log(
          `🚀 [FetchSnaps] ===== EARLY RETURN - SKIPPING ALL API CALLS =====`
        );
        return; // Exit early - no API call needed
      }

      // If we can't use client-side filtering, check if we're already loading
      if (isCurrentlyLoading) {
        console.log(`⏸️ [FetchSnaps] ===== ALREADY LOADING =====`);
        console.log(
          `⏸️ [FetchSnaps] Already loading and no cache available, skipping concurrent call`
        );
        console.log(`⏸️ [FetchSnaps] ===== SKIPPING API CALL =====\n`);
        return;
      }

      console.log(`\n📡 [FetchSnaps] ===== CACHE MISS - NEED API CALL =====`);
      console.log(
        `📡 [FetchSnaps] WARNING: Making API call for filter "${filter}"`
      );
      console.log(
        `📡 [FetchSnaps] This should only happen on first load or refresh!`
      );

      // Mark as loading for fresh fetch
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Otherwise, fetch fresh data
      try {
        console.log(
          `\n=== 📡 Fetching Fresh Data with Strategy: ${FETCH_STRATEGY} ===`
        );
        console.log(
          `🏗️ [Fresh Fetch] About to call API to get more containers...`
        );

        // Get current following list from state
        let followingList: string[] = [];

        await new Promise<void>(resolve => {
          setState(prev => {
            followingList = prev.followingList || [];
            resolve();
            return prev; // Don't modify state
          });
        });

        // Note: Following list is now handled by useEffect when username becomes available
        // This ensures it's fetched only when needed and username is set
        console.log(
          `👥 [Following] Following list will be handled by useEffect when username is available`
        );
        console.log(
          `👥 [Following] Current following list length: ${followingList.length}`
        );

        let allSnaps: Snap[] = [];

        console.log(
          `🎯 [Strategy] Using "${FETCH_STRATEGY}" strategy to fetch containers...`
        );
        const strategy = FETCH_STRATEGY as FetchStrategy;
        switch (strategy) {
          case 'container-pagination':
            allSnaps = await fetchSnapsContainerPagination(filter, false);
            console.log(
              `🔍 [Debug] After container pagination, checking state preservation...`
            );

            // Get the updated following list from state after container pagination
            await new Promise<void>(resolve => {
              setState(prev => {
                console.log(
                  `🔍 [Debug] Post-container state: ${prev.allSnaps?.length || 0} snaps, ${prev.followingList?.length || 0} following`
                );

                // Update followingList variable with the current state
                followingList = prev.followingList || [];
                console.log(
                  `🔧 [Debug] Updated followingList variable to: ${followingList.length} users`
                );

                if (prev.followingList && prev.followingList.length > 0) {
                  console.log(
                    `✅ [Debug] Following list preserved: ${prev.followingList.slice(0, 3).join(', ')}`
                  );
                } else {
                  console.log(
                    `❌ [Debug] Following list LOST after container pagination!`
                  );
                }
                resolve();
                return prev; // Don't modify state
              });
            });
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
        console.log(
          `🔍 [Fresh Data] Using followingList with ${followingList.length} users for filtering`
        );
        const filteredSnaps = applyFilter(allSnaps, filter, followingList);

        // Update state with both all snaps and filtered snaps
        setState(prev => {
          console.log(
            `💾 [Cache] Storing ${allSnaps.length} snaps and ${followingList.length} following users in state`
          );
          console.log(
            `🔍 [Cache] About to store following list: ${followingList.slice(0, 3).join(', ')}${followingList.length > 3 ? '...' : ''}`
          );
          return {
            ...prev,
            allSnaps: allSnaps,
            snaps: filteredSnaps,
            followingList: followingList,
            loading: false,
            currentFilter: filter,
          };
        });

        console.log(
          `🎉 [${FETCH_STRATEGY}] Final result: ${filteredSnaps.length} snaps after ${filter} filter`
        );
        console.log(
          `💾 [Cache] Stored ${allSnaps.length} snaps for future client-side filtering`
        );

        // Final state verification - what's actually in state after everything is done?
        setTimeout(() => {
          setState(prev => {
            console.log(
              `🔍 [Final State Check] After initial load completion:`
            );
            console.log(
              `🔍 [Final State] allSnaps: ${prev.allSnaps?.length || 0}, followingList: ${prev.followingList?.length || 0}, loading: ${prev.loading}`
            );
            if (prev.followingList && prev.followingList.length > 0) {
              console.log(
                `✅ [Final State] Following list is preserved: ${prev.followingList.slice(0, 3).join(', ')}`
              );
            } else {
              console.log(
                `❌ [Final State] Following list is MISSING from final state!`
              );
            }
            return prev; // Don't modify state
          });
        }, 100); // Small delay to ensure all state updates are complete
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

      // Check current following list before refresh
      let currentFollowingCount = 0;
      setState(prev => {
        currentFollowingCount = prev.followingList?.length || 0;
        console.log(
          `🔍 [Refresh] Following list before clear: ${currentFollowingCount} users`
        );
        return prev;
      });

      // Reset pagination state and fetch fresh
      setState(prev => ({
        ...prev,
        allSnaps: [], // Clear cached snaps
        // DON'T clear followingList - it's user's social graph, not content cache
        // followingList: [], // REMOVED - this was causing the bug!
        lastContainerIndex: 0,
        lastContainerAuthor: undefined,
        lastContainerPermlink: undefined,
        cacheTimestamp: 0,
        containerCache: undefined,
        // Clear container list for fresh start
        containerList: new ContainerList(prev.maxContainers),
      }));

      // Verify following list is preserved
      setState(prev => {
        console.log(
          `✅ [Refresh] Following list after clear: ${prev.followingList?.length || 0} users (should be ${currentFollowingCount})`
        );
        if ((prev.followingList?.length || 0) !== currentFollowingCount) {
          console.log(`❌ [Refresh] Following list was accidentally cleared!`);
        } else {
          console.log(
            `✅ [Refresh] Following list correctly preserved during refresh`
          );
        }
        return prev;
      });

      console.log(`📡 [Refresh] Forcing fresh fetch (useCache=false)...`);
      await fetchSnaps(filter, false);
    },
    [fetchSnaps]
  );

  // ===== MEMORY MANAGEMENT UTILITY FUNCTIONS =====

  // Utility function to create a unique key for snaps
  const getSnapKey = (snap: Snap): string => {
    return `${snap.author}-${snap.permlink}`;
  };

  // Utility function to deduplicate snaps with minimal logging
  const deduplicateSnaps = (snaps: Snap[]): Snap[] => {
    const seen = new Set<string>();
    const deduplicated: Snap[] = [];

    for (const snap of snaps) {
      const key = getSnapKey(snap);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(snap);
      }
    }

    // Only log when duplicates are actually found
    const duplicatesRemoved = snaps.length - deduplicated.length;
    if (duplicatesRemoved > 0) {
      console.log(
        `🔧 [Dedup] Removed ${duplicatesRemoved} duplicates: ${snaps.length} → ${deduplicated.length} snaps`
      );
    }

    return deduplicated;
  };

  // Add a new container to the sliding window (returns updated state)
  const addContainer = useCallback(
    (
      containerMetadata: ContainerMetadata,
      currentState: FeedState
    ): FeedState => {
      console.log(
        `🔍 [addContainer] Input state followingList: ${currentState.followingList?.length || 0} users`
      );

      // Create new container list to maintain immutability
      const newContainerList = new ContainerList(currentState.maxContainers);

      // Copy existing containers to new list
      const existingContainers = currentState.containerList.toArray();
      existingContainers.forEach(container => {
        newContainerList.append(container);
      });

      // Add the new container
      newContainerList.append(containerMetadata);

      const stats = newContainerList.getStats();
      console.log(
        `💾 [Memory] Total containers in memory: ${stats.containersInMemory}/${currentState.maxContainers}`
      );
      console.log(
        `📊 [Memory] Total snaps in memory: ${stats.totalSnaps} across ${stats.containersInMemory} containers`
      );

      const newState = {
        ...currentState,
        containerList: newContainerList,
        // Explicitly preserve important state that should not be lost
        followingList: currentState.followingList,
        allSnaps: currentState.allSnaps,
      };

      console.log(
        `🔍 [addContainer] Output state followingList: ${newState.followingList?.length || 0} users`
      );

      return newState;
    },
    []
  );

  // Get current snaps from all containers in memory with filtering (minimal logging)
  const getCurrentSnapsFromContainers = useCallback(
    (
      containerList: ContainerList,
      filter?: FeedFilter,
      followingList?: string[]
    ): Snap[] => {
      // Get all snaps from the linked list
      const allSnaps = containerList.getAllSnaps();

      // Deduplicate the combined snaps
      const deduplicated = deduplicateSnaps(allSnaps);

      // Apply filter if specified
      if (filter === 'following' && followingList && followingList.length > 0) {
        const filtered = deduplicated.filter(snap =>
          followingList.includes(snap.author)
        );
        return filtered;
      }

      return deduplicated;
    },
    []
  );

  // Fetch and prepend older containers when scrolling up
  const fetchOlderContainers = useCallback(
    async (filter: FeedFilter) => {
      console.log(`\n⬆️ [Prepend] ===== FETCHING OLDER CONTAINERS =====`);

      const oldestContainer = state.containerList.getOldest();
      if (!oldestContainer || oldestContainer.index === 0) {
        console.log(
          `⬆️ [Prepend] No older containers to fetch (already at beginning)`
        );
        return;
      }

      console.log(
        `⬆️ [Prepend] Fetching containers older than index ${oldestContainer.index}`
      );

      setState(prev => ({ ...prev, loading: true }));

      try {
        // Calculate the target container index (older than current oldest)
        const targetIndex = Math.max(0, oldestContainer.index - 1);

        console.log(`⬆️ [Prepend] Target container index: ${targetIndex}`);

        // Use the oldest container's start point for pagination
        const startAuthor = oldestContainer.author;
        const startPermlink = oldestContainer.permlink;

        const response = await client.database.getDiscussions('created', {
          tag: '',
          limit: 30, // Fetch one container worth of posts
          start_author: startAuthor,
          start_permlink: startPermlink,
        });

        console.log(
          `⬆️ [Prepend] API Response: ${response.length} posts fetched`
        );

        if (response.length === 0) {
          console.log(`⬆️ [Prepend] No older posts found`);
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        // Remove the first post if it's the same as our reference point
        let filteredPosts = response;
        if (
          response.length > 0 &&
          response[0].author === startAuthor &&
          response[0].permlink === startPermlink
        ) {
          filteredPosts = response.slice(1);
          console.log(
            `⬆️ [Prepend] Removed duplicate reference post, ${filteredPosts.length} new posts`
          );
        }

        if (filteredPosts.length === 0) {
          console.log(`⬆️ [Prepend] No new posts after deduplication`);
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        // Create container metadata for the older content
        const containerMetadata: ContainerMetadata = {
          author: filteredPosts[0].author,
          permlink: filteredPosts[0].permlink,
          snaps: filteredPosts,
          index: targetIndex,
          timestamp: Date.now(),
        };

        setState(prev => {
          // Create new container list and prepend the older container
          const newContainerList = new ContainerList(prev.maxContainers);

          // Add the new older container first
          newContainerList.prepend(containerMetadata);

          // Add existing containers (this will trigger automatic size management)
          const existingContainers = prev.containerList.toArray();
          existingContainers.forEach(container => {
            newContainerList.append(container);
          });

          // Get updated snaps for display
          const updatedSnaps = getCurrentSnapsFromContainers(
            newContainerList,
            filter,
            prev.followingList
          );

          console.log(`⬆️ [Prepend] Container prepended successfully:`);
          console.log(
            `   📦 [Prepend] - Container ${containerMetadata.index} with ${containerMetadata.snaps.length} snaps`
          );
          console.log(
            `   📊 [Prepend] - Total: ${newContainerList.getSize()} containers, ${updatedSnaps.length} snaps`
          );

          return {
            ...prev,
            containerList: newContainerList,
            snaps: updatedSnaps,
            allSnaps: newContainerList.getAllSnaps(),
            loading: false,
          };
        });
      } catch (error) {
        console.error(`❌ [Prepend] Failed to fetch older containers:`, error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: `Failed to load older content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }));
      }
    },
    [state.containerList, getCurrentSnapsFromContainers]
  );

  // Enhanced check scroll bounds with actual prefetching
  const checkScrollBounds = useCallback(
    (currentIndex: number, totalItems: number) => {
      // Don't check boundaries if there are no items or very few items
      if (totalItems === 0 || totalItems < 20) {
        return; // Skip prefetch checks for empty or very small lists
      }

      const prefetchThreshold = 10; // Prefetch when within 10 items of boundary

      const nearTop = currentIndex < prefetchThreshold;
      const nearBottom = currentIndex > totalItems - prefetchThreshold;

      if (nearTop && state.containerList.getSize() > 0) {
        const oldestContainer = state.containerList.getOldest();
        if (oldestContainer && oldestContainer.index > 0) {
          console.log(
            `⬆️ [Prefetch] User near top (index ${currentIndex}) - triggering fetch for older content before container ${oldestContainer.index}`
          );
          // Fetch older containers using the current filter
          fetchOlderContainers(state.currentFilter || 'newest');
        }
      }

      if (nearBottom) {
        console.log(
          `⬇️ [Prefetch] User near bottom (index ${currentIndex}/${totalItems}) - could prefetch newer content`
        );
        // TODO: Implement prefetching newer containers when reaching bottom
      }
    },
    [state.containerList, state.currentFilter, fetchOlderContainers]
  );

  // Track scroll position for memory management (throttled)
  const onScrollPositionChange = useCallback(
    (index: number) => {
      setState(prev => {
        // Only update if the position changed significantly (avoid excessive calls)
        if (Math.abs(index - prev.currentPosition) < 5) {
          return prev; // Don't update state for small changes
        }

        return {
          ...prev,
          currentPosition: index,
        };
      });

      // Only check bounds occasionally, not on every scroll
      if (index % 10 === 0) {
        const totalItems = getCurrentSnapsFromContainers(
          state.containerList
        ).length;
        checkScrollBounds(index, totalItems);
      }
    },
    [state.containerList, getCurrentSnapsFromContainers, checkScrollBounds]
  );

  // Get memory statistics for debugging (no automatic logging)
  const getMemoryStats = useCallback(() => {
    return state.containerList.getStats();
  }, [state.containerList]);

  // ===== END MEMORY MANAGEMENT UTILITY FUNCTIONS =====

  const { updateSnapInArray } = useOptimisticUpdates();

  const updateSnap = useCallback(
    (author: string, permlink: string, updates: Partial<Snap>) => {
      setState(prev => {
        // Create new container list with updated snaps
        const newContainerList = new ContainerList(prev.maxContainers);
        const existingContainers = prev.containerList.toArray();

        existingContainers.forEach(container => {
          const updatedContainer = {
            ...container,
            snaps: updateSnapInArray(
              container.snaps,
              author,
              permlink,
              updates
            ),
          };
          newContainerList.append(updatedContainer);
        });

        return {
          ...prev,
          snaps: updateSnapInArray(prev.snaps, author, permlink, updates),
          allSnaps: prev.allSnaps
            ? updateSnapInArray(prev.allSnaps, author, permlink, updates)
            : prev.allSnaps,
          containerList: newContainerList,
        };
      });
    },
    [updateSnapInArray]
  );

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

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
    fetchAndCacheFollowingList,
    ensureFollowingListCached,
    onScrollPositionChange,
    getMemoryStats,
  };
};
