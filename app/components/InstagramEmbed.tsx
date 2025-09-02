import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  embedUrl: string; // e.g., https://www.instagram.com/p/{shortcode}/embed
  isDark: boolean;
}

const InstagramEmbed: React.FC<Props> = ({ embedUrl }) => {
  // Instagram requires embed endpoint; content is interactive but we block autoplay
  return (
    <View style={{ width: '100%', aspectRatio: 1, marginVertical: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' }}>
      <WebView
        source={{ uri: embedUrl }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback
        startInLoadingState
      />
    </View>
  );
};

export default InstagramEmbed;
