import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/login.html", destination: "/login", permanent: false },
      { source: "/cadastro-usuario.html", destination: "/cadastro-usuario", permanent: false },
      { source: "/alterar-senha.html", destination: "/alterar-senha", permanent: false },
    ];
  },
  async rewrites() {
    const apiOrigin = process.env.API_URL || "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
