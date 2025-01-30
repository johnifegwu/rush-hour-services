const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');

module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config
  config.output = {
    path: join(__dirname, '../../dist/apps/worker'),
  };

  // Set target to node since this is a Node.js application
  config.target = 'node';

  // Disable optimization
  config.optimization = {
    minimize: false
  };

  // Ensure assets are handled
  config.module = {
    ...config.module,
    rules: [
      ...(config.module?.rules || []),
      {
        test: /\.(txt|png|jpg|jpeg|gif|ico)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'assets',
            },
          },
        ],
      },
    ],
  };

  return config;
});
