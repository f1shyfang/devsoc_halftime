import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled: auth-gated pages would each need Suspense boundaries.
  // Re-enable once we adopt the Cache Components patterns project-wide.
  cacheComponents: false,
};

export default nextConfig;
