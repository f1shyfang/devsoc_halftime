import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled: auth-gated pages would each need Suspense boundaries.
  // Re-enable once we adopt the Cache Components patterns project-wide.
  cacheComponents: false,
  // Pin Turbopack's workspace root: a sibling package-lock.json in $HOME makes
  // Turbopack infer the wrong root and fail to resolve `next` (handover #5).
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
