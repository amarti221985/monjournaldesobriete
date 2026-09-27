import type { NextConfig } from "next";

import { privateDocumentHeaders, securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/reports/:path*", headers: privateDocumentHeaders },
    ];
  },
};

export default nextConfig;
