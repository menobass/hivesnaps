// Utility to strip markdown and html image tags from a string
export function stripImageTags(text: string): string {
  // Remove markdown image tags: ![alt](url)
  let result = text.replace(/!\[[^\]]*\]\(([^)]+)\)/g, '');
  // Remove html image tags: <img ...>
  result = result.replace(/<img[^>]*>/g, '');
  // Trim whitespace and newlines
  return result.trim();
}
