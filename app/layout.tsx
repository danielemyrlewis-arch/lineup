import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { publicAsset } from "@/lib/assets";
import "./globals.css";
const libreFranklin = localFont({
  src: "../public/fonts/libre-franklin-latin.woff2",
  variable: "--font-libre-franklin",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: "LINEUP — Find the film.",
  description:
    "24 films. Five questions. One answer. Narrow the lineup and find the film in LINEUP, a free movie deduction game.",
  icons: { icon: publicAsset("/favicon.svg") },
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
      <body>{children}</body>
    </html>
  );
}
