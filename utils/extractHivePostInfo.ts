/**
 * Utility for extracting and fetching Hive post information from URLs
 * Supports ecency.com, peakd.com, and hive.blog post links
 */

import { Client } from '@hiveio/dhive';
import { detectPostType, type PostInfo } from './postTypeDetector';

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
    console.log('[extractHivePostInfo] parseHivePostUrl called with:', url);

    // Remove protocol and www if present
    const cleanUrl = url.replace(/^https?:\/\/(?:www\.)?/, '');

    // Extract path part
    const pathMatch = cleanUrl.match(
      /^(?:ecency\.com|peakd\.com|hive\.blog)\/(.+)$/
    );
    if (!pathMatch) {
      console.log(
        '[extractHivePostInfo] URL does not match expected domain pattern:',
        cleanUrl
      );
      return null;
    }

    const path = pathMatch[1];

    // Handle different URL formats
    let authorPermlinkMatch;

    // Format: @author/permlink or hive-123/@author/permlink
    authorPermlinkMatch = path.match(
      /^(?:hive-\d+\/)?@([a-z0-9.-]{3,16})\/([a-z0-9-]+)$/
    );
    if (authorPermlinkMatch) {
      const author = authorPermlinkMatch[1];
      const permlink = authorPermlinkMatch[2];

      // Validate permlink format - should be longer than just a single word
      if (permlink.length < 8) {
        console.log('[extractHivePostInfo] Rejecting short permlink:', {
          permlink,
          length: permlink.length,
          url,
        });
        return null;
      }

      // Check if permlink looks like a valid post permlink (not just a category/page)
      const validPermlinkPattern =
        /^[a-z0-9-]+(?:-\d{4}-\d{2}-\d{2}|-\d{10,}|-[a-z0-9-]{8,})$/;
      if (!validPermlinkPattern.test(permlink)) {
        console.log(
          '[extractHivePostInfo] Rejecting invalid permlink format:',
          {
            permlink,
            url,
          }
        );
        return null;
      }

      console.log('[extractHivePostInfo] Successfully parsed URL:', {
        author,
        permlink,
        url,
      });
      return { author, permlink };
    }

    console.log(
      '[extractHivePostInfo] URL does not match author/permlink pattern:',
      path
    );
    return null;
  } catch (error) {
    console.error('[extractHivePostInfo] Error parsing Hive post URL:', error);
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
    console.log('[extractHivePostInfo] fetchHivePostInfo called with:', {
      author,
      permlink,
      originalUrl,
    });

    // Validate parameters before making API call
    if (!author || !permlink || author.length < 3 || permlink.length < 5) {
      console.warn('[extractHivePostInfo] Invalid parameters:', {
        author,
        permlink,
      });
      return null;
    }

    // Fetch post content and author avatar in parallel
    const [post, avatarUrl] = await Promise.all([
      client.database.call('get_content', [author, permlink]),
      fetchAuthorAvatar(author),
    ]);

    if (!post || !post.author) {
      console.warn('[extractHivePostInfo] Post not found:', author, permlink);
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

    // Smart title function - determines title based on post type
    const getSmartTitle = async (postData: any): Promise<string> => {
      // If it has a title, use it
      if (postData.title && postData.title.trim()) {
        return postData.title;
      }

      // Use post type detection logic for untitled posts
      const postInfo: PostInfo = {
        author: postData.author,
        permlink: postData.permlink,
        title: postData.title,
        body: postData.body,
        json_metadata: postData.json_metadata,
        parent_author: postData.parent_author,
        parent_permlink: postData.parent_permlink,
      };

      const postType = await detectPostType(postInfo);

      // Return appropriate label based on type
      return postType === 'snap' ? 'Resnap' : 'Untitled Post';
    };

    return {
      author: post.author,
      permlink: post.permlink,
      title: await getSmartTitle(post),
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
    console.error('[extractHivePostInfo] Error fetching Hive post info:', {
      error,
      author,
      permlink,
      originalUrl,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    // Specific warning for "Invalid parameters" - likely malformed URL
    if (
      error instanceof Error &&
      error.message.includes('Invalid parameters')
    ) {
      console.warn(
        '[extractHivePostInfo] Invalid parameters detected - likely malformed URL or non-existent post:',
        {
          author,
          permlink,
          originalUrl,
        }
      );
    }

    return null;
  }
}

/**
 * Batch fetch multiple Hive post infos
 */
export async function fetchMultipleHivePostInfos(
  urls: string[]
): Promise<HivePostInfo[]> {
  console.log('[extractHivePostInfo] fetchMultipleHivePostInfos called with:', {
    urlsCount: urls.length,
    urls: urls.slice(0, 3), // Log first 3 URLs for debugging
  });

  const results = await Promise.allSettled(
    urls.map(async url => {
      try {
        const parsed = parseHivePostUrl(url);
        if (!parsed) {
          console.log('[extractHivePostInfo] Failed to parse URL:', url);
          return null;
        }

        return await fetchHivePostInfo(parsed.author, parsed.permlink, url);
      } catch (error) {
        console.error(
          '[extractHivePostInfo] Error processing URL:',
          url,
          error
        );
        return null;
      }
    })
  );

  const validResults = results
    .filter(
      (result): result is PromiseFulfilledResult<HivePostInfo | null> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value!);

  console.log('[extractHivePostInfo] fetchMultipleHivePostInfos completed:', {
    totalUrls: urls.length,
    validResults: validResults.length,
  });

  return validResults;
}

/**
 * Check if a URL is a snap URL by detecting the post type
 */
export async function isSnapUrl(url: string): Promise<boolean> {
  try {
    console.log('[extractHivePostInfo] Checking if URL is a snap:', url);

    // Parse the URL to get author and permlink
    const postInfo = parseHivePostUrl(url);
    if (!postInfo) {
      console.log('[extractHivePostInfo] Could not parse URL as Hive post');
      return false;
    }

    // Import postTypeDetector dynamically to avoid circular dependencies
    const { detectPostType } = await import('./postTypeDetector');

    // Detect the post type
    const postType = await detectPostType({
      author: postInfo.author,
      permlink: postInfo.permlink,
    });

    const isSnap = postType === 'snap';
    console.log(
      '[extractHivePostInfo] URL post type:',
      postType,
      'isSnap:',
      isSnap
    );

    return isSnap;
  } catch (error) {
    console.error(
      '[extractHivePostInfo] Error checking if URL is snap:',
      error
    );
    return false;
  }
}

/**
 * Get navigation info for a Hive post URL
 */
export async function getHivePostNavigationInfo(url: string): Promise<{
  isSnap: boolean;
  author: string;
  permlink: string;
  route: string;
} | null> {
  try {
    console.log('[extractHivePostInfo] Getting navigation info for URL:', url);

    // Parse the URL to get author and permlink
    const postInfo = parseHivePostUrl(url);
    if (!postInfo) {
      console.log('[extractHivePostInfo] Could not parse URL as Hive post');
      return null;
    }

    // Import postTypeDetector dynamically to avoid circular dependencies
    const { detectPostType } = await import('./postTypeDetector');

    // Detect the post type
    const postType = await detectPostType({
      author: postInfo.author,
      permlink: postInfo.permlink,
    });

    const isSnap = postType === 'snap';
    const route = isSnap ? '/ConversationScreen' : '/HivePostScreen';

    console.log('[extractHivePostInfo] Navigation info:', {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    });

    return {
      isSnap,
      author: postInfo.author,
      permlink: postInfo.permlink,
      route,
    };
  } catch (error) {
    console.error(
      '[extractHivePostInfo] Error getting navigation info:',
      error
    );
    return null;
  }
}
