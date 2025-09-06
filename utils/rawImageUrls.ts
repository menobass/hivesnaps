// Utilities for robust raw image URL extraction and removal
// Handles direct and Hive proxy-chained image URLs with optional query strings.
// Preserves newlines and paragraph spacing when removing URLs.

// Build a fresh regex each call to avoid lastIndex state issues with /g
export function getRawImageUrlRegex(): RegExp {
  const source = String.raw`(?:^|([\s(]))((https?:\/\/\S+?\.(?:jpe?g|png|gif|webp|bmp|svg)(?:\?[^\s)]*)?))(?:(\r?\n)|([ \t])|[)\],.!?]|$)`;
  return new RegExp(source, 'gi');
}

// Extract raw image URLs not already inside markdown image syntax
export function extractRawImageUrls(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  text.replace(
    getRawImageUrlRegex(),
    (
      _full: string,
      leading: string | undefined,
      url: string,
      _trailNewline?: string,
      _trailSpace?: string
    ) => {
    const cleaned = url.replace(/[,.!]+$/g, '');
    found.add(cleaned);
    return _full;
    }
  );

  return Array.from(found).filter(u => {
    try {
      // Escape the URL safely for use inside a regex, including the closing bracket
      const escaped = u.replace(/[.*+?^${}()|[\]\\\]]/g, m => `\\${m}`);
      const markdownImagePattern = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`);
      return !markdownImagePattern.test(text);
    } catch (e) {
      console.warn('[extractRawImageUrls] RegExp error for URL:', u, e);
      return false;
    }
  });
}

// Remove discovered raw image URLs while preserving newlines/paragraphs
export function removeRawImageUrls(text: string): string {
  if (!text) return text;
  let result = text;

  // 1) URLs inside parentheses: transform `(URL)` -> `(`
  const urlCore = String.raw`https?:\/\/\S+?\.(?:jpe?g|png|gif|webp|bmp|svg)(?:\?[^)\s]*)?`;
  const parenthesized = new RegExp(String.raw`\((${urlCore})\)`, 'gi');
  result = result.replace(parenthesized, '(');

  // 2) Raw URLs preceded by whitespace; keep the whitespace, drop the URL.
  const rawWithWs = new RegExp(String.raw`(\s)(${urlCore})(?=\s|$)`, 'gi');
  result = result.replace(rawWithWs, '$1');

  // Normalize horizontal whitespace per line without collapsing blank lines
  result = result
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]{2,}/g, ' ').replace(/ +$/, ''))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n');

  return result;
}
