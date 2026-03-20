import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["typeorm", "pg", "reflect-metadata", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "jszip", "jspdf"],
  experimental: {
    middlewareClientMaxBodySize: "50mb",
    serverMinification: false,
  },
};

export default nextConfig;
