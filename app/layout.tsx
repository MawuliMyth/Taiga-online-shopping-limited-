import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { VisitorCounter } from "./components/VisitorCounter";

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://taigaonlineshoppinglimited.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Taiga Online Shopping Limited | Online Shopping in Nigeria",
    template: "%s | Taiga Online Shopping Limited",
  },
  description: "Discover thoughtfully selected electronics, fashion, beauty, home and grocery essentials at prices worth smiling about.",
  applicationName: "Taiga Online Shopping Limited",
  icons: {
    icon: [{ url: "/taiga-favicon.png?v=2", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/taiga-favicon.png?v=2", type: "image/png", sizes: "1024x1024" }],
  },
  keywords: [
    "Taiga Online Shopping Limited",
    "online shopping Nigeria",
    "electronics Nigeria",
    "fashion Nigeria",
    "home essentials Nigeria",
    "groceries Nigeria",
  ],
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: siteUrl,
    siteName: "Taiga Online Shopping Limited",
    title: "Taiga Online Shopping Limited | Online Shopping in Nigeria",
    description: "Shop electronics, fashion, beauty, home and grocery essentials with nationwide delivery across Nigeria.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Taiga Online Shopping Limited" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Taiga Online Shopping Limited | Online Shopping in Nigeria",
    description: "Shop electronics, fashion, beauty, home and grocery essentials with nationwide delivery across Nigeria.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <VisitorCounter/>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "OnlineStore",
              name: "Taiga Online Shopping Limited",
              url: siteUrl,
              logo: `${siteUrl}/taiga-logo.png`,
              description: "Nigerian online marketplace for electronics, fashion, beauty, home and grocery essentials.",
              email: "sales@taigaonlineshoppinglimited.com",
              areaServed: { "@type": "Country", name: "Nigeria" },
              contactPoint: [
                { "@type": "ContactPoint", contactType: "customer support", email: "sales@taigaonlineshoppinglimited.com", availableLanguage: "English" },
                { "@type": "ContactPoint", contactType: "sales", email: "sales@taigaonlineshoppinglimited.com", availableLanguage: "English" },
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
