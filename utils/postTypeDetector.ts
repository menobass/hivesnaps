/**
 * Utility to detect post types (snap vs regular Hive post)
 */

export interface PostInfo {
  author: string;
  permlink: string;
  title?: string;
  body?: string;
  json_metadata?: string;
  parent_author?: string;
  parent_permlink?: string;
}

export type PostType = 'snap' | 'hive_post';

/**
 * Detect if a post is a snap based on its metadata and content
 */
export function detectPostType(post: PostInfo): PostType {
  console.log('[postTypeDetector] detectPostType called with:', {
    author: post.author,
    permlink: post.permlink,
    parent_author: post.parent_author,
    hasMetadata: !!post.json_metadata,
    hasBody: !!post.body,
  });

  // Check for invalid/short permlinks that are likely not real posts
  if (post.permlink && post.permlink.length < 5) {
    console.log('[postTypeDetector] Very short permlink, likely invalid post');
    return 'hive_post'; // Default to regular post for invalid ones
  }

  // Check if it's a snap based on metadata
  if (post.json_metadata) {
    try {
      const metadata = JSON.parse(post.json_metadata);
      console.log('[postTypeDetector] Parsed metadata:', {
        app: metadata.app,
        tags: metadata.tags,
        tagsCount: metadata.tags?.length || 0,
      });

      // Check for snap-specific metadata
      if (metadata.app && metadata.app.includes('hivesnaps')) {
        console.log('[postTypeDetector] Detected snap by app metadata');
        return 'snap';
      }

      // Check for snap-specific tags - be more specific
      if (metadata.tags && Array.isArray(metadata.tags)) {
        // Only detect as snap if it has the specific hivesnaps tag AND other snap indicators
        if (metadata.tags.includes('hivesnaps')) {
          // Additional check: only detect as snap if it also has other snap indicators
          // This prevents regular posts that happen to have 'hivesnaps' as a tag
          const hasOtherSnapIndicators =
            (metadata.app && metadata.app.includes('hivesnaps')) ||
            (post.permlink && post.permlink.startsWith('snap-')) ||
            post.parent_author === 'peak.snaps';

          if (hasOtherSnapIndicators) {
            console.log(
              '[postTypeDetector] Detected snap by hivesnaps tag + other indicators'
            );
            return 'snap';
          } else {
            console.log(
              '[postTypeDetector] Has hivesnaps tag but no other snap indicators - treating as regular post'
            );
          }
        }
        // Don't detect as snap just because it has 'snap' in tags - that's too broad
        // Many regular posts might have 'snap' as a tag but aren't actually snaps
      }
    } catch (e) {
      console.log('[postTypeDetector] Invalid JSON metadata:', e);
      // Invalid JSON metadata, continue with other checks
    }
  }

  // Check if it's a snap based on permlink pattern
  // Snaps typically have permlinks that start with "snap-" followed by a timestamp
  if (post.permlink && post.permlink.startsWith('snap-')) {
    console.log('[postTypeDetector] Detected snap by permlink pattern');
    return 'snap';
  }

  // Check if it's a snap based on parent_author
  // Snaps are typically replies to a container post by 'peak.snaps'
  if (post.parent_author === 'peak.snaps') {
    console.log('[postTypeDetector] Detected snap by parent_author');
    return 'snap';
  }

  // Additional check: if parent_author is empty or null, it's likely a regular post
  if (!post.parent_author || post.parent_author === '') {
    console.log('[postTypeDetector] No parent_author, likely regular post');
    // Continue with other checks, but this is a good indicator
  }

  // Check if it's a snap based on content patterns
  if (post.body) {
    const body = post.body.toLowerCase();

    // Look for snap-specific content patterns - be more specific
    if (body.includes('#hivesnaps')) {
      console.log('[postTypeDetector] Detected snap by #hivesnaps hashtag');
      return 'snap';
    }

    // Don't detect as snap just because it mentions 'snapie' or 'snap-' in content
    // This is too broad and catches regular posts that mention these words
    // Only detect if it has specific snap formatting or patterns
  }

  console.log('[postTypeDetector] Defaulting to regular Hive post');
  // Default to regular Hive post
  return 'hive_post';
}

/**
 * Get the appropriate screen route based on post type
 */
export function getPostScreenRoute(post: PostInfo): string {
  const postType = detectPostType(post);

  if (postType === 'snap') {
    return '/ConversationScreen';
  } else {
    return '/HivePostScreen';
  }
}

/**
 * Get navigation parameters for the appropriate screen
 */
export function getPostNavigationParams(post: PostInfo) {
  const route = getPostScreenRoute(post);

  return {
    route,
    params: {
      author: post.author,
      permlink: post.permlink,
    },
  };
}
