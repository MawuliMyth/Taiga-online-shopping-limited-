import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/account"] },
    ],
    sitemap: "https://taigaonlineshoppinglimited.com/sitemap.xml",
    host: "https://taigaonlineshoppinglimited.com",
  };
}
