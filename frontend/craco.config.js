const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [/Failed to parse source map/];
      return webpackConfig;
    },
  },
  devServer: {
    allowedHosts: 'all',
    client: {
      webSocketURL: {
        protocol: 'wss',
        hostname: '0.0.0.0',
        port: 443,
      },
    },
  },
};
