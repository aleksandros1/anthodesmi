import type { Metadata, Viewport } from "next";
import { Alegreya } from "next/font/google";
import "./globals.css";

const font = Alegreya({ subsets: ["greek", "latin"], style: ["normal", "italic"], variable: "--font" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // γεμίζει όλη την οθόνη κάτω από notch / Dynamic Island
  themeColor: "#16041f",
};

export const metadata: Metadata = {
  title: "💐",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "💐", statusBarStyle: "black-translucent" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className={font.variable}>{children}</body>
    </html>
  );
}