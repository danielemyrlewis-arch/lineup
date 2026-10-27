import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AnalyticsConsent } from "@/components/analytics/analytics-consent";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, SOCIAL_IMAGE } from "@/lib/site";
import "./globals.css";
import "../components/account/account.css";
import "../components/game/supporting-content.css";
import "../components/analytics/analytics-consent.css";
const libreFranklin = localFont({
  src: "../public/fonts/libre-franklin-latin.woff2",
  variable: "--font-libre-franklin",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "LINEUP",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: SOCIAL_IMAGE.url, alt: SOCIAL_IMAGE.alt }],
  },
  icons: {
    icon: [
      { url: new URL("favicon.svg", SITE_URL).href, type: "image/svg+xml" },
      { url: new URL("favicon-32.png", SITE_URL).href, type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: new URL("apple-touch-icon.png", SITE_URL).href, sizes: "180x180" }],
  },
};
export const viewport: Viewport = {
  themeColor: "#0D0D0D",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={libreFranklin.variable}>
      <body>{children}<AnalyticsConsent /></body>
    </html>
  );
}
