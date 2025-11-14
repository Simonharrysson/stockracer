const { resolve } = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  resolve(projectRoot, 'node_modules'),
  resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
