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
      <View style={{
        flex: 1,
        backgroundColor: colors.tosBackground,
        paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
      }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          position: 'relative',
        }}>
          <FontAwesome 
            name="shield" 
            size={24} 
            color={colors.primaryButton} 
            style={{ position: 'absolute', left: 20 }}
          />
          <Text style={{
            fontSize: 20,
            fontWeight: '600',
            color: colors.tosText,
            textAlign: 'center',
          }}>
            Terms of Service
          </Text>
        </View>

        {/* Important Notice */}
        <View style={{
          backgroundColor: colorScheme === 'dark' ? '#1A2A3A' : '#F0F8FF',
          margin: 16,
          padding: 16,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: colors.primaryButton,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <FontAwesome name="info-circle" size={18} color={colors.primaryButton} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.tosText,
              marginLeft: 8,
            }}>
              Required for App Store Compliance
            </Text>
          </View>
          <Text style={{
            fontSize: 14,
            color: colors.tosText,
            opacity: 0.8,
            lineHeight: 20,
          }}>
            You must read and accept these terms before using HiveSnaps. These terms include our zero-tolerance policy for abusive content and community guidelines.
          </Text>
        </View>

        {/* Terms Content */}
        <ScrollView
          style={{
            flex: 1,
            paddingHorizontal: 20,
          }}
          contentContainerStyle={{
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <Text style={{
            fontSize: 14,
            lineHeight: 22,
            color: colors.tosText,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          }}>
            {TERMS_OF_SERVICE_CONTENT}
          </Text>
        </ScrollView>

        {/* Scroll Progress Indicator */}
        {!hasScrolledToBottom && (
          <View style={{
            position: 'absolute',
            bottom: 120,
            right: 20,
            backgroundColor: colors.warning,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <FontAwesome name="arrow-down" size={12} color="white" />
            <Text style={{
              color: 'white',
              fontSize: 12,
              fontWeight: '600',
              marginLeft: 6,
            }}>
              Scroll to continue
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: colors.tosBackground,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Decline Button */}
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.secondaryButton,
                paddingVertical: 14,
                borderRadius: 8,
                alignItems: 'center',
                marginRight: 12,
              }}
              onPress={handleDecline}
              disabled={accepting}
            >
              <Text style={{
                color: colors.secondaryButtonText,
                fontSize: 16,
                fontWeight: '600',
              }}>
                Decline
              </Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={{
                flex: 2,
                backgroundColor: hasScrolledToBottom ? colors.primaryButton : colors.border,
                paddingVertical: 14,
                borderRadius: 8,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
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
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{
                    color: hasScrolledToBottom ? colors.primaryButtonText : colors.secondaryButtonText,
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    I Accept Terms
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Helper Text */}
          <Text style={{
            fontSize: 12,
            color: colors.tosText,
            opacity: 0.6,
            textAlign: 'center',
            marginTop: 12,
            lineHeight: 16,
          }}>
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
