/**
 * Video Host Probe Hook
 * 
 * Manages video host reachability checking with automatic retry logic.
 * Handles state, exponential backoff, and network connectivity changes.
 * 
 * Business logic for probing video hosts before loading heavy WebView embeds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { probeVideoHost, calculateBackoffDelay } from '../utils/videoProbe';

export type ProbeStatus = 'idle' | 'probing' | 'retrying' | 'ready' | 'failed';

export interface VideoHostProbeState {
    status: ProbeStatus;
    isReady: boolean;
    attempt: number;
    error: string | null;
    lastProbeTime: number | null;
}

export interface UseVideoHostProbeResult extends VideoHostProbeState {
    retry: () => void;
}

interface UseVideoHostProbeOptions {
    enabled?: boolean;
    maxAttempts?: number;
    probeTimeoutMs?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}

/**
 * Hook to probe video host reachability with automatic retry
 * 
 * @param url - The video embed URL to probe
 * @param options - Configuration options
 * @returns State object with status, retry function, and metadata
 */
export function useVideoHostProbe(
    url: string,
    options: UseVideoHostProbeOptions = {}
): UseVideoHostProbeResult {
    const {
        enabled = true,
        maxAttempts = 3,
        probeTimeoutMs = 5000,
        baseDelayMs = 1000,
        maxDelayMs = 8000,
    } = options;

    const [state, setState] = useState<VideoHostProbeState>({
        status: 'idle',
        isReady: false,
        attempt: 0,
        error: null,
        lastProbeTime: null,
    });

    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    /**
     * Perform a single probe attempt
     */
    const probe = useCallback(
        async (attemptNumber: number) => {
            if (!isMountedRef.current) return;

            // Update status based on attempt number
            setState((prev) => ({
                ...prev,
                status: attemptNumber === 0 ? 'probing' : 'retrying',
                attempt: attemptNumber,
                lastProbeTime: Date.now(),
            }));

            const success = await probeVideoHost(url, probeTimeoutMs);

            if (!isMountedRef.current) return;

            if (success) {
                // Probe succeeded - ready to load video
                setState({
                    status: 'ready',
                    isReady: true,
                    attempt: attemptNumber,
                    error: null,
                    lastProbeTime: Date.now(),
                });
            } else {
                // Probe failed - check if we should retry
                if (attemptNumber < maxAttempts - 1) {
                    // Schedule next retry with exponential backoff
                    const delay = calculateBackoffDelay(attemptNumber, baseDelayMs, maxDelayMs);

                    retryTimeoutRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            probe(attemptNumber + 1);
                        }
                    }, delay);

                    setState((prev) => ({
                        ...prev,
                        status: 'retrying',
                        attempt: attemptNumber,
                        error: `Retrying in ${Math.ceil(delay / 1000)}s...`,
                        lastProbeTime: Date.now(),
                    }));
                } else {
                    // Max attempts reached - mark as failed
                    setState({
                        status: 'failed',
                        isReady: false,
                        attempt: attemptNumber,
                        error: 'Unable to connect to video server',
                        lastProbeTime: Date.now(),
                    });
                }
            }
        },
        [url, probeTimeoutMs, maxAttempts, baseDelayMs, maxDelayMs]
    );

    /**
     * Manual retry function (can be called from UI)
     */
    const retry = useCallback(() => {
        // Clear any pending retry timeout
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }

        // Start fresh probe sequence
        probe(0);
    }, [probe]);

    /**
     * Start probing on mount or when URL changes
     */
    useEffect(() => {
        if (!enabled || !url) return;

        // Start initial probe
        probe(0);

        // Cleanup function
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, [url, enabled, probe]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    return {
        ...state,
        retry,
    };
}
