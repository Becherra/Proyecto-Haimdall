import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import TopBar from "../components/TopBar";
import { PWA_THEME_COLOR } from "../lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "HEIMDALL · Rotaciones de cultivo",
  description: "Apoyo a la decisión agrícola con datos climáticos de la NASA.",
  applicationName: "Heimdall",
  appleWebApp: { capable: true, title: "Heimdall", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: PWA_THEME_COLOR };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${inter.variable} font-sans`}><TopBar />{children}</body></html>;
}
