const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');

module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config
  config.output = {
    path: join(__dirname, '../../dist/apps/cron'),
  };

  // Set target to node since this is a Node.js application
  config.target = 'node';

  // Disable optimization
  config.optimization = {
    minimize: false
  };

  return config;
});
