import React from 'react';
import { Modal, View, Text, ScrollView, Pressable } from 'react-native';

interface StaticContentModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Function to call when modal should be closed */
  onClose: () => void;
  /** The title text to display */
  title: string;
  /** The main content text to display */
  content: string;
  /** Colors object for theming */
  colors: {
    background: string;
    text: string;
    button: string;
    buttonText: string;
  };
  /** Custom close button text (optional) */
  closeButtonText?: string;
  /** Custom modal animation type */
  animationType?: 'none' | 'slide' | 'fade';
  /** Custom accessibility label for close button */
  closeButtonAccessibilityLabel?: string;
}

const StaticContentModal: React.FC<StaticContentModalProps> = ({
  visible,
  onClose,
  title,
  content,
  colors,
  closeButtonText = 'Close',
  animationType = 'fade',
  closeButtonAccessibilityLabel = 'Close modal',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 16,
            width: '100%',
            maxWidth: 400,
            maxHeight: '80%',
            alignItems: 'center',
          }}
        >
          <ScrollView
            contentContainerStyle={{
              padding: 24,
              alignItems: 'center',
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                marginBottom: 18,
                textAlign: 'left',
              }}
            >
              {content}
            </Text>
            <Pressable
              style={{
                backgroundColor: colors.button,
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 24,
                marginTop: 8,
              }}
              onPress={onClose}
              accessibilityLabel={closeButtonAccessibilityLabel}
            >
              <Text
                style={{
                  color: colors.buttonText,
                  fontWeight: '600',
                  fontSize: 16,
                }}
              >
                {closeButtonText}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default StaticContentModal;
