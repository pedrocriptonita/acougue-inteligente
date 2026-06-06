import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16: Turbopack é o bundler padrão (dev e build).
  // Caching é opt-in (Cache Components / "use cache"); tudo é dinâmico por padrão.
  reactStrictMode: true,

  // Cabeçalhos de segurança básicos (reforçados na Fase 8).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
