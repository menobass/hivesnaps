import { useCallback } from 'react';

// Generic interface for snap-like data
export interface SnapLike {
  author: string;
  permlink?: string;
  voteCount?: number;
  hasUpvoted?: boolean;
  active_votes?: any[];
  [key: string]: any;
}

// Interface for reply data that can have nested replies
export interface ReplyLike extends SnapLike {
  replies?: ReplyLike[];
}

// Hook for optimistic updates
export const useOptimisticUpdates = () => {
  // Update a single snap in an array
  const updateSnapInArray = useCallback(
    <T extends SnapLike>(
      snaps: T[],
      author: string,
      permlink: string,
      updates: Partial<T>
    ): T[] => {
      return snaps.map(snap =>
        snap.author === author && snap.permlink === permlink
          ? { ...snap, ...updates }
          : snap
      );
    },
    []
  );

  // Update a snap in a conversation tree (handles nested replies)
  const updateSnapInTree = useCallback(
    <T extends ReplyLike>(
      replies: T[],
      author: string,
      permlink: string,
      updates: Partial<T>
    ): T[] => {
      const updateReplyRecursive = (replyList: T[]): T[] => {
        return replyList.map(reply => {
          if (reply.author === author && reply.permlink === permlink) {
            return { ...reply, ...updates };
          }
          if (reply.replies) {
            return { ...reply, replies: updateReplyRecursive(reply.replies as T[]) };
          }
          return reply;
        });
      };

      return updateReplyRecursive(replies);
    },
    []
  );

  // Update a single snap (for when you have one snap object)
  const updateSingleSnap = useCallback(
    <T extends SnapLike>(
      snap: T | null,
      author: string,
      permlink: string,
      updates: Partial<T>
    ): T | null => {
      console.log('[useOptimisticUpdates] updateSingleSnap called:', {
        snapAuthor: snap?.author,
        snapPermlink: snap?.permlink,
        targetAuthor: author,
        targetPermlink: permlink,
        updates,
      });

      if (!snap) return null;

      const shouldUpdate = snap.author === author && snap.permlink === permlink;
      console.log('[useOptimisticUpdates] Should update:', shouldUpdate);

      return shouldUpdate ? { ...snap, ...updates } : snap;
    },
    []
  );

  // Common upvote update function
  const createUpvoteUpdate = useCallback(
    (voteWeight: number, currentUsername: string) => ({
      hasUpvoted: true,
      active_votes: [
        {
          voter: currentUsername,
          percent: voteWeight,
          rshares: 0, // Will be set by blockchain
        },
      ],
    }),
    []
  );

  // Common downvote update function
  const createDownvoteUpdate = useCallback(
    (currentUsername: string) => ({
      voteCount: (prev: number = 0) => Math.max(0, prev - 1),
      hasUpvoted: false,
      active_votes: (prev: any[] = []) =>
        prev.filter(vote => vote.voter !== currentUsername),
    }),
    []
  );

  return {
    updateSnapInArray,
    updateSnapInTree,
    updateSingleSnap,
    createUpvoteUpdate,
    createDownvoteUpdate,
  };
};
