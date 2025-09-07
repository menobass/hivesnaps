// HiveMuteService.ts
// Service for fetching the muted list from HAFSQL API and providing it to the app in memory.

import { getGlobalBlacklist } from './BlacklistService';

// Define interfaces for the expected API response and muted user objects
interface MutedUserObject {
  account?: string;
  username?: string;
}
type MutedApiResponse = string[] | { muted: (string | MutedUserObject)[] };

/**
 * Fetches user's personal muted list from HAFSQL API
 * This is the private mute list that the user has created on Hive
 */
async function fetchUserMutedList(username: string): Promise<Set<string>> {
  if (!username) return new Set();
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
    return new Set(mutedUsernames);
  } catch (err) {
    console.error('[HiveMuteService] Error fetching user muted list:', err);
    return new Set();
  }
}

/**
 * Fetches combined muted list: user's personal mutes + global blacklist
 * 
 * This is the main function that should be used throughout the app.
 * It combines:
 * 1. User's personal muted list from Hive blockchain
 * 2. Global blacklist maintained by HiveSnaps team
 * 
 * @param username - The Hive username to fetch muted list for
 * @returns Set of all usernames that should be muted for this user
 */
export async function fetchMutedList(username: string): Promise<Set<string>> {
  try {
    console.log(`[HiveMuteService] Fetching combined muted list for ${username}`);
    
    // Fetch both lists in parallel for better performance
    const [userMuted, globalBlacklist] = await Promise.allSettled([
      fetchUserMutedList(username),
      getGlobalBlacklist(),
    ]);
    
    // Handle user muted list result
    const userMutedSet = userMuted.status === 'fulfilled' 
      ? userMuted.value 
      : new Set<string>();
    
    if (userMuted.status === 'rejected') {
      console.warn('[HiveMuteService] Failed to fetch user muted list:', userMuted.reason);
    }
    
    // Handle global blacklist result
    const globalBlacklistSet = globalBlacklist.status === 'fulfilled'
      ? globalBlacklist.value
      : new Set<string>();
    
    if (globalBlacklist.status === 'rejected') {
      console.warn('[HiveMuteService] Failed to fetch global blacklist:', globalBlacklist.reason);
    }
    
    // Combine both sets
    const combinedMuted = new Set<string>();
    
    // Add user's personal muted list
    userMutedSet.forEach(user => combinedMuted.add(user));
    
    // Add global blacklist
    globalBlacklistSet.forEach(user => combinedMuted.add(user));
    
    console.log(`[HiveMuteService] Combined muted list: ${userMutedSet.size} personal + ${globalBlacklistSet.size} global = ${combinedMuted.size} total`);
    
    return combinedMuted;
    
  } catch (error) {
    console.error('[HiveMuteService] Error fetching combined muted list:', error);
    
    // Fallback: try to get at least the user's list
    try {
      const userMuted = await fetchUserMutedList(username);
      console.log('[HiveMuteService] Fallback: returning user muted list only');
      return userMuted;
    } catch (fallbackError) {
      console.error('[HiveMuteService] Fallback also failed:', fallbackError);
      return new Set();
    }
  }
}
