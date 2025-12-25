import React from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions, Platform } from 'react-native';
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
  // Enhanced to handle both direct video elements and iframes (3Speak player architecture)
  const injectedJavaScript = `
    (function() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Function to attempt fullscreen on a video element
      function requestFullscreen(video) {
        if (!video) return false;
        
        try {
          // iOS-specific: webkitEnterFullscreen is the reliable method for iOS
          if (isIOS && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
            return true;
          }
          
          // Standard fullscreen APIs (for Android and other platforms)
          if (video.requestFullscreen) {
            video.requestFullscreen();
            return true;
          } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
            return true;
          } else if (video.mozRequestFullScreen) {
            video.mozRequestFullScreen();
            return true;
          } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
            return true;
          }
        } catch (e) {
          console.log('Fullscreen request failed:', e);
        }
        return false;
      }
      
      // Check for video in main document
      function checkMainVideo() {
        const video = document.querySelector('video');
        if (video) {
          video.addEventListener('play', () => {
            setTimeout(() => requestFullscreen(video), 100);
          });
          return true;
        }
        return false;
      }
      
      // Check for video in iframes (3Speak may use iframe-based player)
      function checkIframeVideos() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          try {
            // Try to access iframe content (will fail for cross-origin)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const video = iframeDoc.querySelector('video');
              if (video) {
                video.addEventListener('play', () => {
                  setTimeout(() => requestFullscreen(video), 100);
                });
              }
            }
          } catch (e) {
            // Cross-origin iframe - cannot access
            // For iOS, the native fullscreen should still work via allowsFullscreenVideo
          }
        });
      }
      
      // Poll for video elements with timeout protection
      let checks = 0;
      const maxChecks = 50; // 5 seconds max at 100ms interval
      const checkVideo = setInterval(() => {
        const foundMain = checkMainVideo();
        checkIframeVideos();
        
        if (foundMain || ++checks >= maxChecks) {
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
        source={{ uri: embedUrl }}
        style={{ flex: 1, backgroundColor: themeIsDark ? '#000' : '#fff' }}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={injectedJavaScript}
        // iOS: Remove mediaPlaybackRequiresUserAction to allow programmatic fullscreen
        // iOS: Set allowsInlineMediaPlayback to false to force native fullscreen
        mediaPlaybackRequiresUserAction={Platform.OS === 'ios' ? false : true}
        allowsInlineMediaPlayback={Platform.OS === 'ios' ? false : true}
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
