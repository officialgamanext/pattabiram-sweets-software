import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PrinterProvider } from "@/context/PrinterContext";
import { ToastProvider } from "@/context/ToastContext";
import AuthGuard from "@/components/AuthGuard";
import GlobalInputBehavior from "@/components/GlobalInputBehavior";
import PWAProvider from "@/components/PWAProvider";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#02626D",
};

export const metadata: Metadata = {
  title: "Pattabiram Sweets - Management Software",
  description: "Complete business management software for Pattabiram Sweets — orders, inventory, manufacturing, and more.",
  manifest: "/manifest.json",
  icons: {
    icon: "/app-icon.png",
    shortcut: "/app-icon.png",
    apple: "/app-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pattabiram Sweets",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sora.variable}>
      <head>
        <link rel="apple-touch-icon" href="/app-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen bg-[#f6f6f7] font-sans antialiased text-[#1a1a1a]">
        <GlobalInputBehavior />
        <PWAProvider>
          <ToastProvider>
            <AuthProvider>
              <PrinterProvider>
                <AuthGuard>{children}</AuthGuard>
              </PrinterProvider>
            </AuthProvider>
          </ToastProvider>
        </PWAProvider>
      </body>
    </html>
  );
}

