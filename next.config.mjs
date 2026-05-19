/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serverless function config
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  },
  // Increase API route body size for proxy lists
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default nextConfig;
