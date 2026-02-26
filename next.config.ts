import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  outputFileTracingIncludes: {
    "**/*": ["./node_modules/.prisma/client/*.node"],
  },
};

export default nextConfig;
