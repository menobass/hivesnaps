# Unified Avatar Service

This document describes the unified avatar loading strategy used across the app.

## Goals
- One source of truth for avatar URLs
- Deterministic first paint with `images.hive.blog`
- Background warming and cache persistence
- Simple subscription model for UI updates
- Eliminate fragile metadata hosts and dead links

## Deterministic URL
All avatars resolve to:

```
https://images.hive.blog/u/<username>/avatar/original
```

Usernames are normalized (trimmed, lowercased) for cache keys and URLs.

## Service API (`services/AvatarService.ts`)
- `AvatarService.imagesAvatarUrl(username: string): string`
  - Helper to construct the deterministic images URL.
- `getAvatarUrl(username: string): Promise<{ url: string; fromCache: boolean; source: 'hive-images' | 'fallback' }>`
  - Returns the current avatar URL and kicks off background warming.
- `getCachedAvatarUrl(username: string): string`
  - Immediate read-only cache lookup. Falls back to deterministic URL if needed (within TTL).
- `preloadAvatars(usernames: string[]): Promise<void>`
  - Fire-and-forget warm-up for a set of users (deduped and normalized).
- `refreshAvatar(username: string): Promise<string>`
  - Clears cache and forces a reload for a username.
- `subscribe((username, url) => void): () => void`
  - Listen for avatar updates. Always unsubscribe in a `useEffect` cleanup.
- `clearCache(): void`, `getCacheStats(): { size: number; hitRate: number }`
  - Maintenance utilities.

## Caching
- In-memory Map keyed by normalized username.
- TTLs:
  - Success: 30 mins
  - Failure/empty: 5 mins
- Persistent storage via AsyncStorage. Non-`images.hive.blog` URLs are migrated to deterministic images URLs on load.

## Usage Patterns

### Single avatar (hook)
- `hooks/useAvatar.ts` already wraps the service:
  - Subscribes in a `useEffect` and returns the unsubscribe.
  - Applies cached URL immediately, updates on resolve.

### Lists (feeds, user snaps)
- On initial render: set `avatarUrl` using `getCachedAvatarUrl` or deterministic URL to minimize empty avatars.
- Kick off `preloadAvatars([...authors])` in the background.
- Maintain a single subscription in a `useEffect` with cleanup:
  - Update only matching authors in state.
  - Avoid subscribing inside frequently-invoked callbacks.

## Anti-patterns avoided
- Reassigning `const` via `(var as any) = value` — replaced with new variables (e.g., `enrichedSnaps`).
- Subscribing without cleanup — moved into `useEffect` with returned `unsubscribe`.
- Noisy global logs — guarded behind a `DEBUG` flag inside the service.
- Unused helpers (e.g., HEAD checks) — removed.
- Metadata-host URLs — avoided entirely due to reliability concerns.

## Migration Notes
- Existing places that used profile metadata fallback now rely on deterministic images URLs.
- Username keys are normalized; differing cases refer to the same cache entry.

## Troubleshooting
- Seeing empty avatars? Ensure you use `getCachedAvatarUrl` for first paint and subscribe for updates.
- UI not updating? Verify the subscription is created in a `useEffect` and properly cleaned up.
- Cache not persisting? Check AsyncStorage availability and the `STORAGE_KEY` in the service.

## Related Changes
- Fixed leaks in `useUserSnaps` and `useFeedData` by moving subscriptions into `useEffect`.
- Removed `debug-avatar.js` (no longer needed).
- Simplified `AvatarService.fetchAvatarUrl` and centralized URL construction.

## Testing checklist
- Clear Expo cache if needed (cold start): `npx expo start --clear`.
- Verify immediate avatar display and subsequent background updates on:
  - Feed (app startup), Trending filter
  - Profile screen
  - Conversation view (main snap + threaded replies)
  - Discovery screen / hashtag lists
  - Post details + comments
  - Compose header (current user)
  - Link previews
