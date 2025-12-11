// env.ts
// Helper to get BASE_API_URL from process.env (Expo/React Native)

export const BASE_API_URL = process.env.EXPO_PUBLIC_BASE_API_URL || '';
if (!BASE_API_URL) {
  console.warn('BASE_API_URL is not set in .env');
}

// Ecency API base URL for chat integration
export const ECENCY_API_BASE_URL = process.env.EXPO_PUBLIC_ECENCY_API_BASE_URL || 'https://ecency.com/api/mattermost';
