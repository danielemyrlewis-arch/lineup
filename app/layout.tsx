import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LINEUP — Find the film.",
  description:
    "24 films. Five questions. One answer. Narrow the lineup and find the film in LINEUP, a free movie deduction game.",
  icons: { icon: "/favicon.svg" },
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
