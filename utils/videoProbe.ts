/**
 * Video Host Probe Utility
 * 
 * Pure function to check if a video host/embed URL is reachable.
 * Used to provide better UX when video servers are temporarily unavailable.
 */

/**
 * Probe a video host URL to check if it's reachable
 * 
 * @param url - The embed URL to probe (e.g., https://play.3speak.tv/embed?v=...)
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise<boolean> - true if reachable, false otherwise
 */
export async function probeVideoHost(
    url: string,
    timeoutMs: number = 5000
): Promise<boolean> {
    try {
        // Extract origin from the full URL for efficient probing
        const urlObj = new URL(url);
        const probeUrl = `${urlObj.origin}/`;

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Attempt HEAD request first (lightweight)
            const response = await fetch(probeUrl, {
                method: 'HEAD',
                signal: controller.signal,
                // Don't follow redirects for speed
                redirect: 'manual',
            });

            clearTimeout(timeoutId);

            // Consider 2xx and 3xx as successful (server is reachable)
            return response.status >= 200 && response.status < 400;
        } catch (fetchError) {
            clearTimeout(timeoutId);

            // If HEAD fails, it might be blocked - try GET as fallback
            // (some servers don't support HEAD)
            const getController = new AbortController();
            const getTimeoutId = setTimeout(
                () => getController.abort(),
                timeoutMs / 2
            ); // Use shorter timeout for fallback

            try {
                const getResponse = await fetch(probeUrl, {
                    method: 'GET',
                    signal: getController.signal,
                    redirect: 'manual',
                });

                clearTimeout(getTimeoutId);
                return getResponse.status >= 200 && getResponse.status < 400;
            } catch (getError) {
                clearTimeout(getTimeoutId);
                return false;
            }
        }
    } catch (error) {
        // URL parsing or other errors
        console.warn('[videoProbe] Probe failed:', error);
        return false;
    }
}

/**
 * Calculate exponential backoff delay
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay cap (default: 8000)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
    attempt: number,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 8000
): number {
    const delay = baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, maxDelayMs);
}
