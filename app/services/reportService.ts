import { REPORT_API_URL } from '../config/api';

export type ReportReason = 'violence' | 'harmful' | 'scam' | 'other' | 'spam';

export interface ReportPayload {
  community: string; // e.g., '@khaleelkazi'
  author: string;    // e.g., 'khaleelkazi'
  permlink: string;  // e.g., 're-leothreads-2daxu2czj'
  reason: string;    // API expects a string reason; we'll map from our UI
  details?: string;  // optional free text if 'other'
}

export async function submitReport(payload: ReportPayload): Promise<{ ok: boolean; status: number; body?: any }>{
  const res = await fetch(REPORT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body: any = undefined;
  try {
    body = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, body };
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
