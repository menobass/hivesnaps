// This file was moved from app/services/reportService.ts
import { authenticatedApiCall } from './AuthenticatedRequest';

export type ReportReason = 'violence' | 'harmful' | 'scam' | 'other' | 'spam' | 'child_safety';

export interface ReportPayload {
  community: string; // e.g., '@khaleelkazi'
  author: string;    // e.g., 'khaleelkazi'
  permlink: string;  // e.g., 're-leothreads-2daxu2czj'
  reason: string;    // API expects a string reason; we'll map from our UI
  details?: string;  // optional free text for 'other' and 'child_safety' reports
}

export async function submitReport(payload: ReportPayload): Promise<{ ok: boolean; status: number; body?: any }> {
  try {
    const response = await authenticatedApiCall('/report', 'POST', payload);
    
    return { 
      ok: response.status >= 200 && response.status < 300, 
      status: response.status, 
      body: response.body 
    };
  } catch (e: any) {
    const msg = (e && e.message) || String(e);
    if (msg.includes('Network request failed') || msg.includes('AbortError')) {
      throw new Error('NetworkError: report submission failed');
    }
    if (msg.includes('Authentication required')) {
      throw new Error('AuthError: please login to report content');
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
    case 'child_safety':
      return { reason: 'URGENT - Child Safety Concern', details };
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
