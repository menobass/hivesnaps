/**
 * Utility for extracting and fetching Hive post information from URLs
 * Supports ecency.com, peakd.com, and hive.blog post links
 */

import { Client } from '@hiveio/dhive';

const client = new Client([
  'https://api.hive.blog',
  'https://api.hivekings.com',
  'https://anyx.io',
]);

export interface HivePostInfo {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  voteCount: number;
  replyCount: number;
  payout: number;
  avatarUrl?: string;
  imageUrl?: string;
  summary: string;
  originalUrl: string;
  category?: string;
  tags: string[];
}

/**
 * Extract Hive post URLs from text content
 * Matches various Hive frontend URL patterns
 */
export function extractHivePostUrls(text: string): string[] {
  const hivePostUrls: string[] = [];

  // Regex patterns for different Hive frontends
  const patterns = [
    // ecency.com patterns
    /(?:https?:\/\/)?(?:www\.)?ecency\.com\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?ecency\.com\/(hive-\d+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,

    // peakd.com patterns
    /(?:https?:\/\/)?(?:www\.)?peakd\.com\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?peakd\.com\/(hive-\d+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,

    // hive.blog patterns
    /(?:https?:\/\/)?(?:www\.)?hive\.blog\/(@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
    /(?:https?:\/\/)?(?:www\.)?hive\.blog\/(hive-\d+\/@[a-z0-9.-]{3,16}\/[a-z0-9-]+)/gi,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullUrl = match[0].startsWith('http')
        ? match[0]
        : `https://${match[0]}`;
      if (!hivePostUrls.includes(fullUrl)) {
        hivePostUrls.push(fullUrl);
      }
    }
  });

  return hivePostUrls;
}

/**
 * Parse author and permlink from Hive post URL
 */
export function parseHivePostUrl(
  url: string
): { author: string; permlink: string } | null {
  try {
    // Remove protocol and www if present
    const cleanUrl = url.replace(/^https?:\/\/(?:www\.)?/, '');

    // Extract path part
    const pathMatch = cleanUrl.match(
      /^(?:ecency\.com|peakd\.com|hive\.blog)\/(.+)$/
    );
    if (!pathMatch) return null;

    const path = pathMatch[1];

    // Handle different URL formats
    let authorPermlinkMatch;

    // Format: @author/permlink or hive-123/@author/permlink
    authorPermlinkMatch = path.match(
      /^(?:hive-\d+\/)?@([a-z0-9.-]{3,16})\/([a-z0-9-]+)$/
    );
    if (authorPermlinkMatch) {
      return {
        author: authorPermlinkMatch[1],
        permlink: authorPermlinkMatch[2],
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing Hive post URL:', error);
    return null;
  }
}

/**
 * Remove Hive post URLs from text content
 */
export function removeHivePostUrls(text: string): string {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?ecency\.com\/(?:hive-\d+\/)?@[a-z0-9.-]{3,16}\/[a-z0-9-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?peakd\.com\/(?:hive-\d+\/)?@[a-z0-9.-]{3,16}\/[a-z0-9-]+/gi,
    /(?:https?:\/\/)?(?:www\.)?hive\.blog\/(?:hive-\d+\/)?@[a-z0-9.-]{3,16}\/[a-z0-9-]+/gi,
  ];

  let result = text;
  patterns.forEach(pattern => {
    result = result.replace(pattern, '').trim();
  });

  // Clean up extra whitespace and newlines
  return result.replace(/\n\s*\n/g, '\n').trim();
}

/**
 * Extract first image URL from markdown/HTML content
 */
function extractFirstImage(body: string): string | undefined {
  // Try markdown image syntax first
  const mdImageMatch = body.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
  if (mdImageMatch) {
    return mdImageMatch[1];
  }

  // Try HTML img tag
  const htmlImageMatch = body.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (htmlImageMatch) {
    return htmlImageMatch[1];
  }

  return undefined;
}

/**
 * Generate post summary from body content
 */
function generateSummary(body: string, maxLength = 150): string {
  // Remove markdown and HTML formatting
  let summary = body
    .replace(/!\[.*?\]\([^)]*\)/g, '') // Remove images
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/#{1,6}\s*/g, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // Convert links to text
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (summary.length <= maxLength) {
    return summary;
  }

  // Truncate at word boundary
  const truncated = summary.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxLength * 0.7
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';
}

/**
 * Fetch author avatar URL with caching
 */
const avatarCache = new Map<string, string | undefined>();

async function fetchAuthorAvatar(author: string): Promise<string | undefined> {
  // Check cache first
  if (avatarCache.has(author)) {
    return avatarCache.get(author);
  }

  try {
    const accounts = await client.database.getAccounts([author]);
    if (!accounts || accounts.length === 0) {
      avatarCache.set(author, undefined);
      return undefined;
    }

    const account = accounts[0];
    let meta = account.posting_json_metadata;
    if (!meta || meta === '{}') {
      meta = account.json_metadata;
    }

    if (meta) {
      try {
        const profile = JSON.parse(meta).profile;
        const avatarUrl = profile?.profile_image || undefined;
        avatarCache.set(author, avatarUrl);
        return avatarUrl;
      } catch (e) {
        // Invalid JSON metadata
      }
    }

    avatarCache.set(author, undefined);
    return undefined;
  } catch (error) {
    console.error('Error fetching author avatar:', error);
    avatarCache.set(author, undefined);
    return undefined;
  }
}

/**
 * Fetch complete Hive post information
 */
export async function fetchHivePostInfo(
  author: string,
  permlink: string,
  originalUrl: string
): Promise<HivePostInfo | null> {
  try {
    // Fetch post content and author avatar in parallel
    const [post, avatarUrl] = await Promise.all([
      client.database.call('get_content', [author, permlink]),
      fetchAuthorAvatar(author),
    ]);

    if (!post || !post.author) {
      console.warn('Post not found:', author, permlink);
      return null;
    }

    // Calculate payout
    const payout = parseFloat(
      post.pending_payout_value
        ? post.pending_payout_value.replace(' HBD', '')
        : '0'
    );

    // Extract tags from metadata
    let tags: string[] = [];
    try {
      if (post.json_metadata) {
        const metadata = JSON.parse(post.json_metadata);
        tags = metadata.tags || [];
      }
    } catch (e) {
      // Invalid JSON metadata
    }

    // Get main category (first tag or parent category)
    const category = tags.length > 0 ? tags[0] : post.category || undefined;

    // Extract first image
    const imageUrl = extractFirstImage(post.body);

    // Generate summary
    const summary = generateSummary(post.body);

    return {
      author: post.author,
      permlink: post.permlink,
      title: post.title || 'Untitled Post',
      body: post.body,
      created: post.created,
      voteCount: post.net_votes || 0,
      replyCount: post.children || 0,
      payout,
      avatarUrl,
      imageUrl,
      summary,
      originalUrl,
      category,
      tags: tags.slice(0, 5), // Limit to first 5 tags
    };
  } catch (error) {
    console.error('Error fetching Hive post info:', error);
    return null;
  }
}

/**
 * Batch fetch multiple Hive post infos
 */
export async function fetchMultipleHivePostInfos(
  urls: string[]
): Promise<HivePostInfo[]> {
  const results = await Promise.allSettled(
    urls.map(async url => {
      const parsed = parseHivePostUrl(url);
      if (!parsed) return null;

      return await fetchHivePostInfo(parsed.author, parsed.permlink, url);
    })
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<HivePostInfo | null> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value!);
}
