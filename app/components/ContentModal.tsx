import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ContentModalMode = 'reply' | 'edit';

export interface ContentTarget {
  author: string;
  permlink: string;
  type?: 'snap' | 'reply';
}

interface ContentModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  mode: ContentModalMode;
  target: ContentTarget | null;
  text: string;
  onTextChange: (text: string) => void;
  images: string[]; // Changed from single image to array
  gifs: string[]; // Changed from single gif to array
  onImageRemove: (imageUrl: string) => void; // Now takes URL parameter
  onGifRemove: (gifUrl: string) => void; // Now takes URL parameter
  onAddImage: () => void;
  onAddGif: () => void;
  posting: boolean;
  uploading: boolean;
  processing: boolean;
  error: string | null;
  currentUsername: string | null;
  characterLimit?: number;
}

const DEFAULT_CHARACTER_LIMIT = 288;

const ContentModal: React.FC<ContentModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  mode,
  target,
  text,
  onTextChange,
  images,
  gifs,
  onImageRemove,
  onGifRemove,
  onAddImage,
  onAddGif,
  posting,
  uploading,
  processing,
  error,
  currentUsername,
  characterLimit = DEFAULT_CHARACTER_LIMIT,
}) => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const colors = {
    text: isDark ? '#fff' : '#000',
    background: isDark ? '#1a1a1a' : '#fff',
    bubble: isDark ? '#2a2a2a' : '#f0f0f0',
    icon: isDark ? '#8899A6' : '#666',
    primary: '#007AFF',
    error: '#FF3B30',
    disabled: isDark ? '#444' : '#ccc',
  };

  const isTextEmpty = !text.trim();
  const isOverLimit = text.length > characterLimit;
  const canSubmit =
    !isTextEmpty &&
    !isOverLimit &&
    !uploading &&
    !posting &&
    !processing &&
    currentUsername;

  const handleTextChange = (newText: string) => {
    if (newText.length <= characterLimit) {
      onTextChange(newText);
    }
  };

  const getTitle = () => {
    if (mode === 'reply') {
      return `Reply to ${target?.author}`;
    } else {
      return `Edit ${target?.type === 'reply' ? 'Reply' : 'Snap'}`;
    }
  };

  const getPlaceholder = () => {
    if (mode === 'reply') {
      return 'Write your reply...';
    } else {
      return `Edit your ${target?.type === 'reply' ? 'reply' : 'snap'}...`;
    }
  };

  const getSubmitButtonText = () => {
    if (posting) {
      return mode === 'reply' ? 'Posting...' : 'Saving...';
    } else if (processing) {
      return 'Checking...';
    } else {
      return mode === 'reply' ? 'Send' : 'Save';
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={posting ? undefined : onClose}
      onBackButtonPress={posting ? undefined : onClose}
      style={{
        justifyContent: 'flex-end',
        margin: 0,
        ...(Platform.OS === 'ios' && {
          paddingBottom: insets.bottom,
        }),
      }}
      useNativeDriver
      avoidKeyboard={true}
    >
      <View
        style={{
          backgroundColor: colors.background,
          padding: 16,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontWeight: 'bold',
            fontSize: 16,
            marginBottom: 12,
          }}
        >
          {getTitle()}
        </Text>

        {/* Images preview - Horizontal scrollable list */}
        {images.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            {images.map((imageUrl, index) => (
              <View key={imageUrl} style={{ marginRight: 10 }}>
                <ExpoImage
                  source={{ uri: imageUrl }}
                  style={{ width: 120, height: 120, borderRadius: 10 }}
                  contentFit='cover'
                />
                <TouchableOpacity
                  onPress={() => onImageRemove(imageUrl)}
                  style={{ position: 'absolute', top: 4, right: 4 }}
                  disabled={posting}
                >
                  <View
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FontAwesome name='close' size={16} color='#fff' />
                  </View>
                </TouchableOpacity>

                {/* Image counter badge */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    {index + 1}/{images.length}
                  </Text>
                </View>

                {/* Image information for edit mode (only show for first image to save space) */}
                {mode === 'edit' && index === 0 && (
                  <View
                    style={{
                      backgroundColor: colors.bubble,
                      padding: 8,
                      borderRadius: 6,
                      marginTop: 4,
                      width: 120,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 10,
                        fontWeight: 'bold',
                        marginBottom: 2,
                      }}
                    >
                      {images.length} image{images.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* GIFs preview - Horizontal scrollable list */}
        {gifs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            {gifs.map((gifUrl, index) => (
              <View key={gifUrl} style={{ marginRight: 10 }}>
                <ExpoImage
                  source={{ uri: gifUrl }}
                  style={{ width: 120, height: 120, borderRadius: 10 }}
                  contentFit='cover'
                />
                <TouchableOpacity
                  onPress={() => onGifRemove(gifUrl)}
                  style={{ position: 'absolute', top: 4, right: 4 }}
                  disabled={posting}
                >
                  <View
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FontAwesome name='close' size={16} color='#fff' />
                  </View>
                </TouchableOpacity>
                <View
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    GIF {index + 1}/{gifs.length}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Error message */}
        {error ? (
          <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text>
        ) : null}

        {/* Character count */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginBottom: 8,
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: isOverLimit ? colors.error : colors.icon,
              fontSize: 12,
              fontWeight: isOverLimit ? 'bold' : 'normal',
            }}
          >
            {text.length}/{characterLimit}
          </Text>
        </View>

        {/* Input section */}
        <View
          style={{
            backgroundColor: colors.bubble,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            minHeight: 100,
          }}
        >
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            style={{
              flex: 1,
              minHeight: 80,
              color: colors.text,
              fontSize: 16,
              lineHeight: 22,
              textAlignVertical: 'top',
            }}
            placeholder={getPlaceholder()}
            placeholderTextColor={isDark ? '#8899A6' : '#888'}
            multiline
            maxLength={characterLimit}
          />
        </View>

        {/* Action buttons row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left side - Media buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={onAddImage}
              disabled={uploading || posting || processing}
              style={{
                marginRight: 16,
                opacity: uploading || posting || processing ? 0.5 : 1,
              }}
            >
              <FontAwesome name='image' size={22} color={colors.icon} />
            </TouchableOpacity>
            {/* Hide GIF button for iOS in reply mode */}
            {!(Platform.OS === 'ios' && mode === 'reply') && (
              <TouchableOpacity
                onPress={onAddGif}
                disabled={uploading || posting || processing}
                style={{
                  marginRight: 16,
                  opacity: uploading || posting || processing ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 18, color: colors.icon }}>GIF</Text>
              </TouchableOpacity>
            )}
            {uploading && (
              <FontAwesome name='spinner' size={16} color={colors.icon} />
            )}
          </View>

          {/* Right side - Submit button */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? colors.primary : colors.disabled,
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 10,
              minWidth: 80,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 15,
              }}
            >
              {getSubmitButtonText()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ContentModal;
