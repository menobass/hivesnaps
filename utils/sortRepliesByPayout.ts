// Utility to recursively sort replies/comments by payout (desc) then created (asc)
// Keeps data shape intact; returns a new array (shallow clones) to avoid mutating original state.

export interface HasPayoutAndReplies<T> {
  payout?: number;
  created?: string;
  replies?: T[];
}

export function sortByPayoutRecursive<T extends HasPayoutAndReplies<T>>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  // Copy first to avoid mutating caller's array
  const cloned = items.map(item => ({ ...item }));
  for (const item of cloned) {
    if (item.replies && item.replies.length > 0) {
      item.replies = sortByPayoutRecursive(item.replies as T[]);
    }
  }
  cloned.sort((a, b) => {
    const payoutA = typeof a.payout === 'number' ? a.payout! : 0;
    const payoutB = typeof b.payout === 'number' ? b.payout! : 0;
    if (payoutB !== payoutA) return payoutB - payoutA; // higher first
    const timeA = a.created ? new Date(a.created).getTime() : 0;
    const timeB = b.created ? new Date(b.created).getTime() : 0;
    return timeA - timeB; // earlier first within same payout
  });
  return cloned;
}
