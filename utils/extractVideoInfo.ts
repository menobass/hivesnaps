/**
 * Enhanced video detection utility for HiveSnaps
 * Supports YouTube, 3speak, and IPFS video links
 * 
 * For future open source collaboration:
 * - Add new video platform support by extending the VideoInfo type and detection logic
 * - IPFS videos are served directly, 3speak uses their embed player
 * - YouTube uses standard embed URLs
 */

export interface VideoInfo {
  type: 'youtube' | '3speak' | 'ipfs';
  id?: string;
  username?: string;
  videoId?: string;
  ipfsHash?: string;
  embedUrl: string;
  originalUrl: string;
}

/**
 * Extract video information from text content
 * @param text - The text content to search for video URLs
 * @returns VideoInfo object if video found, null otherwise
 */
export function extractVideoInfo(text: string): VideoInfo | null {
  // YouTube detection (now supports Shorts, embed, v, and watch URLs)
  const youtubeMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      id: youtubeMatch[1],
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      originalUrl: youtubeMatch[0]
    };
  }

  // 3Speak detection
  const threeSpeakMatch = text.match(/https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/);
  if (threeSpeakMatch) {
    return {
      type: '3speak',
      username: threeSpeakMatch[1],
      videoId: threeSpeakMatch[2],
      embedUrl: `https://3speak.tv/embed?v=${threeSpeakMatch[1]}/${threeSpeakMatch[2]}`,
      originalUrl: threeSpeakMatch[0]
    };
  }

  // IPFS video detection (iframe tags first - more specific)
  const ipfsIframeMatch = text.match(/<iframe[^>]+src=["']([^"']*\/ipfs\/([A-Za-z0-9]+)[^"']*?)["'][^>]*>/i);
  if (ipfsIframeMatch) {
    return {
      type: 'ipfs',
      ipfsHash: ipfsIframeMatch[2],
      embedUrl: ipfsIframeMatch[1],
      originalUrl: ipfsIframeMatch[0]
    };
  }

  // IPFS direct links (without iframe) 
  const ipfsDirectMatch = text.match(/(https?:\/\/[^\/\s]+\/ipfs\/([A-Za-z0-9]+))/);
  if (ipfsDirectMatch) {
    return {
      type: 'ipfs',
      ipfsHash: ipfsDirectMatch[2],
      embedUrl: ipfsDirectMatch[1],
      originalUrl: ipfsDirectMatch[0]
    };
  }

  return null;
}

/**
 * Remove video URLs from text content
 * @param text - The text to clean
 * @returns Cleaned text with video URLs removed
 */
export function removeVideoUrls(text: string): string {
  return text
    // Remove YouTube URLs
    .replace(/(?:https?:\/\/(?:www\.)?)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)\w{11}(\S*)?/gi, '')
    // Remove 3speak URLs
    .replace(/https:\/\/3speak\.tv\/watch\?v=[^\/\s]+\/[a-zA-Z0-9_-]+/gi, '')
    // Remove IPFS iframe tags
    .replace(/<iframe[^>]+src=["'][^"']*ipfs[^"']*["'][^>]*><\/iframe>/gi, '')
    // Remove direct IPFS links
    .replace(/https?:\/\/[^\/\s]+\/ipfs\/[A-Za-z0-9]+/gi, '')
    // Clean up extra whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Remove Twitter/X URLs from text content when they're rendered as embeds
 * @param text - The text to clean
 * @returns Cleaned text with Twitter/X URLs removed
 */
export function removeTwitterUrls(text: string): string {
  return text
    // Remove Twitter/X status URLs
    .replace(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+(\S*)?/gi, '')
    // Clean up extra whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Remove all social media and video URLs that should be rendered as embeds
 * @param text - The text to clean
 * @returns Cleaned text with embed URLs removed
 */
export function removeEmbedUrls(text: string): string {
  let cleanText = removeVideoUrls(text);
  cleanText = removeTwitterUrls(cleanText);
  return cleanText;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use extractVideoInfo instead
 */
export function extractYouTubeId(text: string): string | null {
  const videoInfo = extractVideoInfo(text);
  return videoInfo && videoInfo.type === 'youtube' ? videoInfo.id || null : null;
}
