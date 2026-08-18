import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The local test is opened through both localhost and 127.0.0.1.
  // Allowing both prevents Next dev from blocking its own browser assets.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  turbopack: {
    root: path.resolve(process.cwd(), "..", "..")
  }
};

export default nextConfig;
