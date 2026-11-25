import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  // pdfkit reads its standard-font metrics from disk at runtime; it must
  // run from node_modules, not from the bundled server output.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
