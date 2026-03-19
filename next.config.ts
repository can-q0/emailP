import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg-boss", "pdfjs-dist", "pdf-lib"],
};

export default nextConfig;
