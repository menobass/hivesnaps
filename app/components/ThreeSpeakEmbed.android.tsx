import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface ThreeSpeakEmbedProps {
    embedUrl: string;
    isDark?: boolean;
}

// Video aspect ratio constant - 1:1 square for better preview on vertical screens
// Works well for both vertical and horizontal videos since playback is fullscreen
const VIDEO_ASPECT_RATIO = 1;

// Border radius for video container
const CONTAINER_BORDER_RADIUS = 12;

const ThreeSpeakEmbed: React.FC<ThreeSpeakEmbedProps> = ({
    embedUrl,
    isDark,
}) => {
    console.log('🎬 [ThreeSpeakEmbed.android.tsx] Android-SPECIFIC version loaded');
    const colorScheme = useColorScheme();
    const themeIsDark = isDark ?? colorScheme === 'dark';
    const { width } = useWindowDimensions();
    const webViewRef = useRef<WebView>(null);
    const [showPlayButton, setShowPlayButton] = useState(false);
    const hasPlayedOnce = useRef(false);

    // Calculate responsive height based on screen width (1:1 square)
    // Assumes some padding/margins in the parent container
    const containerWidth = width - 32; // Account for horizontal padding
    const videoHeight = containerWidth; // Square aspect ratio

    // Handle overlay tap - re-enter fullscreen or play if paused
    const handleOverlayPress = () => {
        setShowPlayButton(false);
        // Inject JS to request fullscreen (and play if paused)
        webViewRef.current?.injectJavaScript(`
            (function() {
                const video = document.querySelector('video');
                if (video) {
                    // If paused, play first
                    if (video.paused) {
                        video.play();
                    }
                    // Request fullscreen
                    setTimeout(() => {
                        if (video.requestFullscreen) {
                            video.requestFullscreen();
                        } else if (video.webkitRequestFullscreen) {
                            video.webkitRequestFullscreen();
                        } else if (video.mozRequestFullScreen) {
                            video.mozRequestFullScreen();
                        }
                    }, 100);
                }
            })();
            true;
        `);
    };

    // JavaScript to auto-trigger fullscreen when video plays on Android
    const injectedJavaScript = `
        (function() {
            const processedVideos = new WeakSet(); // Track videos that already have listeners
            
            // Function to attempt fullscreen on a video element
            function requestFullscreen(video) {
                if (!video) return false;
                
                try {
                    // Standard fullscreen APIs for Android
                    if (video.requestFullscreen) {
                        video.requestFullscreen();
                        return true;
                    } else if (video.webkitRequestFullscreen) {
                        video.webkitRequestFullscreen();
                        return true;
                    } else if (video.mozRequestFullScreen) {
                        video.mozRequestFullScreen();
                        return true;
                    }
                } catch (e) {
                    console.log('Fullscreen request failed:', e);
                }
                return false;
            }
            
            // Notify React Native when video exits fullscreen
            function setupFullscreenExitDetection(video) {
                if (!video) return;
                
                // Standard fullscreen change events
                document.addEventListener('fullscreenchange', () => {
                    if (!document.fullscreenElement) {
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'fullscreen-exit',
                            paused: video.paused
                        }));
                    }
                });
                
                document.addEventListener('webkitfullscreenchange', () => {
                    if (!document.webkitFullscreenElement) {
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                            type: 'fullscreen-exit',
                            paused: video.paused
                        }));
                    }
                });
            }
            
            // Attach listeners to a video element (only once per video)
            function attachVideoListeners(video) {
                if (!video || processedVideos.has(video)) {
                    return; // Already processed this video
                }
                
                processedVideos.add(video);
                setupFullscreenExitDetection(video);
                
                let isFirstPlay = true;
                video.addEventListener('play', () => {
                    if (isFirstPlay) {
                        isFirstPlay = false;
                        // Wait for video to be properly rendered before fullscreen
                        setTimeout(() => {
                            // Double-check video has dimensions before going fullscreen
                            if (video.videoWidth > 0 && video.videoHeight > 0) {
                                requestFullscreen(video);
                            } else {
                                // If dimensions not ready, wait a bit more
                                setTimeout(() => requestFullscreen(video), 200);
                            }
                        }, 300);
                    }
                });
            }
            
            // Check for video in main document
            function checkMainVideo() {
                const video = document.querySelector('video');
                if (video) {
                    attachVideoListeners(video);
                    return video.videoWidth > 0 && video.videoHeight > 0;
                }
                return false;
            }
            
            // Check for video in iframes (3Speak may use iframe-based player)
            function checkIframeVideos() {
                const iframes = document.querySelectorAll('iframe');
                let foundWithDimensions = false;
                
                iframes.forEach((iframe) => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            const video = iframeDoc.querySelector('video');
                            if (video) {
                                attachVideoListeners(video);
                                if (video.videoWidth > 0 && video.videoHeight > 0) {
                                    foundWithDimensions = true;
                                }
                            }
                        }
                    } catch (e) {
                        // Cross-origin iframe - cannot access
                    }
                });
                
                return foundWithDimensions;
            }
            
            // Poll for video elements with timeout protection
            let checks = 0;
            const maxChecks = 50; // 5 seconds max at 100ms interval
            const checkVideo = setInterval(() => {
                const mainReady = checkMainVideo();
                const iframeReady = checkIframeVideos();
                
                // Stop polling when video is found AND has dimensions, or timeout
                if ((mainReady || iframeReady) || ++checks >= maxChecks) {
                    clearInterval(checkVideo);
                }
            }, 100);
        })();
        true;
    `;

    return (
        <View
            style={{
                width: '100%',
                height: videoHeight,
                borderRadius: CONTAINER_BORDER_RADIUS,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <WebView
                ref={webViewRef}
                source={{ uri: embedUrl }}
                style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="compatibility"
                injectedJavaScript={injectedJavaScript}
                mediaPlaybackRequiresUserAction={false}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'fullscreen-exit') {
                            hasPlayedOnce.current = true;
                            // Always show overlay after exiting fullscreen to allow re-entering
                            setShowPlayButton(true);
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }}
                onShouldStartLoadWithRequest={request => {
                    // Allow 3Speak URLs (legacy and new play subdomain), block others
                    return (
                        request.url.includes('3speak.tv') ||
                        request.url.includes('3speak.online') ||
                        request.url.includes('play.3speak.tv')
                    );
                }}
            />
            {/* Overlay after exiting fullscreen - tap to re-enter fullscreen */}
            {showPlayButton && (
                <TouchableOpacity
                    style={styles.playButtonOverlay}
                    onPress={handleOverlayPress}
                    activeOpacity={0.8}
                >
                    <View style={styles.playButtonContainer}>
                        <Ionicons name="play-circle" size={80} color="rgba(255,255,255,0.9)" />
                    </View>
                </TouchableOpacity>
            )}
            {/* 3Speak type indicator */}
            <View
                style={[styles.indicator, { backgroundColor: 'rgba(0,123,255,0.8)' }]}
            >
                <Text style={[styles.indicatorText, { color: '#fff' }]}>3SPEAK</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    indicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    indicatorText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    playButtonOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playButtonContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ThreeSpeakEmbed;
