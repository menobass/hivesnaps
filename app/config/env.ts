// env.ts
// Helper to get BASE_API_URL from process.env (Expo/React Native)

export const BASE_API_URL = process.env.EXPO_PUBLIC_BASE_API_URL || '';
if (!BASE_API_URL) {
  console.warn('BASE_API_URL is not set in .env');
}

export const THREE_SPEAK_API_KEY = process.env.EXPO_PUBLIC_3SPEAK_API_KEY || '';
if (!THREE_SPEAK_API_KEY) {
  console.warn('THREE_SPEAK_API_KEY is not set in .env');
}
