# Client-side Moderation (Downvote Hiding)

This app implements a minimal, on-chain moderation mechanism that hides posts and comments if they are downvoted by an allowlisted moderator account.

Status: v1 (shipped on branch feat/moderation-downvote-hiding)

## Policy

- Hide any post or comment that has a negative vote from an allowlisted moderator account.
- Default allowlist: `['snapie']`.
- If a moderator removes their downvote (unvote/0%), the item becomes visible on the next refresh.

## How it works

1) Fast path (no extra network):
   - If the API response already includes `active_votes`, we scan them for a negative vote by any allowlisted moderator and hide immediately.

2) On-demand voters lookup (only when needed):
   - If an item does not include `active_votes` and is “negative-hinted” (e.g., `net_votes < 0`), we fetch voters using `condenser_api.get_active_votes(author, permlink)`.
   - We only do this for items that are actually visible (feed window, detail screen). We cache the decision with a TTL.

3) Caching & dedupe:
   - In-memory cache with TTL (default 45 min) avoids repeated checks.
   - Singleflight: concurrent checks for the same item share one request.

4) UI behavior:
   - Feed: blocked items are filtered out.
   - Post detail: body is replaced with “Removed by moderators”.
   - Comments: blocked replies are filtered from the thread.

## Configuration

File: `config/moderation.ts`

- `MOD_ALLOWLIST`: string[] of moderator usernames (lowercased). Default `['snapie']`.
- `MOD_TTL_MS`: number; cache freshness window (ms). Default 45 minutes.
- `MOD_MAX_CONCURRENCY`: concurrency hint for future tuning.

To add more moderators:

```ts
// config/moderation.ts
export const MOD_ALLOWLIST = ['snapie', 'mod-alex', 'mod-beth'];
```

## Implementation

Service: `services/ModerationService.ts`

- `fromActiveVotes(author, permlink, votes)`: returns and caches a block verdict if any allowlisted moderator voted negatively.
- `ensureChecked(author, permlink)`: fetches `get_active_votes` only when needed; caches verdict with TTL; dedupes concurrent requests.
- `getCached(author, permlink)`: returns cached verdict if fresh.

Integration points:

- `hooks/useFeedData.ts`
  - Applies fast-path moderation if `active_votes` are present.
  - Triggers background checks for negative-hinted items without `active_votes`; removes blocked items from state.

- `hooks/useHivePostData.ts`
  - Fast-path moderation from `active_votes` on the opened post.
  - If `net_votes < 0`, performs a one-time voters lookup; shows placeholder if blocked.
  - Filters blocked comments after building the tree.

Notes:

- UI components (e.g., `Snap.tsx`) remain presentational and unchanged.
- We do not fetch voters for every list item—only for those that are negative-hinted and currently visible.

## Testing

1) Feed filtering
   - Identify a snap with `net_votes < 0`.
   - Downvote it with an allowlisted moderator (default: `@snapie`).
   - Refresh the feed. The item should disappear (or briefly show then be removed).

2) Post detail enforcement
   - Open a downvoted post. The body should show “Removed by moderators”.

3) Comments filtering
   - Downvote a specific reply with the moderator account.
   - Refresh thread; the reply should no longer appear.

4) Unhide flow
   - Remove the moderator downvote (unvote/0%).
   - Refresh; the item should reappear after cache expiry or next check.

## Performance & reliability

- Voters lookups are limited to negative-hinted items and visible windows.
- Singleflight + TTL caching avoids redundant work.
- On network errors, the service returns a non-blocking verdict and retries later.

## Future enhancements (optional)

- Support multiple moderators out of the box by adding to `MOD_ALLOWLIST`.
- Add N-of-M consensus and reason codes via on-chain `custom_json` moderation events.
- Persist moderation cache to `AsyncStorage` for better offline continuity.

---

Security & transparency: decisions are derived from public, on-chain votes by known moderator accounts. No backend is required.
