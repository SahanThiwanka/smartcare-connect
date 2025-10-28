// next.config.mjs
import withPWA from 'next-pwa';

const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // SW only in prod
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // images: { domains: ['firebasestorage.googleapis.com'] },
};

export default withPWAConfig(nextConfig);
