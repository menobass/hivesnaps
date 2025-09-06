// HiveMuteService.ts
// Service for fetching the muted list from HAFSQL API and providing it to the app in memory.

export async function fetchMutedList(username: string): Promise<Set<string>> {
  if (!username) return new Set();
  const apiUrl = `https://api.syncad.com/hafsql/accounts/${username}/muted?limit=100`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Failed to fetch muted list: ${response.status}`);
    const data = await response.json();
    // The API returns an array of usernames in the 'muted' field or as the root array
    const muted = Array.isArray(data)
      ? data
      : Array.isArray(data.muted)
        ? data.muted
        : [];
    return new Set(muted.map((u: any) => typeof u === 'string' ? u : u.account || u.username || ''));
  } catch (err) {
    console.error('[HiveMuteService] Error fetching muted list:', err);
    return new Set();
  }
}
