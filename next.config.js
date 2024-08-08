// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
// }

// module.exports = nextConfig
const path = require('path');
const webpack = require('webpack');

module.exports = {
  reactStrictMode: true,
  images: {
    domains: ['https://subwaymap-git-main-bigwhiiiiites-projects.vercel.app'], 
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.DEBUG': JSON.stringify(process.env.DEBUG || 'true'),
        })
      );
    }

    config.resolve.alias['@'] = path.resolve(__dirname);

    return config;
  },
};
