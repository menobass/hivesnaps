// env.ts
// Helper to get environment variables from process.env (Expo/React Native)

export const BASE_API_URL = process.env.EXPO_PUBLIC_BASE_API_URL || '';
if (!BASE_API_URL) {
  console.warn('BASE_API_URL is not set in .env');
}

export const THREE_SPEAK_API_KEY = process.env.EXPO_PUBLIC_3SPEAK_API_KEY || '';
if (!THREE_SPEAK_API_KEY) {
  console.warn('THREE_SPEAK_API_KEY is not set in .env');
}

export const IPFS_UPLOAD_ENDPOINT = process.env.EXPO_PUBLIC_IPFS_UPLOAD_ENDPOINT || 'https://ipfs.3speak.tv/api/v0/add';
export const IPFS_GATEWAY_URL = process.env.EXPO_PUBLIC_IPFS_GATEWAY_URL || 'https://ipfs.3speak.tv/ipfs';
