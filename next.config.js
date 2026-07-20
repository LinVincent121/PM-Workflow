/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};
module.exports = nextConfig;
