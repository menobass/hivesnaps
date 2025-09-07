// HiveMuteService.ts
// Service for fetching the muted list from HAFSQL API and combining it with the global blacklist

import { BlacklistService } from './BlacklistService';

// Define interfaces for the expected API response and muted user objects
interface MutedUserObject {
  account?: string;
  username?: string;
}
type MutedApiResponse = string[] | { muted: (string | MutedUserObject)[] };

export async function fetchMutedList(username: string): Promise<Set<string>> {
  if (!username) return new Set();
  
  try {
    // Fetch both user's personal muted list and global blacklist in parallel
    const [personalMuted, globalBlacklist] = await Promise.all([
      fetchPersonalMutedList(username),
      BlacklistService.getBlacklist()
    ]);

    // Combine both lists
    const combinedMuted = new Set([...personalMuted, ...globalBlacklist]);
    
    console.log('[HiveMuteService] Combined muted list:', {
      personal: personalMuted.length,
      blacklist: globalBlacklist.length,
      total: combinedMuted.size
    });

    return combinedMuted;
  } catch (err) {
    console.error('[HiveMuteService] Error fetching combined muted list:', err);
    return new Set();
  }
}

/**
 * Fetch only the user's personal muted list from HAFSQL API
 */
async function fetchPersonalMutedList(username: string): Promise<string[]> {
  const apiUrl = `https://api.syncad.com/hafsql/accounts/${username}/muted?limit=100`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Failed to fetch muted list: ${response.status}`);
    const data: MutedApiResponse = await response.json();
    // The API returns an array of usernames in the 'muted' field or as the root array
    const muted = Array.isArray(data)
      ? data
      : Array.isArray(data.muted)
        ? data.muted
        : [];
    // Map and filter to ensure only valid usernames are included
    const mutedUsernames = muted
      .map((u) => {
        if (typeof u === 'string') return u;
        if (u && typeof u === 'object') {
          if (typeof u.account === 'string') return u.account;
          if (typeof u.username === 'string') return u.username;
        }
        return undefined;
      })
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    
    console.log('[HiveMuteService] Personal muted list:', mutedUsernames.length, 'users');
    return mutedUsernames;
  } catch (err) {
    console.error('[HiveMuteService] Error fetching personal muted list:', err);
    return [];
  }
}
