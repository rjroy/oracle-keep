import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the pi SDK out of the webpack bundle — it uses Node.js built-ins
  // that can't be bundled for the browser or Edge runtime.
  serverExternalPackages: ["@mariozechner/pi-coding-agent"],
};

export default nextConfig;
