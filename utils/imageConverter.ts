/**
 * Image Converter Utility
 * Converts HEIC and other image formats to JPEG
 * Ensures web compatibility for images uploaded from iOS devices
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface ConvertedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Converts an image to JPEG format
 * Handles HEIC images from iOS devices automatically
 * 
 * @param uri - The URI of the image to convert
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns Converted image with JPEG format
 */
export async function convertToJPEG(
  uri: string,
  quality: number = 0.8
): Promise<ConvertedImage> {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error(`Image file not found: ${uri}`);
    }

    // Use ImageManipulator to convert to JPEG
    // This automatically handles HEIC and other formats
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No transformations, just format conversion
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[imageConverter] Error converting image to JPEG:', error);
    }
    throw new Error(`Failed to convert image to JPEG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts multiple images to JPEG format
 * 
 * @param uris - Array of image URIs to convert
 * @param quality - JPEG quality (0-1), defaults to 0.8
 * @returns Array of converted images
 */
export async function convertMultipleToJPEG(
  uris: string[],
  quality: number = 0.8
): Promise<ConvertedImage[]> {
  const promises = uris.map(uri => convertToJPEG(uri, quality));
  return Promise.all(promises);
}
