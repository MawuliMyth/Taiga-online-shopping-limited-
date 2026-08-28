import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taiga Online Shopping Limited",
    short_name: "Taiga Market",
    description: "Online shopping for electronics, fashion, beauty, home and grocery essentials in Nigeria.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#0b2c22",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
