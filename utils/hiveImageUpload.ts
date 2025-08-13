// Hive Images Upload Utility for React Native Expo
// Uses images.hive.blog - Zero cost image hosting on Hive blockchain
// Usage: const url = await uploadImageToHive({ uri, name, type }, { username, privateKey });

import * as FileSystem from 'expo-file-system';
import { PrivateKey } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';

export interface HiveImageUploadFile {
  uri: string;
  name: string;
  type: string;
}

export interface HiveImageUploadOptions {
  username: string;
  privateKey: string;
}

export interface HiveImageUploadResult {
  url: string;
}

/**
 * Create signature for image upload to Hive images
 * @param fileUri - Local file URI from Expo ImagePicker
 * @param privateKey - User's private posting key
 * @returns Promise with signature string
 */
async function createImageSignature(
  fileUri: string,
  privateKey: string
): Promise<string> {
  try {
    // Read file as base64
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to buffer
    const content = Buffer.from(base64Data, 'base64');

    // Create hash
    const hash = sha256.create();
    hash.update('ImageSigningChallenge');
    hash.update(content);
    const hashHex = hash.hex();

    // Sign the hash
    const key = PrivateKey.fromString(privateKey);
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const signature = key.sign(hashBuffer);

    return signature.toString();
  } catch (error) {
    console.error('Error creating image signature:', error);
    throw new Error('Failed to create image signature');
  }
}

/**
 * Upload image to Hive images service
 * @param file - File object with uri, name, and type
 * @param options - Upload options including username and privateKey
 * @returns Promise with uploaded image URL
 */
export async function uploadImageToHive(
  file: HiveImageUploadFile,
  options: HiveImageUploadOptions
): Promise<HiveImageUploadResult> {
  try {
    console.log('Starting Hive image upload for:', file.name);

    // Create signature
    const signature = await createImageSignature(file.uri, options.privateKey);

    // Prepare form data
    const formData = new FormData();
    formData.append('image', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    // Upload to Hive images
    const uploadUrl = `https://images.hive.blog/${options.username}/${signature}`;
    console.log('Uploading to:', uploadUrl);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hive image upload failed:', response.status, errorText);
      throw new Error(`Image upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Hive upload response:', result);

    if (!result.url) {
      throw new Error('No URL returned from image upload');
    }

    console.log('Hive image upload successful:', result.url);
    return { url: result.url };
  } catch (error) {
    console.error('Failed to upload image to Hive:', error);
    throw new Error(
      `Image upload failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Create markdown image markup for Hive post
 * @param imageUrl - URL of the uploaded image
 * @param altText - Alt text for the image
 * @returns Markdown image string
 */
export function createImageMarkdown(
  imageUrl: string,
  altText: string = 'image'
): string {
  return `![${altText}](${imageUrl})`;
}

/**
 * Legacy compatibility function - maintains same interface as Cloudinary
 * @param file - File object with uri, name, and type
 * @param username - Hive username
 * @param privateKey - Hive private posting key
 * @returns Promise with uploaded image URL (string)
 */
export async function uploadImageToHiveCompatible(
  file: HiveImageUploadFile,
  username: string,
  privateKey: string
): Promise<string> {
  const result = await uploadImageToHive(file, { username, privateKey });
  return result.url;
}
