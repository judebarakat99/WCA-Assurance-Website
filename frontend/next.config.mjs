import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Include the shared requirement catalogue alongside the frontend and backend.
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
