# Muted List Fallback Implementation Plan

## Problem Statement 🚨

Currently, when either the personal muted list API (Hive/HAFSQL) or the global blacklist API (HiveSnaps backend) fails, users see content they shouldn't see because the filtering lists come back empty or incomplete.

**Symptoms:**
- Most of the time filtering works correctly
- Occasionally blocked users slip through and show content
- Happens when network is poor, APIs are down, or during app startup

## Current Architecture Analysis 🔍

### Existing Services:
1. **`BlacklistService`** - Fetches global blacklist from HiveSnaps backend
2. **`HiveMuteService`** - Combines personal mutes + blacklist  
3. **`store/userSlice.ts`** - Caches muted lists with TTL in memory
4. **`hooks/useFeedData.ts`** - Has `fetchAndCacheMutedList` with basic fallback

### Current Fallback Behavior:
```ts
// BlacklistService.ts - Returns empty array on failure
} catch (error) {
  console.error('[BlacklistService] Failed to fetch blacklist:', error);
  return []; // ← No filtering applied
}

// HiveMuteService.ts - Returns empty set on failure  
} catch (err) {
  console.error('[HiveMuteService] ❌ Error fetching combined muted list:', err);
  return new Set(); // ← No filtering applied
}
```

**Issue**: Empty arrays/sets mean NO FILTERING, allowing blocked content to show.

## Proposed Solution: Hybrid Approach (Option 3) 💡

### Strategy:
1. **Immediate Response** - Use cached data from AsyncStorage
2. **Background Refresh** - Fetch fresh data and update cache
3. **Graceful Degradation** - Never return completely empty lists
4. **Conservative Fallback** - Better to over-filter than under-filter

### Implementation Plan:

#### Phase 1: Add Persistent Caching

**File: `services/CacheService.ts` (New)**
```ts
export class CacheService {
  // Generic caching utilities
  static async getCache<T>(key: string): Promise<T | null>
  static async setCache<T>(key: string, data: T, maxAge?: number): Promise<void>
  static async isCacheValid(key: string, maxAge: number): Promise<boolean>
}
```

**Cache Keys:**
- `cached_blacklist` - Global blacklist
- `cached_personal_mutes_{username}` - Personal muted users
- `cached_combined_mutes_{username}` - Final combined list

#### Phase 2: Enhance BlacklistService

**File: `services/BlacklistService.ts`**
```ts
export class BlacklistService {
  // New method with fallback
  static async getBlacklistWithFallback(): Promise<string[]> {
    try {
      // 1. Try cached data first (immediate)
      const cached = await CacheService.getCache<string[]>('cached_blacklist');
      let result = cached || [];
      
      // 2. Fetch fresh in background
      const fresh = await this.getBlacklist();
      if (fresh.length > 0) {
        await CacheService.setCache('cached_blacklist', fresh, 24 * 60 * 60 * 1000); // 24h
        result = fresh;
      }
      
      return result;
    } catch (error) {
      // 3. Last resort: return cached or empty
      const cached = await CacheService.getCache<string[]>('cached_blacklist');
      return cached || [];
    }
  }
}
```

#### Phase 3: Enhance HiveMuteService

**File: `services/HiveMuteService.ts`**
```ts
export async function fetchMutedListWithFallback(username: string): Promise<Set<string>> {
  if (!username) return new Set();
  
  const cacheKey = `cached_combined_mutes_${username}`;
  
  try {
    // 1. Get cached data immediately
    const cached = await CacheService.getCache<string[]>(cacheKey);
    let result = new Set(cached || []);
    
    // 2. Try to fetch fresh data
    const [personalResult, blacklistResult] = await Promise.allSettled([
      fetchPersonalMutedListWithFallback(username),
      BlacklistService.getBlacklistWithFallback()
    ]);
    
    // 3. Use fresh data if available, fallback to cached
    const personalMutes = personalResult.status === 'fulfilled' 
      ? personalResult.value 
      : await getCachedPersonalMutes(username);
      
    const globalBlacklist = blacklistResult.status === 'fulfilled'
      ? blacklistResult.value
      : await getCachedBlacklist();
    
    // 4. Combine and cache if we got fresh data
    if (personalMutes.length > 0 || globalBlacklist.length > 0) {
      const combined = [...personalMutes, ...globalBlacklist];
      await CacheService.setCache(cacheKey, combined, 60 * 60 * 1000); // 1h
      result = new Set(combined);
    }
    
    return result;
    
  } catch (error) {
    // 5. Last resort: use any cached data
    console.error('[HiveMuteService] All fallbacks failed:', error);
    const cached = await CacheService.getCache<string[]>(cacheKey);
    return new Set(cached || []);
  }
}

async function fetchPersonalMutedListWithFallback(username: string): Promise<string[]> {
  const cacheKey = `cached_personal_mutes_${username}`;
  
  try {
    const fresh = await fetchPersonalMutedList(username);
    if (fresh.length > 0) {
      await CacheService.setCache(cacheKey, fresh, 60 * 60 * 1000); // 1h
    }
    return fresh;
  } catch (error) {
    console.error('[HiveMuteService] Personal mutes failed, using cache:', error);
    const cached = await CacheService.getCache<string[]>(cacheKey);
    return cached || [];
  }
}
```

#### Phase 4: Update Hook Integration

