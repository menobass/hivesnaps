import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { WebView } from 'react-native-webview';

interface YouTubeEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ embedUrl, isDark }) => {
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <WebView
        source={{ uri: embedUrl }}
        style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={true}
        onShouldStartLoadWithRequest={request => {
          // Allow YouTube URLs, block others
          return (
            request.url.includes('youtube.com') ||
            request.url.includes('youtu.be') ||
            request.url.includes('google.com')
          );
        }}
      />
      {/* YouTube type indicator */}
      <View
        style={[styles.indicator, { backgroundColor: 'rgba(255,0,0,0.8)' }]}
      >
        <Text style={[styles.indicatorText, { color: '#fff' }]}>YOUTUBE</Text>
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

export default YouTubeEmbed;
