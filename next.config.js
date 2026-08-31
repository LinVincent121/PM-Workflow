/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() { const production = process.env.NODE_ENV === 'production'; return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ...(production ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
  ] }]; },
  experimental: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};
module.exports = nextConfig;
