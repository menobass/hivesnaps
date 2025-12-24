# HiveSnaps Filtering System Documentation

This document explains how HiveSnaps filters out unwanted content and users from feeds. Use this as a reference to implement the same filtering logic in snapie.io or any other client.

---

## Overview

The filtering system has **three layers**:

1. **Personal Muted List** - Users the logged-in user has personally muted
2. **Global Blacklist** - Bad actors blocked by the HiveSnaps team
3. **Moderator Downvotes** - Content flagged by trusted moderators via on-chain votes

---

## Layer 1: Personal Muted List

### What It Is
A list of Hive usernames that the logged-in user has personally chosen to mute. This is stored on the HiveSnaps backend and tied to the user's account.

### API Endpoint
```
GET https://menosoft.xyz/api/muted/
```

### Authentication
Requires JWT Bearer token in the `Authorization` header.

```http
GET /api/muted/ HTTP/1.1
Host: menosoft.xyz
Authorization: Bearer <jwt_token>
```

### Response Format
Returns a JSON array of usernames:
```json
["username1", "username2", "username3"]
```

### Implementation Notes
- Returns an empty array `[]` if the user has no mutes
- Each username is a lowercase string
- The muted list is specific to the authenticated user

---

## Layer 2: Global Blacklist

### What It Is
A list of usernames maintained by the HiveSnaps team for bad actors, spammers, or users who violate terms of service. This list applies to ALL users of the app.

### API Endpoint
```
GET https://menosoft.xyz/api/blacklisted
```

### Authentication
Requires JWT Bearer token in the `Authorization` header.

```http
GET /api/blacklisted HTTP/1.1
Host: menosoft.xyz
Authorization: Bearer <jwt_token>
```

### Response Format
The API may return data in several formats. Handle all of these:

**Format 1: Direct Array**
```json
["baduser1", "baduser2", "spammer99"]
```

**Format 2: Object with `blacklistedUsers` field** (most common)
```json
{
  "blacklistedUsers": ["baduser1", "baduser2", "spammer99"]
}
```

**Format 3: Object with `data` field**
```json
{
  "data": ["baduser1", "baduser2"]
}
```

**Format 4: Object with `blacklist` field**
```json
{
  "blacklist": ["baduser1", "baduser2"]
}
```

**Format 5: Object with `users` field**
```json
{
  "users": ["baduser1", "baduser2"]
}
```

### Extraction Logic (Pseudocode)
```javascript
function extractBlacklist(response) {
  if (!response) return [];
  
  // Format 1: Direct array
  if (Array.isArray(response)) {
    return response.filter(item => typeof item === 'string');
  }
  
  // Format 2: blacklistedUsers field (most common from our API)
  if (response.blacklistedUsers && Array.isArray(response.blacklistedUsers)) {
    return response.blacklistedUsers.filter(item => typeof item === 'string');
  }
  
  // Format 3: data field
  if (response.data && Array.isArray(response.data)) {
    return response.data.filter(item => typeof item === 'string');
  }
  
  // Format 4: blacklist field
  if (response.blacklist && Array.isArray(response.blacklist)) {
    return response.blacklist.filter(item => typeof item === 'string');
  }
  
  // Format 5: users field
  if (response.users && Array.isArray(response.users)) {
    return response.users.filter(item => typeof item === 'string');
  }
  
  return [];
}
```

---

## Combining the Lists

Fetch both lists in parallel and combine them into a single Set for O(1) lookups:

```javascript
async function fetchCombinedMutedList(username) {
  // Fetch both in parallel for performance
  const [personalMuted, globalBlacklist] = await Promise.all([
    fetchPersonalMutedList(),    // GET /api/muted/
    fetchGlobalBlacklist()       // GET /api/blacklisted
  ]);
  
  // Combine into a single Set (automatically deduplicates)
  const combinedMuted = new Set([...personalMuted, ...globalBlacklist]);
  
  return combinedMuted;
}
```

