const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => {
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...config.module.rules,
      ],
    },
    resolve: {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
      },
    },
    optimization: {
      ...config.optimization,
      moduleIds: 'named',
    },
  };
});
