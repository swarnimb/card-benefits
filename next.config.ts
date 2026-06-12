import type { NextConfig } from "next";

const isDemoBuild = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const nextConfig: NextConfig = {
  // Demo mode: static export for the GitHub Pages demo build.
  // Non-demo builds must behave exactly as before (no extra config).
  ...(isDemoBuild && {
    output: "export" as const,
    basePath: "/card-benefits",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
