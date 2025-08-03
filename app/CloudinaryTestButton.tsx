import React from 'react';
import { View, Button, Alert } from 'react-native';
import { uploadImageToCloudinaryFixed } from '../utils/cloudinaryImageUploadFixed';

// TestButton component for debugging Cloudinary upload
const CloudinaryTestButton = () => {
  const handleTestUpload = async () => {
    console.log('Test button pressed. Starting dummy upload...');
    // Use a public image URL for testing
    const dummyFile = {
      uri: 'https://via.placeholder.com/150.jpg',
      name: 'test.jpg',
      type: 'image/jpeg',
    };
    try {
      const url = await uploadImageToCloudinaryFixed(dummyFile);
      console.log('Test upload succeeded! Cloudinary URL:', url);
      Alert.alert('Success', 'Image uploaded! URL: ' + url);
    } catch (error) {
      console.error('Test upload failed:', error);
      Alert.alert('Upload failed', String(error));
    }
  };
  return (
    <View style={{ margin: 20 }}>
      <Button title='Test Cloudinary Upload' onPress={handleTestUpload} />
    </View>
  );
};

export default CloudinaryTestButton;
