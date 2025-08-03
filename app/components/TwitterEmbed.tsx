import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface TwitterEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

// Cache for Twitter embed HTML
const twitterEmbedCache = new Map<string, string>();

const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ embedUrl, isDark }) => {
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCentered, setIsCentered] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('TwitterEmbed message received:', data);

      switch (data.type) {
        case 'twitter-loaded':
          setIsLoaded(true);
          // Send centering command
          sendCenteringCommand();
          break;
        case 'centering-complete':
          setIsCentered(true);
          // Cache the centered HTML if needed
          if (data.html) {
            twitterEmbedCache.set(embedUrl, data.html);
          }
          break;
        case 'error':
          console.warn('TwitterEmbed error:', data.message);
          break;
      }
    } catch (e) {
      console.warn('Failed to parse TwitterEmbed message:', e);
    }
  };

  const sendCenteringCommand = () => {
    // Send a safe command to center content without DOM manipulation
    const safeCenteringScript = `
      (function() {
        try {
          // Use CSS-only centering approach
          const style = document.createElement('style');
          style.textContent = \`
            body {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              min-height: 100vh !important;
              margin: 0 !important;
              padding: 0 !important;
              text-align: center !important;
            }
            iframe {
              margin: 0 auto !important;
              display: block !important;
              max-width: 100% !important;
            }
            .twitter-tweet, [data-testid="tweet"] {
              margin: 0 auto !important;
              display: block !important;
              text-align: center !important;
            }
          \`;
          document.head.appendChild(style);
          
          // Notify React Native that centering is complete
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'centering-complete',
            success: true
          }));
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: 'Centering failed: ' + error.message
          }));
        }
      })();
      true;
    `;

    webViewRef.current?.injectJavaScript(safeCenteringScript);
  };

  const handleTap = () => {
    // Extract the tweet ID from the embed URL
    const tweetIdMatch = embedUrl.match(/id=(\d+)/);
    if (tweetIdMatch) {
      const tweetId = tweetIdMatch[1];
      const tweetUrl = `https://twitter.com/i/status/${tweetId}`;

      // Try to open in Twitter app first, then browser
      Linking.openURL(tweetUrl).catch(() => {
        // Fallback to browser if Twitter app is not installed
        Linking.openURL(tweetUrl);
      });
    }
  };

  // Check if we have cached HTML
  const cachedHtml = twitterEmbedCache.get(embedUrl);

  if (cachedHtml && isCentered) {
    // Use cached HTML to avoid reloading
    return (
      <Pressable onPress={handleTap} style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: cachedHtml }}
          style={styles.webView}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={true}
          allowsInlineMediaPlayback={true}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={request => {
            // Block all navigation when using cached HTML
            return false;
          }}
        />
        {/* Twitter type indicator */}
        <View
          style={[styles.indicator, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
        >
          <Text style={[styles.indicatorText, { color: '#fff' }]}>𝕏</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handleTap} style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: embedUrl }}
        style={styles.webView}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={true}
        onMessage={handleMessage}
        onLoadEnd={() => {
          // Send message to notify that Twitter embed has loaded
          webViewRef.current?.injectJavaScript(`
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'twitter-loaded',
              url: '${embedUrl}'
            }));
            true;
          `);
        }}
        onShouldStartLoadWithRequest={request => {
          // Allow the initial embed URL to load
          if (request.url === embedUrl) {
            return true;
          }
          // Block all other navigation to prevent login prompts
          return false;
        }}
      />
      {/* Twitter type indicator */}
      <View style={[styles.indicator, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <Text style={[styles.indicatorText, { color: '#fff' }]}>𝕏</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
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
});

export default TwitterEmbed;
