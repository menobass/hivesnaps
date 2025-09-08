import { useState } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as ImagePicker from 'expo-image-picker';
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import { uploadImageSmart } from '../utils/imageUploadService';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export const useAvatarManagement = (currentUsername: string | null) => {
  const [editAvatarModalVisible, setEditAvatarModalVisible] = useState(false);
  const [newAvatarImage, setNewAvatarImage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUpdateLoading, setAvatarUpdateLoading] = useState(false);
  const [avatarUpdateSuccess, setAvatarUpdateSuccess] = useState(false);
  const [activeKeyModalVisible, setActiveKeyModalVisible] = useState(false);
  const [activeKeyInput, setActiveKeyInput] = useState('');

  const handleEditAvatarPress = () => {
    setNewAvatarImage(null);
    setAvatarUpdateSuccess(false);
    setActiveKeyInput(''); // Clear active key input
    setEditAvatarModalVisible(true);
  };

  const handleSelectNewAvatar = async () => {
    try {
      // Show action sheet to choose between camera and gallery
      let pickType: 'camera' | 'gallery' | 'cancel';

      if (Platform.OS === 'ios') {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                cancelButtonIndex: 0,
              },
              buttonIndex => {
                if (buttonIndex === 0) resolve('cancel');
                else if (buttonIndex === 1) resolve('camera');
                else if (buttonIndex === 2) resolve('gallery');
              }
            );
          }
        );
      } else {
        pickType = await new Promise<'camera' | 'gallery' | 'cancel'>(
          resolve => {
            Alert.alert(
              'Select Avatar Image',
              'Choose an option',
              [
                { text: 'Take Photo', onPress: () => resolve('camera') },
                {
                  text: 'Choose from Gallery',
                  onPress: () => resolve('gallery'),
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve('cancel'),
                },
              ],
              { cancelable: true }
            );
          }
        );
      }

      if (pickType === 'cancel') return;

      // Enhanced permission handling with better error messages
      let result;
      if (pickType === 'camera') {
        // Check current permission status first
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          // Request permission if not granted
          const requestPermission =
            await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'HiveSnaps needs camera access to take photos. Please enable camera permissions in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    IntentLauncher.startActivityAsync(
                      IntentLauncher.ActivityAction
                        .APPLICATION_DETAILS_SETTINGS,
                      { data: 'package:com.anonymous.hivesnaps' }
                    ).catch(() => {
                      // Fallback for older Android versions
                      Linking.openURL('app-settings:');
                    });
                  }
                },
              },
            ]
          );
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
          aspect: [1, 1], // Square aspect ratio for avatar
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        // Media library permission handling
        const currentPermission =
          await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentPermission.status;

        if (finalStatus !== 'granted') {
          const requestPermission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestPermission.status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Photo Library Permission Required',
            'HiveSnaps needs photo library access to select images. Please enable photo permissions in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    IntentLauncher.startActivityAsync(
                      IntentLauncher.ActivityAction
                        .APPLICATION_DETAILS_SETTINGS,
                      { data: 'package:com.anonymous.hivesnaps' }
                    ).catch(() => {
                      // Fallback for older Android versions
                      Linking.openURL('app-settings:');
                    });
                  }
                },
              },
            ]
          );
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          aspect: [1, 1], // Square aspect ratio for avatar
        });
      }

      if (!result || result.canceled || !result.assets || !result.assets[0])
        return;

      const asset = result.assets[0];
      setAvatarUploading(true);

      try {
        const fileToUpload = {
          uri: asset.uri,
          name: `avatar-${currentUsername}-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
        console.log(`[useAvatarManagement] Avatar uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);
        setNewAvatarImage(uploadResult.url);
      } catch (err) {
        console.error('Image upload error:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown upload error';
        Alert.alert(
          'Upload Failed',
          `Avatar upload failed: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      } finally {
        setAvatarUploading(false);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to pick image: ${errorMessage}`, [
        { text: 'OK' },
      ]);
      setAvatarUploading(false);
    }
  };

  const handleNextStep = () => {
    // Move to active key input modal
    setEditAvatarModalVisible(false);
    setActiveKeyModalVisible(true);
  };

  const handleUpdateAvatar = async () => {
    if (!newAvatarImage || !currentUsername || !activeKeyInput.trim()) return;

    setAvatarUpdateLoading(true);
    setAvatarUpdateSuccess(false);

    try {
      // Validate and create active key
      let activeKey;
      try {
        const keyStr = activeKeyInput.trim();
        // Basic validation: should start with 5 and be roughly the right length
        if (!keyStr.startsWith('5') || keyStr.length < 50) {
          throw new Error('Invalid key format');
        }
        activeKey = PrivateKey.fromString(keyStr);
      } catch (err) {
        throw new Error(
          'Invalid active key format. Please check your key and try again.'
        );
      }

      // Get current account data to preserve existing metadata
      const accounts = await client.database.getAccounts([currentUsername]);
      if (!accounts || !accounts[0]) throw new Error('Account not found');

      const account = accounts[0];

      // Parse existing metadata and preserve it
      let postingMeta = {};
      let jsonMeta = {};

      // Parse posting_json_metadata
      if (account.posting_json_metadata) {
        try {
          postingMeta = JSON.parse(account.posting_json_metadata);
        } catch (err) {
          console.log('Error parsing existing posting_json_metadata:', err);
        }
      }

      // Parse json_metadata
      if (account.json_metadata) {
        try {
          jsonMeta = JSON.parse(account.json_metadata);
        } catch (err) {
          console.log('Error parsing existing json_metadata:', err);
        }
      }

      // Update profile image in both metadata objects
      const updatedPostingMeta = {
        ...postingMeta,
        profile: {
          ...(postingMeta as any)?.profile,
          profile_image: newAvatarImage,
        },
      };

      const updatedJsonMeta = {
        ...jsonMeta,
        profile: {
          ...(jsonMeta as any)?.profile,
          profile_image: newAvatarImage,
        },
      };

      // Broadcast account update2 - required for posting_json_metadata support
      const operation = [
        'account_update2',
        {
          account: currentUsername,
          memo_key: account.memo_key,
          json_metadata: JSON.stringify(updatedJsonMeta),
          posting_json_metadata: JSON.stringify(updatedPostingMeta),
          extensions: [], // Required field for account_update2
        },
      ] as const;

      await client.broadcast.sendOperations([operation], activeKey);

      setAvatarUpdateLoading(false);
      setAvatarUpdateSuccess(true);

      // Clear sensitive data immediately
      setActiveKeyInput('');

      // Clear any cached avatar data and refresh profile
      setTimeout(async () => {
        setActiveKeyModalVisible(false);
        setEditAvatarModalVisible(false);
        setNewAvatarImage(null);
        setAvatarUpdateSuccess(false);
      }, 2000);
    } catch (err) {
      setAvatarUpdateLoading(false);
      setAvatarUpdateSuccess(false);
      // Clear sensitive data on error too
      setActiveKeyInput('');
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      throw new Error('Failed to update profile image: ' + errorMsg);
    }
  };

  const closeModals = () => {
    setEditAvatarModalVisible(false);
    setActiveKeyModalVisible(false);
    setNewAvatarImage(null);
    setAvatarUpdateSuccess(false);
    setActiveKeyInput('');
  };

  return {
    editAvatarModalVisible,
    newAvatarImage,
    avatarUploading,
    avatarUpdateLoading,
    avatarUpdateSuccess,
    activeKeyModalVisible,
    activeKeyInput,
    setActiveKeyInput,
    handleEditAvatarPress,
    handleSelectNewAvatar,
    handleNextStep,
    handleUpdateAvatar,
    closeModals,
  };
};
