import { useState, useEffect, useCallback, useRef } from 'react';
import { sortByPayoutRecursive } from '../utils/sortRepliesByPayout';
import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

// Types for Hive post data
export interface HivePostData {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  voteCount: number;
  replyCount: number;
  payout: number;
  avatarUrl?: string;
  hasUpvoted?: boolean;
  active_votes?: any[];
  json_metadata?: string;
  category?: string;
  tags?: string[];
}

export interface HiveCommentData {
  author: string;
  permlink: string;
  body: string;
  created: string;
  voteCount: number;
  replyCount: number;
  payout: number;
  avatarUrl?: string;
  hasUpvoted?: boolean;
  active_votes?: any[];
  json_metadata?: string;
  parent_author: string;
  parent_permlink: string;
  depth: number;
  replies?: HiveCommentData[];
}

interface HivePostState {
  post: HivePostData | null;
  comments: HiveCommentData[];
  loading: boolean;
  commentsLoading: boolean;
  error: string | null;
  commentsError: string | null;
}

interface UseHivePostDataReturn extends HivePostState {
  fetchPost: () => Promise<void>;
  fetchComments: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearError: () => void;
  updatePost: (updates: Partial<HivePostData>) => void;
  updateComment: (
    author: string,
    permlink: string,
    updates: Partial<HiveCommentData>
  ) => void;
}

