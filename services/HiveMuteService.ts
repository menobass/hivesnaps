// HiveMuteService.ts
// Service for fetching the muted list from HAFSQL API and providing it to the app in memory.


// Define interfaces for the expected API response and muted user objects
interface MutedUserObject {
  account?: string;
  username?: string;
}
type MutedApiResponse = string[] | { muted: (string | MutedUserObject)[] };

export async function fetchMutedList(username: string): Promise<Set<string>> {
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
    console.error('[HiveMuteService] Error fetching muted list:', err);
    return new Set();
  }
}
