// Utility to extract image URLs from markdown and html in a string
export function extractImageUrls(text: string): string[] {
  const urls: string[] = [];
  // Markdown: ![alt](url)
  const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  // HTML: <img src="url" ...>
  const htmlRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/g;
  while ((match = htmlRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}
