import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageSmart, uploadImage } from '../utils/imageUploadService';

interface HiveImageTestProps {
  username?: string | null;
  onTestComplete?: (result: { success: boolean; provider: string; cost: number }) => void;
}

/**
 * Test component for Hive image upload functionality
 * Use this to verify the migration is working correctly
 */
export const HiveImageTest: React.FC<HiveImageTestProps> = ({ 
  username, 
  onTestComplete 
}) => {
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const testImageUpload = async (provider: 'auto' | 'hive' | 'cloudinary') => {
    setTesting(true);
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission required', 'Please grant photo library access to test image upload');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        setTesting(false);
        return;
      }

      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: `test-${Date.now()}.jpg`,
        type: 'image/jpeg',
      };

      // Test upload
      const uploadResult = provider === 'auto' 
        ? await uploadImageSmart(file, username)
        : await uploadImage(file, { 
            provider: provider as 'hive' | 'cloudinary',
            username: username || undefined,
            privateKey: username ? await getPrivateKey() : undefined,
            fallbackToCloudinary: true
          });

      const message = `✅ Upload successful!\n\nProvider: ${uploadResult.provider}\nCost: $${uploadResult.cost}\nURL: ${uploadResult.url.substring(0, 50)}...`;
      
      setLastResult(message);
      Alert.alert('Upload Test Result', message);
      
      onTestComplete?.({
        success: true,
        provider: uploadResult.provider,
        cost: uploadResult.cost,
      });

    } catch (error) {
      const errorMessage = `❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setLastResult(errorMessage);
      Alert.alert('Upload Test Failed', errorMessage);
      
      onTestComplete?.({
        success: false,
        provider: 'unknown',
        cost: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const getPrivateKey = async (): Promise<string | undefined> => {
    // In a real implementation, this would fetch from secure storage
    // For testing, return undefined to test fallback
    return undefined;
  };

  return (
    <View style={{ 
      padding: 16, 
      backgroundColor: '#f5f5f5', 
      borderRadius: 8, 
      margin: 16 
    }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: 'bold', 
        marginBottom: 12,
        color: '#333'
      }}>
        🧪 Image Upload Test
      </Text>
      
      <Text style={{ 
        fontSize: 14, 
        color: '#666', 
        marginBottom: 16 
      }}>
        Test the new Hive image upload functionality with automatic fallback to Cloudinary.
      </Text>

      {testing && (
        <View style={{ 
          alignItems: 'center', 
          marginBottom: 16 
        }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 8, color: '#666' }}>
            Testing upload...
          </Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#007AFF',
            padding: 12,
            borderRadius: 6,
            alignItems: 'center',
          }}
          onPress={() => testImageUpload('auto')}
          disabled={testing}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Test Auto Upload (Smart)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#34C759',
            padding: 12,
            borderRadius: 6,
            alignItems: 'center',
          }}
          onPress={() => testImageUpload('hive')}
          disabled={testing}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Test Hive Upload (Free)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#FF9500',
            padding: 12,
            borderRadius: 6,
            alignItems: 'center',
          }}
          onPress={() => testImageUpload('cloudinary')}
          disabled={testing}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Test Cloudinary Upload (Legacy)
          </Text>
        </TouchableOpacity>
      </View>

      {lastResult && (
        <View style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: 'white',
          borderRadius: 6,
          borderLeftWidth: 4,
          borderLeftColor: lastResult.includes('✅') ? '#34C759' : '#FF3B30',
        }}>
          <Text style={{ 
            fontSize: 12, 
            fontFamily: 'monospace',
            color: '#333'
          }}>
            {lastResult}
          </Text>
        </View>
      )}
    </View>
  );
};
