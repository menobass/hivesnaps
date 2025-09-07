const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Initialize resolver if it doesn't exist
if (!config.resolver) {
  config.resolver = {};
}

// Ensure proper module resolution for Expo managed workflow
config.resolver.platforms = ['ios', 'android', 'web'];

// Add asset extensions for media files
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'gif',
  'webp',
  'mp4',
  'mov',
];

module.exports = config;
