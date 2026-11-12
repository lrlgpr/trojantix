import type { NextConfig } from "next";

// Every page in TrojanTix is per-user and security-sensitive, so we use plain
// dynamic rendering (no Cache Components / partial prefetching).
const nextConfig: NextConfig = {
  // Let phones on the same Wi-Fi (via the Mac's LAN IP) or through a
  // Cloudflare quick tunnel load the dev server. Dev-only setting.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.trycloudflare.com"],
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
