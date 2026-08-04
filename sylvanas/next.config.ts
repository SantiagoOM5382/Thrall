import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Preview uploads (mp4 / webm / gif) are capped at 15MB by thrall.
      // Next's default Server Action body limit is 1MB — raise it above the
      // app cap with a little headroom for multipart framing overhead.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
