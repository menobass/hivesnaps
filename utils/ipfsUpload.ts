// IPFS Upload Utility for React Native Expo
// Uploads files directly to IPFS supernode (3Speak's IPFS gateway by default)
// Usage: const url = await uploadToIPFS({ uri, name, type });

import * as FileSystem from 'expo-file-system/legacy';

// Environment configuration with fallback
const IPFS_UPLOAD_ENDPOINT = process.env.EXPO_PUBLIC_IPFS_UPLOAD_ENDPOINT || 'http://65.21.201.94:5002/api/v0/add';
const IPFS_GATEWAY_URL = process.env.EXPO_PUBLIC_IPFS_GATEWAY_URL || 'https://ipfs.3speak.tv/ipfs';
const IPFS_API_KEY = process.env.EXPO_PUBLIC_IPFS_API_KEY; // Optional

export interface IPFSUploadFile {
  uri: string;
  name: string;
  type: string;
}

export interface IPFSUploadResult {
  hash: string;
  url: string;
}

/**
 * Upload file to IPFS supernode
 * @param file - File object with uri, name, and type
 * @returns Promise with IPFS hash and gateway URL
 */
export async function uploadToIPFS(
  file: IPFSUploadFile
): Promise<IPFSUploadResult> {
  try {
    console.log('Starting IPFS upload for:', file.name);

    // Prepare form data
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    // Build headers with optional API key
    const headers: Record<string, string> = {};
    if (IPFS_API_KEY) {
      headers['Authorization'] = `Bearer ${IPFS_API_KEY}`;
    }

    console.log('Uploading to IPFS endpoint:', IPFS_UPLOAD_ENDPOINT);

    const response = await fetch(IPFS_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IPFS upload failed:', response.status, errorText);
      throw new Error(`IPFS upload failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('IPFS upload response:', responseText);

    // IPFS returns NDJSON (newline-delimited JSON)
    const lines = responseText.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const result = JSON.parse(lastLine);

    if (!result.Hash) {
      throw new Error('No Hash returned from IPFS upload');
    }

    const ipfsHash = result.Hash;
    const ipfsUrl = `${IPFS_GATEWAY_URL}/${ipfsHash}`;

    console.log('IPFS upload successful:', ipfsUrl);
    return { hash: ipfsHash, url: ipfsUrl };
  } catch (error) {
    console.error('Failed to upload to IPFS:', error);
    throw new Error(
      `IPFS upload failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Upload thumbnail from local URI to IPFS
 * Convenience wrapper for thumbnail uploads
 * @param thumbnailUri - Local file URI
 * @returns Promise with IPFS gateway URL
 */
export async function uploadThumbnailToIPFS(
  thumbnailUri: string
): Promise<string> {
  const result = await uploadToIPFS({
    uri: thumbnailUri,
    name: `thumbnail-${Date.now()}.jpg`,
    type: 'image/jpeg',
  });
  return result.url;
}
