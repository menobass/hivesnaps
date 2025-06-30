import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Video } from 'expo-av';

interface Mp4VideoPlayerProps {
  uri: string;
  isDark?: boolean;
}

const Mp4VideoPlayer: React.FC<Mp4VideoPlayerProps> = ({ uri, isDark }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  return (
    <View style={styles.container}>
      {loading && !error && (
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#222'} style={StyleSheet.absoluteFill} />
      )}
      {error ? (
        <View style={[styles.error, { backgroundColor: isDark ? '#222' : '#eee' }]}> 
          <Video
            source={{ uri }}
            style={{ display: 'none' }}
          />
        </View>
      ) : (
        <Video
          source={{ uri }}
          style={styles.video}
          useNativeControls
          resizeMode={"contain" as any}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => setError(true)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginVertical: 10,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
});

export default Mp4VideoPlayer;
