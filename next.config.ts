import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      // Browser drži odgovor u HTTP kešu, pa ponovljena otvaranja ne idu do
      // Vercel-a. /data je kratko (10 min) jer SW za njega ostaje network-first
      // (v. pravilo 2 u public/sw.js) - ovo ograničava zastarelost god.json-a.
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=600" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
