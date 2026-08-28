import type { MetadataRoute } from "next";

const siteUrl = "https://taigaonlineshoppinglimited.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/help/delivery`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/help/returns`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/help/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
