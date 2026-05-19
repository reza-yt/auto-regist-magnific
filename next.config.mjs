/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required: externalize chromium and playwright for serverless
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  // Disable image optimization (not needed)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
