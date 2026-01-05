/**
 * Snapie.io URL Builder
 * 
 * Utility for generating canonical snapie.io URLs for Hive content.
 * Snapie.io is the official web frontend for HiveSnaps content.
 */

const SNAPIE_BASE_URL = 'https://www.snapie.io';

/**
 * Build a snapie.io URL for a snap or post
 * 
 * @param author - Hive username (without @)
 * @param permlink - Post permlink
 * @returns Full snapie.io URL
 * 
 * @example
 * buildSnapieUrl('meno', 'snap-1767640442209') 
 * // Returns: https://www.snapie.io/@meno/snap-1767640442209
 * 
 * buildSnapieUrl('meno', 'ab3e5393')
 * // Returns: https://www.snapie.io/@meno/ab3e5393
 */
export function buildSnapieUrl(author: string, permlink: string): string {
    // Remove @ if present in author
    const cleanAuthor = author.startsWith('@') ? author.slice(1) : author;

    // Validate inputs
    if (!cleanAuthor || !permlink) {
        throw new Error('Both author and permlink are required to build snapie.io URL');
    }

    return `${SNAPIE_BASE_URL}/@${cleanAuthor}/${permlink}`;
}

/**
 * Check if a URL is a snapie.io URL
 * 
 * @param url - URL to check
 * @returns True if URL is from snapie.io
 */
export function isSnapieUrl(url: string): boolean {
    if (!url) return false;

    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname === 'www.snapie.io' || urlObj.hostname === 'snapie.io';
    } catch {
        return false;
    }
}

/**
 * Parse a snapie.io URL to extract author and permlink
 * 
 * @param url - Snapie.io URL
 * @returns Object with author and permlink, or null if invalid
 * 
 * @example
 * parseSnapieUrl('https://www.snapie.io/@meno/snap-1767640442209')
 * // Returns: { author: 'meno', permlink: 'snap-1767640442209' }
 */
export function parseSnapieUrl(url: string): { author: string; permlink: string } | null {
    if (!isSnapieUrl(url)) {
        return null;
    }

    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const pathParts = urlObj.pathname.split('/').filter(p => p);

        // Expected format: /@author/permlink
        if (pathParts.length === 2 && pathParts[0].startsWith('@')) {
            const author = pathParts[0].slice(1); // Remove @
            const permlink = pathParts[1];

            if (author && permlink) {
                return { author, permlink };
            }
        }

        return null;
    } catch (error) {
        console.warn('[parseSnapieUrl] Error parsing URL:', error);
        return null;
    }
}
