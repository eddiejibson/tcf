import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["typeorm", "pg", "reflect-metadata", "xlsx", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "jszip", "jspdf"],
  experimental: {
    middlewareClientMaxBodySize: "50mb",
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Preserve class names so TypeORM can resolve string-based relation targets
      // (e.g. @ManyToOne("Order", ...) needs Order.name === "Order", not minified)
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
