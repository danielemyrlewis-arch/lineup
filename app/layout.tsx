import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LINEUP — Find the film.",
  description:
    "24 films. Five questions. One answer. Follow the clues and find the mystery film in LINEUP, a free movie deduction game.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  themeColor: "#111211",
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
