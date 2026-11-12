import type { NextConfig } from "next";

// Every page in TrojanTix is per-user and security-sensitive, so we use plain
// dynamic rendering (no Cache Components / partial prefetching).
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
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
