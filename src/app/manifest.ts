import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" no celular: o app abre em tela cheia, como um aplicativo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chamada Facial",
    short_name: "Chamada",
    description: "Controle de presença por foto da turma",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nova chamada", short_name: "Chamada", url: "/attendance/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Histórico", url: "/attendance" },
    ],
  };
}
