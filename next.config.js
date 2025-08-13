/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Handle node modules that don't work in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;