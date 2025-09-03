import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  embedUrl: string; // e.g., https://www.instagram.com/p/{shortcode}/embed
  isDark?: boolean;
}

const InstagramEmbed: React.FC<Props> = ({ embedUrl, isDark }) => {
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 0.8, // Instagram's characteristic 4:5 ratio
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <WebView
        source={{ uri: embedUrl }}
        style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={true}
        startInLoadingState
        allowsFullscreenVideo
        onShouldStartLoadWithRequest={request => {
          // Allow only legitimate Instagram and related CDN URLs, block others for security
          try {
            const allowedHostnames = [
              'www.instagram.com',
              'instagram.com',
              'cdninstagram.com',
              'scontent.cdninstagram.com',
              'fbcdn.net',
              'www.fbcdn.net',
            ];
            const urlObj = new URL(request.url);
            return allowedHostnames.some(host => urlObj.hostname === host);
          } catch (e) {
            // If URL parsing fails, block the request
            return false;
          }
        }}
      />
      {/* Instagram type indicator */}
      <View
        style={[styles.indicator, { backgroundColor: 'rgba(225,48,108,0.8)' }]}
      >
        <Text style={[styles.indicatorText, { color: '#fff' }]}>INSTAGRAM</Text>
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
});

export default InstagramEmbed;
