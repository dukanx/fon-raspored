import type { NextConfig } from "next";

// Statički izvoz (out/) za Cloudflare Pages: sve strane su klijentske, a
// serverski deo (notifikacije, feedback, AI razlog) je u functions/api.
// Headeri su u public/_headers, jer next.config headers() ne važi uz izvoz.
const nextConfig: NextConfig = {
  output: "export",
  // Optimizacija slika traži Next server; slike se serviraju kakve jesu.
  images: { unoptimized: true },
};

export default nextConfig;
