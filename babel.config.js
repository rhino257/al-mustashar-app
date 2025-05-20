module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // Keep existing plugins
      [
        'module-resolver',
        {
          root: ['./'], // Or './src' if your main code is in a src folder
          alias: {
            '@': './', // Or './src' if your main code is in a src folder
            // You can add other aliases here if needed
          },
        },
      ],
    ],
  };
};
