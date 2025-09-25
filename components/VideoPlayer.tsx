import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VideoPlayerProps {
  url: string;
  thumbnail?: string;
  style?: object;
}

/**
 * VideoPlayer - A reusable video component that can play videos from both S3 and IPFS URLs
 * 
 * This component handles:
 * - S3 presigned URLs (temporary redirects)
 * - IPFS URLs (permanent decentralized storage)
 * - Loading states and error handling
 * - Mobile-optimized UI with SafeAreaView
 * 
 * @param url - The video URL (S3 or IPFS)
 * @param thumbnail - Optional thumbnail image URI
 * @param style - Additional styling for the container
 */
const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, thumbnail, style }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = (errorEvent: any) => {
    setLoading(false);
    setError(true);
    console.warn('VideoPlayer error:', errorEvent);
  };

  return (
    <View style={[styles.container, style, { paddingBottom: insets.bottom }]}>
      {loading && !error && (
        <ActivityIndicator size="large" color="#1DA1F2" style={styles.loader} />
      )}
      
      <Video
        source={{ uri: url }}
        posterSource={thumbnail ? { uri: thumbnail } : undefined}
        usePoster={!!thumbnail}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isLooping={false}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={handleError}
        useNativeControls
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loader: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1,
  },
});

export default VideoPlayer;
