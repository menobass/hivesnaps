import React from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Linking } from 'react-native';
import { WebView } from 'react-native-webview';

interface TwitterEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ embedUrl, isDark }) => {
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? (colorScheme === 'dark');

  const handleMessage = (event: any) => {
    console.log('TwitterEmbed WebView message:', event.nativeEvent.data);
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

  return (
    <Pressable onPress={handleTap} style={styles.container}>
      <WebView
        source={{ uri: embedUrl }}
        style={styles.webView}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={true}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={(request) => {
          // Allow the initial embed URL to load
          if (request.url === embedUrl) {
            return true;
          }
          // Block all other navigation to prevent login prompts
          return false;
        }}
        injectedJavaScript={`
          // Try a completely different approach - inject a wrapper div
          setTimeout(() => {
            console.log('TwitterEmbed: Starting wrapper approach');
            
            // Create a wrapper div that centers everything
            const wrapper = document.createElement('div');
            wrapper.id = 'twitter-embed-wrapper';
            wrapper.style.cssText = 'display: flex !important; justify-content: center !important; align-items: center !important; width: 100% !important; height: 100vh !important; margin: 0 !important; padding: 0 !important;';
            
            // Move all body content into the wrapper
            const bodyContent = document.body.innerHTML;
            document.body.innerHTML = '';
            document.body.appendChild(wrapper);
            wrapper.innerHTML = bodyContent;
            
            // Also try to center any iframes specifically
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
              iframe.style.cssText = 'margin: 0 auto !important; display: block !important; max-width: 100% !important;';
            });
            
            // Send message back to React Native
            window.ReactNativeWebView.postMessage('TwitterEmbed: Wrapper centering complete');
            console.log('TwitterEmbed: Wrapper centering complete');
          }, 3000);
          true;
        `}
      />
      {/* Twitter type indicator */}
      <View style={[styles.indicator, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <Text style={[styles.indicatorText, { color: '#fff' }]}>
          𝕏
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16/9,
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