/**
 * Snapie Hive Post Renderer
 * 
 * WebView-based renderer for Hive blog posts using snapie.io
 * Provides consistent, fully-featured rendering for long-form content
 * 
 * IMPORTANT: This is ONLY for Hive blog posts, NOT for snaps!
 * Snaps continue to use the native Snap component.
 */

import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { buildSnapieUrl } from '../../utils/snapieUrlBuilder';

interface SnapieHivePostRendererProps {
    /** Hive username (without @) */
    author: string;
    /** Post permlink */
    permlink: string;
    /** Theme colors */
    colors: {
        background: string;
        text: string;
    };
    /** Callback when external link is clicked */
    onExternalLink?: (url: string) => void;
}

/**
 * Renders a Hive blog post using snapie.io WebView
 * Handles loading states and navigation
 */
const SnapieHivePostRenderer: React.FC<SnapieHivePostRendererProps> = ({
    author,
    permlink,
    colors,
    onExternalLink,
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const webViewRef = useRef<WebView>(null);

    // Build snapie.io URL for this post
    const snapieUrl = buildSnapieUrl(author, permlink);

    // Handle navigation state changes
    const handleNavigationStateChange = (navState: WebViewNavigation) => {
        const { url } = navState;

        // If user navigates away from the original post, handle as external link
        if (!url.includes(`/@${author}/${permlink}`) && onExternalLink) {
            onExternalLink(url);
            // Navigate back to original post
            if (webViewRef.current) {
                webViewRef.current.stopLoading();
                webViewRef.current.goBack();
            }
        }
    };

    // Inject CSS to customize appearance and match app theme
    const injectedCSS = `
    /* Hide snapie.io header/footer for clean embedded view */
    header, footer, .navbar, .site-header {
      display: none !important;
    }

    /* Match app theme colors */
    body {
      background-color: ${colors.background} !important;
      color: ${colors.text} !important;
    }

    /* Remove max-width for mobile optimization */
    .container, .content, main {
      max-width: 100% !important;
      padding: 16px !important;
    }

    /* Ensure images are responsive */
    img {
      max-width: 100% !important;
      height: auto !important;
    }

    /* Remove top padding/margin */
    body, main, .post-content {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
  `;

    const injectedJavaScript = `
    (function() {
      // Inject CSS
      const style = document.createElement('style');
      style.textContent = \`${injectedCSS}\`;
      document.head.appendChild(style);

      // Prevent opening links in new tabs
      document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href) {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'link',
            url: target.href
          }));
        }
      }, true);

      true; // Signal successful execution
    })();
  `;

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1DA1F2" />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        Loading post...
                    </Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.text }]}>
                        {error}
                    </Text>
                </View>
            )}

            <WebView
                ref={webViewRef}
                source={{ uri: snapieUrl }}
                style={styles.webView}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('[SnapieRenderer] WebView error:', nativeEvent);
                    setError('Failed to load post');
                    setLoading(false);
                }}
                onNavigationStateChange={handleNavigationStateChange}
                injectedJavaScript={injectedJavaScript}
                onMessage={(event) => {
                    try {
                        const message = JSON.parse(event.nativeEvent.data);
                        if (message.type === 'link' && message.url && onExternalLink) {
                            onExternalLink(message.url);
                        }
                    } catch (e) {
                        console.error('[SnapieRenderer] Error parsing message:', e);
                    }
                }}
                // Performance optimizations
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState={false}
                scalesPageToFit
                showsVerticalScrollIndicator
                bounces
                // Security
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                // Disable features we don't need
                allowsBackForwardNavigationGestures={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webView: {
        flex: 1,
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    errorContainer: {
        padding: 20,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
});

export default SnapieHivePostRenderer;
