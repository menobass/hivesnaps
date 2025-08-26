# Avatar Unification (images.hive.blog)

This branch unifies avatar loading across the app to a single, reliable source: `https://images.hive.blog/u/<username>/avatar/original`.

Why
- Metadata `profile_image` URLs are often stale/broken (e.g., snag.gy).
- Mixed code paths led to inconsistent avatars and blank first paint.
- A single deterministic source is faster, cacheable, and consistent.

What changed
- Core: `services/AvatarService`
  - Returns images.hive.blog URLs only.
  - AsyncStorage-backed cache normalized/migrated to images URLs.
  - `getCachedAvatarUrl(username)`: instant first-paint URL.
  - `getAvatarUrl(username)`: resolves in background and notifies subscribers.
  - `preloadAvatars([...])` to warm caches in batch.

- Hooks and screens now use AvatarService:
  - useFeedData: immediate enrich + background preload.
  - useUserSnaps: immediate enrich + background preload.
  - useProfileData: avatar via service; first-paint + background update.
  - useConversationData: main snap + replies use service; no metadata.
  - useHivePostData: post + comments avatars via service.
  - useSearch: user results use service; metadata only for displayName/about.
  - useUserProfile: avatar via service for header/menus.
  - DiscoveryScreen: deterministic URL + service preload; removed HEAD checks.
  - ComposeScreen: current user avatar via service.
  - extractHivePostInfo: link previews call service.

Behavior
- First paint: always shows an avatar immediately (cached or deterministic).
- Background: service warms/fetches and updates state via subscriptions or local setState.
- Logging: temporary tags like [Avatar][Service]/[Profile]/[Conversation]/[PostData]/[Discovery] help validate final URLs.

Testing notes
- Clear Expo cache: `npx expo start --clear`.
- Verify avatars appear immediately on:
  - App startup feed
  - Trending filter
  - Profile screen
  - Conversation view
  - Discovery hashtag list
  - Post details + comments
  - Compose header
  - Link previews

Follow-ups
- Optionally gate [Avatar] logs behind a debug flag.
- Consider removing the small legacy local cache in Discovery entirely.
