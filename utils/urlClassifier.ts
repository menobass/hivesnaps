export interface UrlInfo {
  type: 'normal' | 'hive_post' | 'embedded_media' | 'invalid';
  url: string;
  displayText?: string;
  metadata?: {
    youtubeId?: string;
    threeSpeakId?: string;
    ipfsHash?: string;
    hiveAuthor?: string;
    hivePermlink?: string;
  };
}

/**
 * Classifies a URL into different types for proper handling
 */
export function classifyUrl(url: string): UrlInfo {
  const cleanUrl = url.trim();
  
  // Validate it's a proper URL first
  try {
    new URL(cleanUrl);
  } catch {
    return {
      type: 'invalid',
      url: cleanUrl
    };
  }

  // Only support HTTP/HTTPS protocols for clickable links
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return {
      type: 'invalid',
      url: cleanUrl
    };
  }

  // Check for Hive post URLs
  const hivePostMatch = cleanUrl.match(
    /(?:https?:\/\/)?(?:www\.)?(?:ecency\.com|peakd\.com|hive\.blog)\/(?:[^\/]+\/)?(@[a-z0-9.-]{3,16}\/([a-z0-9-]+))/i
  );
  if (hivePostMatch) {
    return {
      type: 'hive_post',
      url: cleanUrl,
      metadata: {
        hiveAuthor: hivePostMatch[1].split('/')[0], // @username
        hivePermlink: hivePostMatch[2] // permlink
      }
    };
  }

  // Check for embedded media URLs
  const youtubeMatch = cleanUrl.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (youtubeMatch) {
    return {
      type: 'embedded_media',
      url: cleanUrl,
      metadata: {
        youtubeId: youtubeMatch[1]
      }
    };
  }

  const threeSpeakMatch = cleanUrl.match(
    /https:\/\/3speak\.tv\/watch\?v=([^\/\s]+)\/([a-zA-Z0-9_-]+)/
  );
  if (threeSpeakMatch) {
    return {
      type: 'embedded_media',
      url: cleanUrl,
      metadata: {
        threeSpeakId: `${threeSpeakMatch[1]}/${threeSpeakMatch[2]}`
      }
    };
  }

  const ipfsMatch = cleanUrl.match(/ipfs\/([A-Za-z0-9]+)/);
  if (ipfsMatch) {
    return {
      type: 'embedded_media',
      url: cleanUrl,
      metadata: {
        ipfsHash: ipfsMatch[1]
      }
    };
  }

  const mp4Match = cleanUrl.match(/\.mp4($|\?)/i);
  if (mp4Match) {
    return {
      type: 'embedded_media',
      url: cleanUrl
    };
  }

  // If none of the above, it's a normal URL
  return {
    type: 'normal',
    url: cleanUrl,
    displayText: cleanUrl.length > 50 ? cleanUrl.substring(0, 47) + '...' : cleanUrl
  };
}

/**
 * Extracts all URLs from text and classifies them
 */
export function extractAndClassifyUrls(text: string): UrlInfo[] {
  const urlRegex = /(https?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#@]*)?)/gi;
  const matches = text.match(urlRegex) || [];
  
  return matches.map(url => classifyUrl(url));
}

/**
 * Checks if a URL should be rendered as a clickable link
 */
export function shouldBeClickable(urlInfo: UrlInfo): boolean {
  return urlInfo.type === 'normal';
}

/**
 * Checks if a URL should be embedded as media
 */
export function shouldBeEmbedded(urlInfo: UrlInfo): boolean {
  return urlInfo.type === 'embedded_media';
}

/**
 * Checks if a URL should be rendered as a Hive post preview
 */
export function shouldBeHivePreview(urlInfo: UrlInfo): boolean {
  return urlInfo.type === 'hive_post';
} 