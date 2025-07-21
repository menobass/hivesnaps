const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

/**
 * Custom Expo config plugin for react-native-share-menu
 * Adds necessary intent filters and plist entries for share functionality
 */
const withReactNativeShareMenu = (config) => {
  // Configure Android intent filters
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainActivity = androidManifest.manifest.application[0].activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      // Ensure intent-filter array exists
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Add share intent filters if they don't already exist
      const shareIntentFilter = {
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [
          { $: { 'android:mimeType': 'text/plain' } },
          { $: { 'android:mimeType': 'image/*' } },
        ],
      };

      const multipleShareIntentFilter = {
        action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'image/*' } }],
      };

      // Check if intent filters already exist to avoid duplicates
      const hasShareIntent = mainActivity['intent-filter'].some(
        (filter) =>
          filter.action &&
          filter.action.some((action) => action.$['android:name'] === 'android.intent.action.SEND')
      );

      if (!hasShareIntent) {
        mainActivity['intent-filter'].push(shareIntentFilter, multipleShareIntentFilter);
      }
    }

    return config;
  });

  // Configure iOS plist
  config = withInfoPlist(config, (config) => {
    const plist = config.modResults;
    
    // Add URL schemes if not already present
    if (!plist.CFBundleURLTypes) {
      plist.CFBundleURLTypes = [];
    }

    // Check if hivesnaps scheme already exists
    const hasHiveSnapsScheme = plist.CFBundleURLTypes.some(
      (urlType) =>
        urlType.CFBundleURLSchemes && urlType.CFBundleURLSchemes.includes('hivesnaps')
    );

    if (!hasHiveSnapsScheme) {
      plist.CFBundleURLTypes.push({
        CFBundleURLName: 'hivesnaps',
        CFBundleURLSchemes: ['hivesnaps'],
      });
    }

    return config;
  });

  return config;
};

module.exports = withReactNativeShareMenu;
