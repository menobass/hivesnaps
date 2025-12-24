import React from 'react';
import { View, Text, StyleSheet, useColorScheme, useWindowDimensions, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome } from '@expo/vector-icons';
import { useVideoHostProbe } from '../../hooks/useVideoHostProbe';

interface ThreeSpeakEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

// Video aspect ratio constant - 1:1 square for better preview on vertical screens
const VIDEO_ASPECT_RATIO = 1;

// Border radius for video container
const CONTAINER_BORDER_RADIUS = 12;

const ThreeSpeakEmbed: React.FC<ThreeSpeakEmbedProps> = ({
  embedUrl,
  isDark,
}) => {
  console.log('🎬 [ThreeSpeakEmbed.tsx] FALLBACK version loaded (should NOT be used on iOS!)');
  const colorScheme = useColorScheme();
  const themeIsDark = isDark ?? colorScheme === 'dark';
  const { width } = useWindowDimensions();

  // Probe video host reachability before loading WebView
  const { status, isReady, retry, error } = useVideoHostProbe(embedUrl);

  // Calculate responsive height based on screen width (1:1 square)
  // Assumes some padding/margins in the parent container
  const containerWidth = width - 32; // Account for horizontal padding
  const videoHeight = containerWidth; // Square aspect ratio

  // Handle opening video in external browser
  const handleOpenInBrowser = () => {
    Linking.openURL(embedUrl).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

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
      }}
    >
<<<<<<< HEAD
<WebView
  source={{ uri: embedUrl }}
  style={{ flex: 1 }}
  allowsFullscreenVideo={true}
  mediaPlaybackRequiresUserAction={false}
  javaScriptEnabled={true}
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
      )}

{/* Show placeholder while probing or retrying */ }
{
  (status === 'probing' || status === 'retrying') && (
    <View
      style={{
        flex: 1,
        backgroundColor: themeIsDark ? '#1a1a1a' : '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <ActivityIndicator size="large" color={themeIsDark ? '#fff' : '#007AFF'} />
      <Text
        style={{
          color: themeIsDark ? '#fff' : '#000',
          fontSize: 16,
          fontWeight: '600',
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        {status === 'probing' ? 'Connecting...' : 'Re-attempting connection'}
      </Text>
      <Text
        style={{
          color: themeIsDark ? '#aaa' : '#666',
          fontSize: 14,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        Temporary issue
      </Text>
      {error && (
        <Text
          style={{
            color: themeIsDark ? '#888' : '#999',
            fontSize: 12,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {error}
        </Text>
      )}
    </View>
  )
}

{/* Show error state with retry option */ }
{
  status === 'failed' && (
    <View
      style={{
        flex: 1,
        backgroundColor: themeIsDark ? '#1a1a1a' : '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <FontAwesome
        name="exclamation-circle"
        size={48}
        color={themeIsDark ? '#666' : '#999'}
      />
      <Text
        style={{
          color: themeIsDark ? '#fff' : '#000',
          fontSize: 16,
          fontWeight: '600',
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        Video unavailable
      </Text>
      <Text
        style={{
          color: themeIsDark ? '#aaa' : '#666',
          fontSize: 14,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        {error || 'Unable to connect to video server'}
      </Text>

      {/* Retry button */}
      <TouchableOpacity
        onPress={retry}
        style={{
          backgroundColor: '#007AFF',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
          marginTop: 20,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          Retry
        </Text>
      </TouchableOpacity>

      {/* Open in browser button */}
      <TouchableOpacity
        onPress={handleOpenInBrowser}
        style={{
          marginTop: 12,
        }}
      >
        <Text style={{ color: '#007AFF', fontSize: 14 }}>
          Open in browser
        </Text>
      </TouchableOpacity>
    </View>
  )
}

{/* 3Speak type indicator */ }
<View
  style={[styles.indicator, { backgroundColor: 'rgba(0,123,255,0.8)' }]}
>
  <Text style={[styles.indicatorText, { color: '#fff' }]}>3SPEAK</Text>
</View>
>>>>>>> 3fc4d55 (New Hook and util implemented to deal with issues connecting to 3speak's infra)
    </View >
  );
};

export default ThreeSpeakEmbed;
    </View >
  );
};

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
})