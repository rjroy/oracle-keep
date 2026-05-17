import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the pi SDK and its AI layer out of the webpack bundle — both use
  // Node.js built-ins that can't be bundled for the browser or Edge runtime.
  serverExternalPackages: ["@mariozechner/pi-coding-agent", "@mariozechner/pi-ai"],

  // Prevent Safari Home Screen web apps from caching the HTML shell.
  // Without this, Safari serves a stale document after deployments.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
