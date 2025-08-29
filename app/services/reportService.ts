import { REPORT_API_URL } from '../config/api';

export type ReportReason = 'violence' | 'harmful' | 'scam' | 'other' | 'spam';

export interface ReportPayload {
  community: string; // e.g., '@khaleelkazi'
  author: string;    // e.g., 'khaleelkazi'
  permlink: string;  // e.g., 're-leothreads-2daxu2czj'
  reason: string;    // API expects a string reason; we'll map from our UI
  details?: string;  // optional free text if 'other'
}

// Small helper to add a timeout to fetch requests (React Native supports AbortController)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function submitReport(payload: ReportPayload): Promise<{ ok: boolean; status: number; body?: any }> {
  // Basic URL sanity check to avoid opaque RN errors
  if (!REPORT_API_URL || typeof REPORT_API_URL !== 'string' || !/^https?:\/\//i.test(REPORT_API_URL)) {
    throw new Error('Invalid REPORT_API_URL configuration');
  }
  try {
    const res = await fetchWithTimeout(REPORT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 12000);
    let body: any = undefined;
    try {
      body = await res.json();
    } catch {
      // Non-JSON response; leave body undefined
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    // Normalize RN network failure into a clear error
    const msg = (e && e.message) || String(e);
    if (msg.includes('Network request failed') || msg.includes('AbortError')) {
      throw new Error('NetworkError: report submission failed');
    }
    throw e;
  }
}

export function mapUiReasonToApi(reason: string, details?: string): { reason: string; details?: string } {
  // Map our UI keys to API terms when needed
  switch (reason) {
    case 'violence':
      return { reason: 'violence' };
    case 'harmful':
      return { reason: 'harmful' };
    case 'scam':
      return { reason: 'scam' };
    case 'spam':
      return { reason: 'spam' };
    case 'other':
      // API expects the explanation included in the reason field
      if (details && details.trim().length > 0) {
        return { reason: `Other + ${details.trim()}` };
      }
      return { reason: 'Other' };
    default:
      return { reason };
  }
}
