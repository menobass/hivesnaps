import React from 'react';
import { TouchableOpacity, ActivityIndicator, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface VideoUploadButtonProps {
  onPress: () => void;
  video: string | null;
  videoUploading: boolean;
  disabled?: boolean;
  colors: {
    inputBg: string;
    button: string;
    info: string;
  };
  style?: ViewStyle;
}

/**
 * VideoUploadButton - A reusable button for picking/uploading a video.
 *
 * Props:
 * - onPress: function to call when button is pressed
 * - video: selected video URI (if any)
 * - videoUploading: whether a video is being uploaded
 * - disabled: disables the button
 * - colors: color palette for styling
 * - style: optional style for the button container
 */
const VideoUploadButton: React.FC<VideoUploadButtonProps> = ({
  onPress,
  video,
  videoUploading,
  disabled,
  colors,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: colors.inputBg, marginLeft: 12 },
        style,
      ]}
      onPress={onPress}
      disabled={!!video || videoUploading || disabled}
    >
      {videoUploading ? (
        <ActivityIndicator size='small' color={colors.button} />
      ) : (
        <FontAwesome
          name='video-camera'
          size={20}
          color={video ? colors.info : colors.button}
        />
      )}
      {video && (
        <View style={[styles.imageBadge, { backgroundColor: colors.button }]}> 
          <Text style={styles.imageBadgeText}>1</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  imageBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default VideoUploadButton;
