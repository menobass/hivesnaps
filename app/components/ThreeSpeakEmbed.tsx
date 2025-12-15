import React from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

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
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';
  const { width } = useWindowDimensions();
  
  // Calculate responsive height based on screen width (1:1 square)
  // Assumes some padding/margins in the parent container
  const containerWidth = width - 32; // Account for horizontal padding
  const videoHeight = containerWidth; // Square aspect ratio

  // JavaScript to auto-trigger fullscreen when video plays
  const injectedJavaScript = `
    (function() {
      // Wait for video element to be ready with timeout protection
      let checks = 0;
      const maxChecks = 50; // 5 seconds max at 100ms interval
      const checkVideo = setInterval(() => {
        const video = document.querySelector('video');
        if (video || ++checks >= maxChecks) {
          clearInterval(checkVideo);
          if (video) {
            // Listen for play event
            video.addEventListener('play', () => {
              setTimeout(() => {
                if (video.requestFullscreen) {
                  video.requestFullscreen();
                } else if (video.webkitRequestFullscreen) {
                  video.webkitRequestFullscreen();
                } else if (video.mozRequestFullScreen) {
                  video.mozRequestFullScreen();
                } else if (video.msRequestFullscreen) {
                  video.msRequestFullscreen();
                } else if (video.webkitEnterFullscreen) {
                  video.webkitEnterFullscreen();
                }
              }, 100);
            });
          }
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
        source={{ uri: embedUrl }}
        style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={injectedJavaScript}
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={true}
        onShouldStartLoadWithRequest={request => {
          // Allow 3Speak URLs (legacy and new play subdomain), block others
          return (
            request.url.includes('3speak.tv') ||
            request.url.includes('3speak.online') ||
            request.url.includes('play.3speak.tv')
          );
        }}
      />
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
});

export default ThreeSpeakEmbed;
