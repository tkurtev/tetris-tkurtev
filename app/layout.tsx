import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Oxanium } from "next/font/google";
import "./globals.css";

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Absolute base for social image URLs; Vercel provides the production host. */
function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(host ? `https://${host}` : `http://localhost:${process.env.PORT ?? 3000}`);
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "TEDDIS — Futuristic Falling-Block Puzzle",
  description:
    "TEDDIS is a sleek, high-tech falling-block puzzle game. Rotate, slide and drop pieces to clear lines — tuned for keyboard and touch, right in your browser.",
  applicationName: "TEDDIS",
  appleWebApp: {
    capable: true,
    title: "TEDDIS",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "TEDDIS",
    description: "A futuristic falling-block puzzle game for desktop and mobile.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TEDDIS",
    description: "A futuristic falling-block puzzle game for desktop and mobile.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#030509",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${oxanium.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
