import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pattabiram Sweets - Management Software",
  description: "Complete business management software for Pattabiram Sweets — orders, inventory, manufacturing, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-100/80 font-sans antialiased text-slate-900">
        <div className="min-h-screen">
          <div className="bg-white rounded-xl lg:rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden">
            <Header />
            <main className="p-4 sm:p-6 lg:p-8 bg-slate-50/50">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
