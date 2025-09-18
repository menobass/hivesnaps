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

  // Extract video ID from various YouTube URL formats
  const getVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(embedUrl);

  if (!videoId) {
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

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: ${themeIsDark ? '#000' : '#fff'};
          }
          .video-container {
            position: relative;
            width: 100%;
            height: 100vh;
          }
          iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="video-container">
          <iframe
            src="https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0&modestbranding=1&playsinline=1"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>
      </body>
    </html>
  `;

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
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        startInLoadingState={true}
        originWhitelist={['*']}
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default YouTubeEmbed;