### Why Use a Set?
- **O(1) lookup time** for checking if a user is muted
- **Automatic deduplication** if a user appears in both lists
- **Memory efficient** for large lists

---

## Applying the Filter

Once you have the combined muted Set, filter your snaps/posts:

```javascript
// Get snaps from feed
const snaps = await fetchSnaps();

// Filter out muted users
const filteredSnaps = snaps.filter(snap => !mutedSet.has(snap.author));
```

### In React/State Management
```javascript
const filteredSnaps = useMemo(() => {
  return snaps.filter(snap => 
    !mutedList || !mutedList.includes(snap.author)
  );
}, [snaps, mutedList]);
```

---

## Layer 3: Moderator Downvote Filtering

### What It Is
An additional layer that checks if trusted moderators (the "allowlist") have downvoted a specific piece of content. This happens at the individual post level, not the user level.

### How It Works
1. Define a list of trusted moderator accounts (the "allowlist")
2. For each snap, check its `active_votes` on the blockchain
3. If ANY allowlisted moderator has a negative vote (downvote), the content is blocked

### Allowlist Configuration
```javascript
// config/moderation.ts
export const MOD_ALLOWLIST = ["snapie"]; // Lowercase usernames

// How long a moderation check stays cached (45 minutes)
export const MOD_TTL_MS = 45 * 60 * 1000;
```

### Checking Active Votes
Use the Hive blockchain API to get active votes:

```javascript
import { Client } from '@hiveio/dhive';

const client = new Client([
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network'
]);

async function checkModeratorVotes(author, permlink) {
  const votes = await client.database.call('get_active_votes', [author, permlink]);
  
  for (const vote of votes) {
    // Check if voter is a moderator
    if (allowlist.has(vote.voter.toLowerCase())) {
      // Check if it's a downvote (negative percent or negative rshares)
      const isDownvote = 
        (typeof vote.percent === 'number' && vote.percent < 0) ||
        (typeof vote.rshares === 'number' && vote.rshares < 0);
      
      if (isDownvote) {
        return { isBlocked: true, by: [vote.voter] };
      }
    }
  }
  
  return { isBlocked: false };
}
```

### When to Check
- Check when a snap is first loaded into the feed
- Cache the result to avoid repeated API calls
- Re-check after the cache TTL expires (45 minutes)

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Opens Feed                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Fetch Lists in Parallel                        │
│  ┌──────────────────────┐    ┌──────────────────────┐           │
│  │ GET /api/muted/      │    │ GET /api/blacklisted │           │
│  │ (Personal mutes)     │    │ (Global blacklist)   │           │
│  └──────────────────────┘    └──────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           Combine into Single Set<string>                        │
│           new Set([...personalMuted, ...globalBlacklist])        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Fetch Snaps from Feed                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Filter 1: Remove Muted/Blacklisted Authors          │
│         snaps.filter(snap => !mutedSet.has(snap.author))         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Filter 2: Check Moderator Downvotes                 │
│      For each snap, check if allowlisted mods downvoted          │
│      (This can be done lazily as snaps render)                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Display Filtered Feed                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## JWT Authentication

Both API endpoints require JWT authentication. Here's how to include it:

### Getting the JWT Token
The JWT token is obtained after the user logs in via Hive Keychain or HiveSigner. Store it securely.

