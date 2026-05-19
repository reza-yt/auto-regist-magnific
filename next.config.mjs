/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages for serverless functions
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  // Webpack config to handle optional deps
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
};

export default nextConfig;
