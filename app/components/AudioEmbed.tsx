/**
 * Audio Embed Component
 * Displays 3Speak audio player in minimal mode using WebView
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface AudioEmbedProps {
  embedUrl: string;
  isDark?: boolean;
}

// Minimal mode height for audio player
const AUDIO_PLAYER_HEIGHT = 80;

const AudioEmbed: React.FC<AudioEmbedProps> = ({ embedUrl, isDark }) => {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: embedUrl }}
        style={styles.webview}
        scrollEnabled={false}
        scalesPageToFit={false}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={`
          document.body.style.margin = '0';
          document.body.style.padding = '0';
          document.documentElement.style.margin = '0';
          document.documentElement.style.padding = '0';
          true;
        `}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: AUDIO_PLAYER_HEIGHT,
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default AudioEmbed;
