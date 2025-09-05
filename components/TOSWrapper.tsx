import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, useColorScheme, BackHandler, Platform, Alert } from 'react-native';
import TermsOfServiceModal from '../components/TermsOfServiceModal';
import { tosStorage } from '../utils/tosStorage';

interface TOSWrapperProps {
  children: React.ReactNode;
}

const TOSWrapper: React.FC<TOSWrapperProps> = ({ children }) => {
  const [tosAccepted, setTosAccepted] = useState<boolean | null>(null);
  const [showTOSModal, setShowTOSModal] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    background: isDark ? '#15202B' : '#FFFFFF',
    text: isDark ? '#D7DBDC' : '#0F1419',
    primary: '#1DA1F2',
  };

  useEffect(() => {
    checkTOSAcceptance();
  }, []);

  const checkTOSAcceptance = async () => {
    try {
      const hasAccepted = await tosStorage.hasAcceptedTOS();
      setTosAccepted(hasAccepted);
      
      if (!hasAccepted) {
        // Small delay to ensure smooth animation
        setTimeout(() => {
          setShowTOSModal(true);
        }, 100);
      }
    } catch (error) {
      console.error('Error checking TOS acceptance:', error);
      // If we can't check, assume not accepted and show modal
      setTosAccepted(false);
      setShowTOSModal(true);
    }
  };

  const handleAcceptTOS = async () => {
    try {
      await tosStorage.acceptTOS();
      setTosAccepted(true);
      setShowTOSModal(false);
      console.log('TOS accepted successfully');
    } catch (error) {
      console.error('Error accepting TOS:', error);
      throw error; // Let the modal handle the error
    }
  };

  const handleDeclineTOS = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      // On iOS, we can't force close the app, so show an alert
      Alert.alert(
        'Terms Required',
        'You must accept the Terms of Service to use HiveSnaps.',
        [
          {
            text: 'OK',
            onPress: () => setShowTOSModal(true), // Show modal again
          },
        ]
      );
    }
  };

  // Show loading spinner while checking TOS status
  if (tosAccepted === null) {
    return (
      <>
        {children}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
        }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  // If TOS not accepted, show modal over the app
  if (!tosAccepted) {
    return (
      <>
        {children}
        <TermsOfServiceModal
          visible={showTOSModal}
          onAccept={handleAcceptTOS}
          onDecline={handleDeclineTOS}
        />
      </>
    );
  }

  // TOS accepted - show normal app
  return <>{children}</>;
};

export default TOSWrapper;
