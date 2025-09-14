module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Use the new worklets plugin instead of the deprecated reanimated plugin
      'react-native-worklets/plugin',
    ],
  };
};
