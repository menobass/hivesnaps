import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useColorScheme,
  StatusBar,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { TERMS_OF_SERVICE_CONTENT } from '../constants/TermsOfService';
import Colors from '../constants/Colors';
import { createStyles } from './TermsOfServiceModal.styles';

interface TermsOfServiceModalProps {
  visible: boolean;
  onAccept: () => Promise<void>;
  onDecline?: () => void;
}

const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  const [accepting, setAccepting] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const styles = createStyles(colors, colorScheme ?? 'light');

  const handleAccept = async () => {
    if (!hasScrolledToBottom) {
      Alert.alert(
        'Please Read Terms',
        'Please scroll to the bottom and read the complete Terms of Service before accepting.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    setAccepting(true);
    try {
      await onAccept();
    } catch (error) {
      console.error('Error accepting TOS:', error);
      Alert.alert(
        'Error',
        'There was an error saving your acceptance. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Terms Required',
      'You must accept the Terms of Service to use HiveSnaps. The app will close if you decline.',
      [
        {
          text: 'Review Terms',
          style: 'cancel',
        },
        {
          text: 'Close App',
          style: 'destructive',
          onPress: onDecline,
        },
      ]
    );
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent={true}
    >
      <StatusBar
        backgroundColor={colors.tosBackground}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <FontAwesome 
            name="shield" 
            size={24} 
            color={colors.primaryButton} 
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>
            Terms of Service
          </Text>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeContainer}>
          <View style={styles.noticeHeader}>
            <FontAwesome name="info-circle" size={18} color={colors.primaryButton} />
            <Text style={styles.noticeTitle}>
              Required for App Store Compliance
            </Text>
          </View>
          <Text style={styles.noticeText}>
            You must read and accept these terms before using HiveSnaps. These terms include our zero-tolerance policy for abusive content and community guidelines.
          </Text>
        </View>

        {/* Terms Content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Text style={styles.termsText}>
            {TERMS_OF_SERVICE_CONTENT}
          </Text>
        </ScrollView>

        {/* Scroll Progress Indicator */}
        {!hasScrolledToBottom && (
          <View style={styles.scrollIndicator}>
            <FontAwesome name="arrow-down" size={12} color="white" />
            <Text style={styles.scrollIndicatorText}>
              Scroll to continue
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <View style={styles.buttonRow}>
            {/* Decline Button */}
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              disabled={accepting}
            >
              <Text style={styles.declineButtonText}>
                Decline
              </Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={[
                styles.acceptButton,
                { backgroundColor: hasScrolledToBottom ? colors.primaryButton : colors.border }
              ]}
              onPress={handleAccept}
              disabled={!hasScrolledToBottom || accepting}
            >
              {accepting ? (
                <ActivityIndicator size="small" color={colors.primaryButtonText} />
              ) : (
                <>
                  <FontAwesome 
                    name="check-circle" 
                    size={18} 
                    color={hasScrolledToBottom ? colors.primaryButtonText : colors.secondaryButtonText}
                    style={styles.acceptButtonIcon}
                  />
                  <Text style={[
                    styles.acceptButtonText,
                    { color: hasScrolledToBottom ? colors.primaryButtonText : colors.secondaryButtonText }
                  ]}>
                    I Accept Terms
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Helper Text */}
          <Text style={styles.helperText}>
            {hasScrolledToBottom 
              ? "By accepting, you agree to follow our community guidelines and content policies."
              : "Please scroll through the complete terms before accepting."
            }
          </Text>
        </View>
      </View>
    </Modal>
  );
};

export default TermsOfServiceModal;
