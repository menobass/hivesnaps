// Render Hive markdown+HTML to sanitized HTML using Ecency render-helper
// This isolates library usage so we can tune options later or swap implementations.

import { renderPostBody, setProxyBase } from '@ecency/render-helper';

export interface RenderHiveOptions {
  // Whether to convert line breaks to <br/>
  breaks?: boolean;
  // Proxy images via Ecency CDN (we generally keep off for RN)
  proxifyImages?: boolean;
}

export function renderHiveToHtml(
  raw: string,
  options: RenderHiveOptions = {}
): string {
  const { breaks = true, proxifyImages = false } = options;

  // Configure image proxy base only if requested
  if (proxifyImages) {
    try {
      setProxyBase('https://images.ecency.com');
    } catch {}
  }

  // renderPostBody: (objOrString, forApp=true, webp=false)
  // Some RN environments return empty string with forApp=true. Fallback to forApp=false.
  let html = renderPostBody(raw || '', true, false);
  if (!html || (typeof html === 'string' && html.trim().length === 0)) {
    html = renderPostBody(raw || '', false, false);
  }

  return typeof html === 'string' ? html : String(html ?? '');
}
