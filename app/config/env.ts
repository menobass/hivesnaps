// env.ts
// Helper to get environment variables from process.env (Expo/React Native)

export const BASE_API_URL = process.env.EXPO_PUBLIC_BASE_API_URL || '';
if (!BASE_API_URL) {
  console.warn('BASE_API_URL is not set in .env - some API features may not work');
}

// THREE_SPEAK_API_KEY is required for video upload features.
// It is optional for read-only operations (e.g., viewing videos).
export const THREE_SPEAK_API_KEY = process.env.EXPO_PUBLIC_3SPEAK_API_KEY || '';
if (!THREE_SPEAK_API_KEY) {
  const message = 
    '⚠️  THREE_SPEAK_API_KEY is not set in .env\n' +
    'Video upload features will NOT work.\n' +
    'Set EXPO_PUBLIC_3SPEAK_API_KEY in your .env file to enable video uploading.\n' +
    'Viewing videos will still work normally.';
  
  if (__DEV__) {
    // In development, show clear warning but don't crash (allows testing read-only features)
    console.error(message);
  } else {
    console.warn(message);
  }
}

export const IPFS_UPLOAD_ENDPOINT = process.env.EXPO_PUBLIC_IPFS_UPLOAD_ENDPOINT || 'https://ipfs.3speak.tv/api/v0/add';
export const IPFS_GATEWAY_URL = process.env.EXPO_PUBLIC_IPFS_GATEWAY_URL || 'https://ipfs.3speak.tv/ipfs';
