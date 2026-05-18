import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components disabled: TableDrop pages read cookies / fresh Supabase
  // data and rely on `export const dynamic = "force-dynamic"`. Re-enable
  // post-Halftime when we can wrap fetches in `'use cache'`.
};

export default nextConfig;
