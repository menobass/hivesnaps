import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  useColorScheme,
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
  image: string | null;
  gif: string | null;
  onImageRemove: () => void;
  onGifRemove: () => void;
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
  image,
  gif,
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

        {/* Image preview */}
        {image ? (
          <View style={{ marginBottom: 10 }}>
            <ExpoImage
              source={{ uri: image }}
              style={{ width: 120, height: 120, borderRadius: 10 }}
              contentFit='cover'
            />
            <TouchableOpacity
              onPress={onImageRemove}
              style={{ position: 'absolute', top: 4, right: 4 }}
              disabled={posting}
            >
              <FontAwesome name='close' size={20} color={colors.icon} />
            </TouchableOpacity>

            {/* Image information for edit mode */}
            {mode === 'edit' && (
              <View
                style={{
                  backgroundColor: colors.bubble,
                  padding: 8,
                  borderRadius: 6,
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: 'bold',
                    marginBottom: 2,
                  }}
                >
                  Image URL:
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    marginBottom: 4,
                  }}
                  numberOfLines={2}
                >
                  {image}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: 'bold',
                    marginBottom: 2,
                  }}
                >
                  Markdown:
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                  numberOfLines={2}
                >
                  ![image]({image})
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* GIF preview */}
        {gif ? (
          <View style={{ marginBottom: 10 }}>
            <ExpoImage
              source={{ uri: gif }}
              style={{ width: 120, height: 120, borderRadius: 10 }}
              contentFit='cover'
            />
            <TouchableOpacity
              onPress={onGifRemove}
              style={{ position: 'absolute', top: 4, right: 4 }}
              disabled={posting}
            >
              <FontAwesome name='close' size={20} color={colors.icon} />
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
                GIF
              </Text>
            </View>
          </View>
        ) : null}

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
