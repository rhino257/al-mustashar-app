// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Opt out of package.json exports support (for SDK 53+ where it's default true)
// This can help with libraries that incorrectly try to import Node.js built-ins.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