export const useHivePostData = (
  author: string | undefined,
  permlink: string | undefined,
  currentUsername: string | null
): UseHivePostDataReturn => {
  const [state, setState] = useState<HivePostState>({
    post: null,
    comments: [],
    loading: false,
    commentsLoading: false,
    error: null,
    commentsError: null,
  });

  // In-memory avatar/profile cache for this session (persists across renders)
  const avatarProfileCache = useRef<Record<string, string | undefined>>({});

  // Helper function to check if current user has upvoted
  const checkHasUpvoted = useCallback((activeVotes: any[]): boolean => {
    if (!currentUsername || !Array.isArray(activeVotes)) return false;
    return activeVotes.some((v: any) => v.voter === currentUsername && v.percent > 0);
  }, [currentUsername]);

  // Helper function to fetch avatar for a given author
  const fetchAvatar = useCallback(async (authorName: string): Promise<string | undefined> => {
    // Check cache first
    if (authorName in avatarProfileCache.current) {
      return avatarProfileCache.current[authorName];
    }

    try {
      const accounts = await client.database.call('get_accounts', [[authorName]]);
      if (accounts && accounts[0]) {
        let metadata = accounts[0].posting_json_metadata;
        if (!metadata || metadata === '{}') {
          metadata = accounts[0].json_metadata;
        }
        if (metadata) {
          try {
            const profile = JSON.parse(metadata).profile;
            if (profile && profile.profile_image) {
              avatarProfileCache.current[authorName] = profile.profile_image;
              return profile.profile_image;
            }
          } catch (e) {
            // Invalid JSON metadata
          }
        }
      }
    } catch (e) {
      // Avatar fetch failed
    }

    avatarProfileCache.current[authorName] = undefined;
    return undefined;
  }, []);

  // Recursively fetch comments tree with full content
  const fetchCommentsTreeWithContent = useCallback(
    async (
      postAuthor: string,
      postPermlink: string,
      depth = 0,
      maxDepth = 3
    ): Promise<HiveCommentData[]> => {
      if (depth > maxDepth) return [];

      try {
        // Fetch shallow comments
        const commentsResponse = await client.database.call('get_content_replies', [
          postAuthor,
          postPermlink,
        ]);

        if (!commentsResponse || !Array.isArray(commentsResponse)) {
          return [];
        }

        // Batch fetch full content for all comments in parallel
        const fullContentArr = await Promise.all(
          commentsResponse.map((comment: { author: string; permlink: string }) =>
            client.database
              .call('get_content', [comment.author, comment.permlink])
              .catch(() => comment)
          )
        );

        // Collect all unique authors for avatar batch fetch, skipping those already cached
        const authorsToFetch = Array.from(
          new Set(fullContentArr.map(c => c.author))
        ).filter(a => !(a in avatarProfileCache.current));

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

        // Build comments with avatar and recurse
        const fullComments: HiveCommentData[] = await Promise.all(
          fullContentArr.map(async fullComment => {
            const avatarUrl = avatarProfileCache.current[fullComment.author];
            const payout = parseFloat(
              fullComment.pending_payout_value
                ? fullComment.pending_payout_value.replace(' HBD', '')
                : '0'
            );

            // Recursively fetch nested comments
            const childrenComments = await fetchCommentsTreeWithContent(
              fullComment.author,
              fullComment.permlink,
              depth + 1,
              maxDepth
            );

            return {
              author: fullComment.author,
              permlink: fullComment.permlink,
              body: fullComment.body,
              created: fullComment.created,
              voteCount: fullComment.net_votes || 0,
              replyCount: fullComment.children || 0,
              payout,
              avatarUrl,
              hasUpvoted: checkHasUpvoted(fullComment.active_votes),
              active_votes: fullComment.active_votes,
              json_metadata: fullComment.json_metadata,
              parent_author: fullComment.parent_author,
              parent_permlink: fullComment.parent_permlink,
              depth: fullComment.depth || depth,
              replies: childrenComments,
            };
          })
        );

        return fullComments;
      } catch (error) {
        console.error('Error fetching comments tree:', error);
        return [];
      }
    },
    []
  );

  // Fetch the main post
  const fetchPost = useCallback(async () => {
    if (!author || !permlink) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Missing required parameters',
      }));
      return;
    }

    // Capture currentUsername at the start of the async operation
    const userAtFetchTime = currentUsername;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('[useHivePostData] Fetching post data from Hive...');
      
      // Fetch the post
      const postData = await client.database.call('get_content', [author, permlink]);

      if (!postData || !postData.author) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Post not found',
        }));
        return;
      }

      // Fetch author avatar
      const avatarUrl = await fetchAvatar(postData.author);

      // Extract tags from metadata
      let tags: string[] = [];
      try {
        if (postData.json_metadata) {
          const metadata = JSON.parse(postData.json_metadata);
          tags = metadata.tags || [];
        }
      } catch (e) {
        // Invalid JSON metadata
      }

      // Create a local version of checkHasUpvoted using the captured username
      const checkHasUpvotedLocal = (activeVotes: any[]): boolean => {
        if (!userAtFetchTime || !Array.isArray(activeVotes)) return false;
        const hasUpvoted = activeVotes.some((v: any) => v.voter === userAtFetchTime && v.percent > 0);
        return hasUpvoted;
      };

      const hivePostData: HivePostData = {
        author: postData.author,
        permlink: postData.permlink,
        title: postData.title || 'Untitled Post',
        body: postData.body,
        created: postData.created,
        voteCount: postData.net_votes || 0,
        replyCount: postData.children || 0,
        payout: parseFloat(
          postData.pending_payout_value
            ? postData.pending_payout_value.replace(' HBD', '')
            : '0'
        ),
        avatarUrl,
        hasUpvoted: checkHasUpvotedLocal(postData.active_votes),
        active_votes: postData.active_votes,
        json_metadata: postData.json_metadata,
        category: postData.category,
        tags,
      };

      setState(prev => ({
        ...prev,
        post: hivePostData,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error('Error fetching Hive post:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load post',
      }));
    }
  }, [author, permlink, currentUsername, fetchAvatar]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!author || !permlink) {
      console.log('[useHivePostData] Missing parameters for comments');
      return;
    }

    // Capture currentUsername at the start of the async operation
    const userAtFetchTime = currentUsername;

    setState(prev => ({ ...prev, commentsLoading: true, commentsError: null }));

    try {
      console.log('[useHivePostData] Fetching comments data from Hive...');
      
      // Fetch the comments tree
      const commentsTree = await fetchCommentsTreeWithContent(author, permlink);

      // Create a local version of checkHasUpvoted using the captured username
      const checkHasUpvotedLocal = (activeVotes: any[]): boolean => {
        if (!userAtFetchTime || !Array.isArray(activeVotes)) return false;
        return activeVotes.some((v: any) => v.voter === userAtFetchTime && v.percent > 0);
      };

      // Recursively update hasUpvoted for all comments
      const updateCommentsHasUpvoted = (comments: any[]): any[] => {
        return comments.map(comment => ({
          ...comment,
          hasUpvoted: checkHasUpvotedLocal(comment.active_votes || []),
          replies: comment.replies ? updateCommentsHasUpvoted(comment.replies) : undefined
        }));
      };

      const updatedCommentsTree = updateCommentsHasUpvoted(commentsTree);

  // Sort comments by payout (desc) then created (asc) recursively
  const sortedTree = sortByPayoutRecursive(updatedCommentsTree);

      setState(prev => ({
        ...prev,
  comments: sortedTree,
        commentsLoading: false,
        commentsError: null,
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      setState(prev => ({
        ...prev,
        commentsLoading: false,
        commentsError: 'Failed to load comments',
      }));
    }
  }, [author, permlink, currentUsername, fetchCommentsTreeWithContent]);

  // Refresh both post and comments
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPost(), fetchComments()]);
  }, [fetchPost, fetchComments]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, commentsError: null }));
  }, []);

  // Update post optimistically
  const updatePost = useCallback((updates: Partial<HivePostData>) => {
    setState(prev => ({
      ...prev,
      post: prev.post ? { ...prev.post, ...updates } : null,
    }));
  }, []);

  // Update comment optimistically
  const updateComment = useCallback(
    (author: string, permlink: string, updates: Partial<HiveCommentData>) => {
      setState(prev => {
        const updateCommentInTree = (comments: HiveCommentData[]): HiveCommentData[] => {
          return comments.map(comment => {
            if (comment.author === author && comment.permlink === permlink) {
              return { ...comment, ...updates };
            }
            if (comment.replies) {
              return { ...comment, replies: updateCommentInTree(comment.replies) };
            }
            return comment;
          });
        };

        return {
          ...prev,
          comments: updateCommentInTree(prev.comments),
        };
      });
    },
    []
  );

  // Auto-fetch on component mount and when params change (wait for currentUsername like ConversationScreen)
  useEffect(() => {
    if (author && permlink && currentUsername) {
      fetchPost();
      fetchComments();
    }
  }, [author, permlink, currentUsername, fetchPost, fetchComments]);

  return {
    ...state,
    fetchPost,
    fetchComments,
    refreshAll,
    clearError,
    updatePost,
    updateComment,
  };
};
