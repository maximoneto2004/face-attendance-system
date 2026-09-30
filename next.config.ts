import type { NextConfig } from "next";

// A foto da turma é reduzida no navegador (~2400px) antes do envio, mas deixamos
// folga para o caso de o navegador enviar o arquivo original.
const PHOTO_UPLOAD_LIMIT = "12mb";

const nextConfig: NextConfig = {
  // sharp usa binários nativos; não deve ser empacotado.
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: { bodySizeLimit: PHOTO_UPLOAD_LIMIT },
    proxyClientMaxBodySize: PHOTO_UPLOAD_LIMIT,
  },
};

export default nextConfig;
