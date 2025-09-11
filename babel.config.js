module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Re-enable reanimated plugin now that we have worklets installed
      'react-native-reanimated/plugin',
    ],
  };
};
