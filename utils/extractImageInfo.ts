/**
 * Utility functions to extract image information from content for editing
 */

export interface ImageInfo {
  url: string;
  altText: string;
  markdown: string;
  type: 'markdown' | 'html';
}

/**
 * Extract image information from markdown image syntax
 * Example: ![alt text](https://example.com/image.jpg)
 */
function extractMarkdownImages(text: string): ImageInfo[] {
  const markdownImageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
  const images: ImageInfo[] = [];
  let match;

  while ((match = markdownImageRegex.exec(text)) !== null) {
    const [, altText, url] = match;
    images.push({
      url: url.trim(),
      altText: altText.trim(),
      markdown: match[0],
      type: 'markdown',
    });
  }

  return images;
}

/**
 * Extract image information from HTML img tags
 * Example: <img src="https://example.com/image.jpg" alt="alt text" />
 */
function extractHtmlImages(text: string): ImageInfo[] {
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: ImageInfo[] = [];
  let match;

  while ((match = htmlImageRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const url = match[1];

    // Extract alt text if present
    const altMatch = fullMatch.match(/alt=["']([^"']+)["']/i);
    const altText = altMatch ? altMatch[1] : '';

    images.push({
      url: url.trim(),
      altText: altText.trim(),
      markdown: fullMatch,
      type: 'html',
    });
  }

  return images;
}

/**
 * Extract all image information from content
 */
export function extractImageInfo(content: string): ImageInfo[] {
  const markdownImages = extractMarkdownImages(content);
  const htmlImages = extractHtmlImages(content);

  return [...markdownImages, ...htmlImages];
}

/**
 * Remove image tags from content while preserving the rest
 */
export function stripImageTags(content: string): string {
  // Remove markdown images
  let cleaned = content.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');
  // Remove html <img ...>
  cleaned = cleaned.replace(/<img[^>]+src=["'][^"'>]+["'][^>]*>/g, '');
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n').trim();
  return cleaned;
}

/**
 * Get the first image URL from content (useful for edit modal)
 */
export function getFirstImageUrl(content: string): string | null {
  const images = extractImageInfo(content);
  return images.length > 0 ? images[0].url : null;
}

/**
 * Get all image URLs from content
 */
export function getAllImageUrls(content: string): string[] {
  const images = extractImageInfo(content);
  return images.map(img => img.url);
}
