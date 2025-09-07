// env.ts
// Helper to get BASE_API_URL from process.env (Expo/React Native)

export const BASE_API_URL = process.env.EXPO_PUBLIC_BASE_API_URL || process.env.BASE_API_URL || '';
if (!BASE_API_URL) {
  console.warn('BASE_API_URL is not set in .env');
}
