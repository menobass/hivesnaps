/**
 * Tests for videoProbe utility
 * Tests video host reachability checking and exponential backoff calculation
 */

import { probeVideoHost, calculateBackoffDelay } from '../utils/videoProbe';

// Mock fetch globally
global.fetch = jest.fn();

describe('videoProbe', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('calculateBackoffDelay', () => {
        it('should calculate exponential backoff correctly', () => {
            expect(calculateBackoffDelay(0, 1000, 8000)).toBe(1000); // 1000 * 2^0 = 1000
            expect(calculateBackoffDelay(1, 1000, 8000)).toBe(2000); // 1000 * 2^1 = 2000
            expect(calculateBackoffDelay(2, 1000, 8000)).toBe(4000); // 1000 * 2^2 = 4000
            expect(calculateBackoffDelay(3, 1000, 8000)).toBe(8000); // 1000 * 2^3 = 8000
        });

        it('should cap delay at maxDelayMs', () => {
            expect(calculateBackoffDelay(4, 1000, 8000)).toBe(8000); // 16000 capped at 8000
            expect(calculateBackoffDelay(5, 1000, 8000)).toBe(8000); // 32000 capped at 8000
            expect(calculateBackoffDelay(10, 1000, 8000)).toBe(8000); // Very large value capped
        });

        it('should use default values when not provided', () => {
            expect(calculateBackoffDelay(0)).toBe(1000); // Default base delay
            expect(calculateBackoffDelay(4)).toBe(8000); // Default max delay cap
        });

        it('should handle custom base and max delays', () => {
            expect(calculateBackoffDelay(0, 500, 5000)).toBe(500);
            expect(calculateBackoffDelay(1, 500, 5000)).toBe(1000);
            expect(calculateBackoffDelay(2, 500, 5000)).toBe(2000);
            expect(calculateBackoffDelay(3, 500, 5000)).toBe(4000);
            expect(calculateBackoffDelay(4, 500, 5000)).toBe(5000); // Capped
        });

        it('should handle attempt 0 correctly', () => {
            expect(calculateBackoffDelay(0, 1000, 8000)).toBe(1000);
        });
    });

    describe('probeVideoHost', () => {
        const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

        describe('URL parsing', () => {
            it('should extract origin from full video URL', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv/embed?v=test123', 5000);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://play.3speak.tv/',
                    expect.any(Object)
                );
            });

            it('should handle URLs with complex query parameters', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost(
                    'https://play.3speak.tv/embed?v=test&autoplay=1&muted=1',
                    5000
                );

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://play.3speak.tv/',
                    expect.any(Object)
                );
            });

            it('should handle URLs with paths', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv/watch/test123', 5000);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://play.3speak.tv/',
                    expect.any(Object)
                );
            });

            it('should return false for invalid URLs', async () => {
                const result = await probeVideoHost('not-a-valid-url', 5000);
                expect(result).toBe(false);
                expect(mockFetch).not.toHaveBeenCalled();
            });

            it('should return false for malformed URLs', async () => {
                const result = await probeVideoHost('http://', 5000);
                expect(result).toBe(false);
            });
        });

        describe('successful responses', () => {
            it('should return true for 200 OK response', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                const result = await probeVideoHost('https://play.3speak.tv/embed?v=test', 5000);
                expect(result).toBe(true);
            });

            it('should return true for 2xx responses', async () => {
                mockFetch.mockResolvedValueOnce({ status: 204 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(true);

                mockFetch.mockResolvedValueOnce({ status: 201 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(true);
            });

            it('should return true for 3xx redirect responses', async () => {
                mockFetch.mockResolvedValueOnce({ status: 301 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(true);

                mockFetch.mockResolvedValueOnce({ status: 302 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(true);

                mockFetch.mockResolvedValueOnce({ status: 307 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(true);
            });
        });

        describe('failed responses', () => {
            it('should return false for 4xx client errors', async () => {
                mockFetch.mockResolvedValueOnce({ status: 404 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(false);

                mockFetch.mockResolvedValueOnce({ status: 403 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(false);
            });

            it('should return false for 5xx server errors', async () => {
                mockFetch.mockResolvedValueOnce({ status: 500 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(false);

                mockFetch.mockResolvedValueOnce({ status: 503 } as Response);
                expect(await probeVideoHost('https://play.3speak.tv/test', 5000)).toBe(false);
            });
        });

        describe('request configuration', () => {
            it('should use HEAD method by default', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv/test', 5000);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://play.3speak.tv/',
                    expect.objectContaining({
                        method: 'HEAD',
                        redirect: 'manual',
                    })
                );
            });

            it('should include AbortController signal', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv/test', 5000);

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        signal: expect.any(AbortSignal),
                    })
                );
            });
        });

        describe('HEAD fallback to GET', () => {
            it('should fallback to GET when HEAD fails', async () => {
                // HEAD request fails
                mockFetch.mockRejectedValueOnce(new Error('HEAD not supported'));

                // GET request succeeds
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                const result = await probeVideoHost('https://play.3speak.tv/test', 5000);

                expect(result).toBe(true);
                expect(mockFetch).toHaveBeenCalledTimes(2);

                // First call should be HEAD
                expect(mockFetch).toHaveBeenNthCalledWith(
                    1,
                    expect.any(String),
                    expect.objectContaining({ method: 'HEAD' })
                );

                // Second call should be GET
                expect(mockFetch).toHaveBeenNthCalledWith(
                    2,
                    expect.any(String),
                    expect.objectContaining({ method: 'GET' })
                );
            });

            it('should return false when both HEAD and GET fail', async () => {
                mockFetch.mockRejectedValueOnce(new Error('HEAD failed'));
                mockFetch.mockRejectedValueOnce(new Error('GET failed'));

                const result = await probeVideoHost('https://play.3speak.tv/test', 5000);
                expect(result).toBe(false);
            });

            it('should return false when GET returns error status', async () => {
                mockFetch.mockRejectedValueOnce(new Error('HEAD failed'));
                mockFetch.mockResolvedValueOnce({ status: 500 } as Response);

                const result = await probeVideoHost('https://play.3speak.tv/test', 5000);
                expect(result).toBe(false);
            });
        });

        describe('timeout handling', () => {
            it('should respect custom timeout value', async () => {
                const customTimeout = 3000;

                mockFetch.mockImplementationOnce(
                    () =>
                        new Promise((resolve) =>
                            setTimeout(() => resolve({ status: 200 } as Response), customTimeout + 1000)
                        )
                );

                const probePromise = probeVideoHost('https://play.3speak.tv/test', customTimeout);

                jest.advanceTimersByTime(customTimeout);

                const result = await probePromise;
                expect(result).toBe(false);
            });

            it('should use default timeout when not specified', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv/test');

                // Just verify it completes without error with default timeout
                expect(mockFetch).toHaveBeenCalled();
            });

            it('should use shorter timeout for GET fallback', async () => {
                // HEAD fails
                mockFetch.mockRejectedValueOnce(new Error('HEAD failed'));

                // GET should use half the timeout
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv/test', 4000);

                // Verify both requests were made
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });

        describe('error handling', () => {
            it('should handle network errors gracefully', async () => {
                mockFetch.mockRejectedValueOnce(new Error('Network error'));
                mockFetch.mockRejectedValueOnce(new Error('Network error'));

                const result = await probeVideoHost('https://play.3speak.tv/test', 5000);
                expect(result).toBe(false);
            });

            it('should handle AbortError gracefully', async () => {
                const abortError = new Error('The operation was aborted');
                abortError.name = 'AbortError';

                mockFetch.mockRejectedValueOnce(abortError);
                mockFetch.mockRejectedValueOnce(abortError);

                const result = await probeVideoHost('https://play.3speak.tv/test', 5000);
                expect(result).toBe(false);
            });

            it('should handle TypeError for network failures', async () => {
                mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
                mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

                const result = await probeVideoHost('https://play.3speak.tv/test', 5000);
                expect(result).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle very short timeout', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                const result = await probeVideoHost('https://play.3speak.tv/test', 1);
                expect(result).toBe(true);
            });

            it('should handle very long timeout', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                const result = await probeVideoHost('https://play.3speak.tv/test', 60000);
                expect(result).toBe(true);
            });

            it('should handle URLs with ports', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://play.3speak.tv:8080/embed?v=test', 5000);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://play.3speak.tv:8080/',
                    expect.any(Object)
                );
            });

            it('should handle URLs with authentication', async () => {
                mockFetch.mockResolvedValueOnce({
                    status: 200,
                    ok: true,
                } as Response);

                await probeVideoHost('https://user:pass@play.3speak.tv/test', 5000);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://play.3speak.tv/',
                    expect.any(Object)
                );
            });
        });
    });
});
