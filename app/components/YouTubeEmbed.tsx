import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { WebView } from 'react-native-webview';

interface YouTubeEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

// Container height for mobile YouTube watch page
// This fixed height shows the video player while hiding comments and related videos below
const YOUTUBE_CONTAINER_HEIGHT = 384;

// Border radius for video container
const CONTAINER_BORDER_RADIUS = 12;

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ embedUrl, isDark }) => {
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';

  // Extract video ID from various YouTube URL formats
  const getVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(embedUrl);
  
  if (__DEV__) {
    console.log('[YouTubeEmbed] Processing URL:', embedUrl);
    console.log('[YouTubeEmbed] Extracted videoId:', videoId);
  }

  if (!videoId) {
    if (__DEV__) {
      console.log('[YouTubeEmbed] ERROR: Invalid video ID');
    }
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: themeIsDark ? '#333' : '#f0f0f0' },
        ]}
      >
        <Text
          style={[styles.errorText, { color: themeIsDark ? '#fff' : '#000' }]}
        >
          Invalid YouTube URL
        </Text>
      </View>
    );
  }

  // Use mobile YouTube watch page directly (no embed, avoids Error 153)
  const mobileWatchUrl = `https://m.youtube.com/watch?v=${videoId}`;
  
  if (__DEV__) {
    console.log('[YouTubeEmbed] Loading mobile YouTube:', mobileWatchUrl);
  }

  return (
    <View
      style={{
        width: '100%',
        height: YOUTUBE_CONTAINER_HEIGHT,
        borderRadius: CONTAINER_BORDER_RADIUS,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
      }}
    >
      <WebView
        source={{ uri: mobileWatchUrl }}
        style={{ flex: 1, backgroundColor: '#000' }}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={true}
        startInLoadingState={true}
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
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
  errorContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: CONTAINER_BORDER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default YouTubeEmbed;