### Including in Requests
```javascript
const response = await fetch('https://menosoft.xyz/api/muted/', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Token Refresh
If you receive a 401 with `{"error": "expired"}`, you need to:
1. Re-authenticate the user
2. Get a new JWT token
3. Retry the request

---

## Caching Strategy

### Recommended Cache Settings
```javascript
const CACHE_CONFIG = {
  mutedList: {
    cacheDuration: 5 * 60 * 1000,  // 5 minutes
    staleWhileRevalidate: true
  },
  blacklist: {
    cacheDuration: 10 * 60 * 1000, // 10 minutes
    staleWhileRevalidate: true
  },
  moderationVerdicts: {
    cacheDuration: 45 * 60 * 1000, // 45 minutes
    maxEntries: 1000               // Limit cache size
  }
};
```

### Cache Invalidation
- **Muted list**: Invalidate when user mutes/unmutes someone
- **Blacklist**: Invalidate on app restart or after 10 minutes
- **Moderation verdicts**: Expire after 45 minutes, re-check on next view

---

## Error Handling

### Graceful Degradation
If either API call fails, return an empty array and continue:

```javascript
async function fetchGlobalBlacklist() {
  try {
    const response = await fetch('https://menosoft.xyz/api/blacklisted', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return extractBlacklist(await response.json());
  } catch (error) {
    console.error('Failed to fetch blacklist:', error);
    return []; // Return empty array, don't break the app
  }
}
```

### Why Graceful Degradation?
- Users should still see content even if filtering fails
- Network errors shouldn't crash the app
- Log errors for debugging but don't block the user

---

## Quick Reference

| List | Endpoint | Auth | Cache | Scope |
|------|----------|------|-------|-------|
| Personal Muted | `/api/muted/` | JWT Required | 5 min | Per-user |
| Global Blacklist | `/api/blacklisted` | JWT Required | 10 min | All users |
| Mod Votes | Hive RPC | None | 45 min | Per-post |

---

## Example Implementation (Web/JavaScript)

```javascript
class FilteringService {
  constructor(jwtToken) {
    this.token = jwtToken;
    this.baseUrl = 'https://menosoft.xyz/api';
    this.mutedSet = new Set();
    this.modAllowlist = new Set(['snapie']);
  }

  async fetchMutedList() {
    const [personal, blacklist] = await Promise.all([
      this.fetchPersonalMuted(),
      this.fetchBlacklist()
    ]);
    this.mutedSet = new Set([...personal, ...blacklist]);
    return this.mutedSet;
  }

  async fetchPersonalMuted() {
    try {
      const res = await fetch(`${this.baseUrl}/muted/`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      return await res.json() || [];
    } catch { return []; }
  }

  async fetchBlacklist() {
    try {
      const res = await fetch(`${this.baseUrl}/blacklisted`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      return this.extractBlacklist(data);
    } catch { return []; }
  }

  extractBlacklist(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.blacklistedUsers) return data.blacklistedUsers;
    if (data.data) return data.data;
    if (data.blacklist) return data.blacklist;
    if (data.users) return data.users;
    return [];
  }

  filterSnaps(snaps) {
    return snaps.filter(snap => !this.mutedSet.has(snap.author));
  }

  isMuted(username) {
    return this.mutedSet.has(username);
  }
}

// Usage
const filterService = new FilteringService(jwtToken);
await filterService.fetchMutedList();
const filteredFeed = filterService.filterSnaps(snaps);
```

---

## Updating the Lists

### Adding to Personal Muted List
```
POST https://menosoft.xyz/api/muted/
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "username": "userToMute"
}
```

### Removing from Personal Muted List
```
DELETE https://menosoft.xyz/api/muted/
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "username": "userToUnmute"
}
```

### Global Blacklist (Admin Only)
The global blacklist is managed by the HiveSnaps team through a separate admin interface.

---

## Summary

1. **Fetch both lists** (`/muted/` and `/blacklisted`) in parallel with JWT auth
2. **Combine into a Set** for O(1) lookups
3. **Filter snaps** by checking `mutedSet.has(snap.author)`
4. **Optionally** check moderator downvotes for content-level filtering
5. **Cache results** to avoid repeated API calls
6. **Handle errors gracefully** - return empty arrays, don't crash

This filtering system ensures users don't see content from:
- People they've personally muted
- Bad actors blocked by the HiveSnaps team
- Content downvoted by trusted moderators
