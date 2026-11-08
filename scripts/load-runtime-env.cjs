const path = require('node:path');
const { loadEnvConfig } = require('@next/env');

// Standalone changes cwd and deliberately contains no .env files. Read the
// existing checkout configuration before importing any authentication/DB code.
module.exports = function loadRuntimeEnvironment(standaloneDirectory) {
  const root = process.env.APP_ROOT
    ? path.resolve(process.env.APP_ROOT)
    : path.resolve(standaloneDirectory, '..', '..');

  process.env.NODE_ENV = 'production';
  loadEnvConfig(root, false, { info() {}, error: console.error });
  process.env.APP_ROOT ||= root;
  process.env.APP_SERVICE = 'monolith';
  process.env.SPLIT_DEPLOY_ENABLED = 'false';
};
