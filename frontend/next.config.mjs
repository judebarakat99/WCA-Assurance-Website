/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/WFA-Assurance-Website',
  trailingSlash: true,

  images: {
    unoptimized: true,
  },
};

export default nextConfig;