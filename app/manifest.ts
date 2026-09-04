import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taiga Online Shopping Limited",
    short_name: "Taiga Market",
    description: "Online shopping for electronics, fashion, beauty, home and grocery essentials in Nigeria.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d7a5f",
    icons: [{ src: "/taiga-favicon.png?v=2", sizes: "1024x1024", type: "image/png" }],
  };
}
