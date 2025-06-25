// Utility to extract all external (non-image, non-YouTube) links from Markdown, HTML, and raw URLs in a string.
// Returns { links: Array<{url: string, label?: string}>, text: stringWithoutLinks }

const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.ico', '.apng', '.avif', '.jfif', '.pjpeg', '.pjp', '.xbm', '.dib'
];

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.some(ext => url.toLowerCase().includes(ext));
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[\w-]+/.test(url);
}

export interface ExtractedLink {
  url: string;
  label?: string;
}

export function extractExternalLinks(input: string): { links: ExtractedLink[], text: string } {
  let text = input;
  const links: ExtractedLink[] = [];

  // 1. Extract HTML anchor tags
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (match, url, label) => {
    if (!isImageUrl(url) && !isYouTubeUrl(url)) {
      links.push({ url, label: label && label.trim() ? label : undefined });
      return '';
    }
    return '';
  });

  // 2. Extract Markdown links [label](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    if (!isImageUrl(url) && !isYouTubeUrl(url)) {
      links.push({ url, label: label && label.trim() ? label : undefined });
      return '';
    }
    return match;
  });

  // 3. Extract raw URLs (http/https)
  text = text.replace(/(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)(?![^\s]*["'>\]])/g, (match, url) => {
    if (!isImageUrl(url) && !isYouTubeUrl(url)) {
      // Avoid duplicates
      if (!links.some(l => l.url === url)) {
        links.push({ url });
      }
      return '';
    }
    return match;
  });

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').replace(/\s{3,}/g, ' ').trim();

  return { links, text };
}
