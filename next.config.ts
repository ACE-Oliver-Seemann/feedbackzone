import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page depends on the session cookie, so nothing is prerendered and
  // Cache Components would only add ceremony. Left off for the MVP.
  experimental: {
    // Enables forbidden() so that pages answer with a real 403 (MVP-03).
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
