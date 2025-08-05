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

interface ReplyModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  replyTarget: { author: string; permlink: string } | null;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  replyImage: string | null;
  replyGif: string | null;
  onImageRemove: () => void;
  onGifRemove: () => void;
  onAddImage: () => void;
  onAddGif: () => void;
  posting: boolean;
  uploading: boolean;
  replyProcessing: boolean;
  replyError: string | null;
  currentUsername: string | null;
}

const CHARACTER_LIMIT = 288;

const ReplyModal: React.FC<ReplyModalProps> = ({
  isVisible,
  onClose,
  onSubmit,
  replyTarget,
  replyText,
  onReplyTextChange,
  replyImage,
  replyGif,
  onImageRemove,
  onGifRemove,
  onAddImage,
  onAddGif,
  posting,
  uploading,
  replyProcessing,
  replyError,
  currentUsername,
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

  const isTextEmpty = !replyText.trim();
  const isOverLimit = replyText.length > CHARACTER_LIMIT;
  const canSubmit =
    !isTextEmpty &&
    !isOverLimit &&
    !uploading &&
    !posting &&
    !replyProcessing &&
    currentUsername;

  const handleTextChange = (text: string) => {
    if (text.length <= CHARACTER_LIMIT) {
      onReplyTextChange(text);
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
          Reply to {replyTarget?.author}
        </Text>

        {/* Reply image preview */}
        {replyImage ? (
          <View style={{ marginBottom: 10 }}>
            <ExpoImage
              source={{ uri: replyImage }}
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
          </View>
        ) : null}

        {/* Reply GIF preview */}
        {replyGif ? (
          <View style={{ marginBottom: 10 }}>
            <ExpoImage
              source={{ uri: replyGif }}
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
        {replyError ? (
          <Text style={{ color: colors.error, marginBottom: 8 }}>
            {replyError}
          </Text>
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
            {replyText.length}/{CHARACTER_LIMIT}
          </Text>
        </View>

        {/* Reply input section */}
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
            value={replyText}
            onChangeText={handleTextChange}
            style={{
              flex: 1,
              minHeight: 80,
              color: colors.text,
              fontSize: 16,
              lineHeight: 22,
              textAlignVertical: 'top',
            }}
            placeholder='Write your reply...'
            placeholderTextColor={isDark ? '#8899A6' : '#888'}
            multiline
            maxLength={CHARACTER_LIMIT}
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
              disabled={uploading || posting || replyProcessing}
              style={{
                marginRight: 16,
                opacity: uploading || posting || replyProcessing ? 0.5 : 1,
              }}
            >
              <FontAwesome name='image' size={22} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAddGif}
              disabled={uploading || posting || replyProcessing}
              style={{
                marginRight: 16,
                opacity: uploading || posting || replyProcessing ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: 18, color: colors.icon }}>GIF</Text>
            </TouchableOpacity>
            {uploading && (
              <FontAwesome name='spinner' size={16} color={colors.icon} />
            )}
          </View>

          {/* Right side - Send button */}
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
              {posting
                ? 'Posting...'
                : replyProcessing
                  ? 'Checking...'
                  : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ReplyModal;
