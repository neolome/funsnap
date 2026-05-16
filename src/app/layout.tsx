import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FunSnap — Filtres AR funny",
  description: "Plus de 60 filtres AR funny en temps réel. Photos & vidéos directement dans ton navigateur.",
  applicationName: "FunSnap",
  appleWebApp: {
    capable: true,
    title: "FunSnap",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "FunSnap",
    description: "60+ filtres AR funny en temps réel.",
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FunSnap" />
      </head>
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}
