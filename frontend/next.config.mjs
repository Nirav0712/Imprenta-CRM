/** @type {import('next').NextConfig} */
const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grey-falcon-988849.hostingersite.com/api';
const backendOrigin = backendApiUrl.replace(/\/api\/?$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
