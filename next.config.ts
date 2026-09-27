import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy (docs/SECURITY.md). Le navigateur ne parle qu'à l'application :
 * Supabase est appelé côté serveur. 'unsafe-inline' reste nécessaire pour les scripts
 * d'hydratation de Next.js et les styles en ligne (limitation connue ; une CSP à nonce
 * imposerait un rendu dynamique de toutes les pages). 'unsafe-eval' et WebSocket
 * seulement en développement (rechargement à chaud).
 */
export const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co${isDevelopment ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Même origine seulement : les URL internes (ex. /journal/2026-09-24) ne fuient pas vers l'extérieur.
  { key: "Referrer-Policy", value: "same-origin" },
  // API navigateur inutilisées désactivées (aucune géolocalisation, caméra ni micro).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(isDevelopment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
