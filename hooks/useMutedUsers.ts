import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/context';

/**
 * In-memory muted users management.
 * Single source of truth: context state (no persistence layer).
 * Mirrors style of following list access for consistency.
 */
export function useMutedUsers(owner?: string | null) {
  const { state, dispatch } = useAppStore();
  const effectiveOwner = owner ?? state.user.currentUser;

  const mutedSet = useMemo(() => {
    if (!effectiveOwner) return new Set<string>();
    return state.user.mutedSets[effectiveOwner] || new Set<string>();
  }, [effectiveOwner, state.user.mutedSets]);

  const isMuted = useCallback(
    (target: string): boolean => {
      if (!target || !effectiveOwner) return false;
      const set = state.user.mutedSets[effectiveOwner];
      return !!set && set.has(target);
    },
    [effectiveOwner, state.user.mutedSets]
  );

  const mute = useCallback(
    (target: string) => {
      if (!effectiveOwner || !target || target === effectiveOwner) return;
      dispatch({ type: 'USER_MUTE_ADD', payload: { owner: effectiveOwner, target } });
    },
    [effectiveOwner, dispatch]
  );

  const unmute = useCallback(
    (target: string) => {
      if (!effectiveOwner || !target) return;
      dispatch({ type: 'USER_MUTE_REMOVE', payload: { owner: effectiveOwner, target } });
    },
    [effectiveOwner, dispatch]
  );

  const setMutedBulk = useCallback(
    (list: string[]) => {
      if (!effectiveOwner) return;
      dispatch({ type: 'USER_MUTE_SET', payload: { owner: effectiveOwner, muted: list } });
    },
    [effectiveOwner, dispatch]
  );

  return {
    owner: effectiveOwner,
    mutedSet,
    mutedList: useMemo(() => Array.from(mutedSet), [mutedSet]),
    isMuted,
    mute,
    unmute,
    setMutedBulk,
  } as const;
}

/**
 * Utility to filter an array of content objects with an author field against a mute set.
 */
export function filterMuted<T extends { author: string }>(items: T[], muted: Set<string>): T[] {
  if (!items || items.length === 0 || muted.size === 0) return items;
  return items.filter(i => !muted.has(i.author));
}

/**
 * Create placeholder for muted content (e.g. in conversation threads) while keeping structure.
 */
export function createMutedPlaceholder<T extends { body: string }>(item: T): T {
  return { ...item, body: '[Muted user content hidden]' };
}