**File: `hooks/useFeedData.ts`**
```ts
// Replace fetchAndCacheMutedList implementation
const fetchAndCacheMutedList = useCallback(
  async (username: string): Promise<string[]> => {
    if (!username) return [];
    
    try {
      setMutedLoading(true);
      
      // Use new fallback service
      const mutedSet = await fetchMutedListWithFallback(username);
      const mutedArray = Array.from(mutedSet);
      
      console.log('🔇 [fetchAndCacheMutedList] Got', mutedArray.length, 'muted users (with fallback)');
      
      setMutedList(mutedArray);
      setMutedError(null);
      return mutedArray;
      
    } catch (error) {
      console.error('❌ [fetchAndCacheMutedList] All fallbacks failed:', error);
      
      // Try to use any existing cached data as last resort
      const existingList = mutedListRef.current;
      if (existingList && existingList.length > 0) {
        console.log('🔇 Using existing in-memory cache:', existingList.length, 'users');
        return existingList;
      }
      
      // Absolute last resort: empty array (no filtering)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch muted list';
      setMutedError(errorMessage);
      return [];
    } finally {
      setMutedLoading(false);
    }
  },
  [setMutedList, setMutedLoading, setMutedError]
);
```

### Cache Management Strategy:

#### Cache Expiration:
- **Global Blacklist**: 24 hours (changes infrequently)
- **Personal Mutes**: 1 hour (user might mute/unmute frequently)  
- **Combined Lists**: 1 hour (refresh with personal mutes)

#### Cache Invalidation:
- **On successful mute/unmute actions**
- **On app startup** (background refresh)
- **Manual refresh** (pull-to-refresh)

#### Storage Limits:
- Use AsyncStorage with size limits
- Implement cache cleanup for old entries
- Prioritize recent users' cache data

## Implementation Benefits ✅

### User Experience:
- **Faster load times** - Immediate cached results
- **Better reliability** - Content filtering works even with poor network
- **Consistent behavior** - No more random unfiltered content

### Technical Benefits:
- **Graceful degradation** - Never completely fails
- **Reduced API load** - Less frequent requests
- **Battery efficient** - Cached data reduces network usage
- **Backwards compatible** - Builds on existing architecture

## Error Handling & Logging 📊

### Error Categories:
1. **Network errors** - API timeouts, no connection
2. **API errors** - Server 500s, malformed responses  
3. **Cache errors** - AsyncStorage failures
4. **Data errors** - Invalid JSON, unexpected formats

### Logging Strategy:
```ts
// Log cache hits/misses for monitoring
console.log('[MutedList] Cache hit: blacklist (24h old)');
console.log('[MutedList] Cache miss: fetching fresh personal mutes');
console.log('[MutedList] Fallback: using 2h old cached data');

// Track failure patterns
analytics.track('muted_list_cache_hit', { source: 'blacklist', age: '2h' });
analytics.track('muted_list_api_failure', { api: 'hafsql', error: 'timeout' });
```

## Testing Strategy 🧪

### Manual Testing:
1. **Airplane mode** - Verify cached data works
2. **Slow network** - Ensure immediate cached response
3. **API down** - Confirm fallback behavior
4. **Fresh install** - Test with no cached data

### Automated Testing:
```ts
// Unit tests for cache service
describe('CacheService', () => {
  test('returns cached data when fresh fetch fails');
  test('updates cache when fresh fetch succeeds');
  test('handles corrupted cache data gracefully');
});

// Integration tests
describe('MutedListWithFallback', () => {
  test('filters content with cached muted list');
  test('updates filtering when fresh data arrives');
});
```

## Migration Strategy 🔄

### Phase 1: Add New Services (Non-breaking)
- Add CacheService utilities
- Add *WithFallback methods alongside existing

### Phase 2: Update Consumers Gradually  
- Update FeedScreen to use fallback methods
- Update ConversationScreen
- Update other screens as needed

### Phase 3: Deprecate Old Methods
- Remove old methods once all consumers updated
- Clean up unused code

## Performance Considerations ⚡

### Memory Usage:
- Cache size limits (max 100 users per list)
- Cleanup old cache entries
- Monitor AsyncStorage usage

### Network Usage:
- Background refresh (not blocking UI)
- Debounce rapid refresh requests
- Respect API rate limits

### Battery Impact:
- Minimize background network requests
- Use efficient JSON parsing
- Batch cache operations

## Monitoring & Analytics 📈

### Key Metrics:
- **Cache hit rate** - How often cached data is used
- **API failure rate** - Frequency of fallback triggers
- **Content filter effectiveness** - Blocked content showing through
- **User experience** - Loading times, error rates

### Alerts:
- High API failure rate (>10%)
- Cache hit rate too low (<50%)
- Multiple consecutive fallbacks for same user

## Future Enhancements 🚀

### Advanced Caching:
- Incremental updates (delta sync)
- Compression for large lists
- Background pre-loading

### Smart Fallbacks:
- Machine learning for content filtering
- Community-based moderation scores
- Progressive filtering strictness

### Cross-Platform Sync:
- Sync muted lists across devices
- Cloud backup of preferences
- Conflict resolution

---

## Implementation Checklist 📋

- [ ] Create CacheService utility class
- [ ] Add AsyncStorage persistent caching
- [ ] Enhance BlacklistService with fallback
- [ ] Enhance HiveMuteService with fallback  
- [ ] Update hooks to use fallback methods
- [ ] Add comprehensive error logging
- [ ] Implement cache invalidation logic
- [ ] Add unit tests for cache layer
- [ ] Add integration tests for filtering
- [ ] Monitor cache performance metrics
- [ ] Document cache maintenance procedures

---

**Priority**: High - Directly impacts user experience and content safety
**Complexity**: Medium - Builds on existing architecture  
**Risk**: Low - Backwards compatible, graceful fallback
**Timeline**: 1-2 weeks for full implementation and testing
