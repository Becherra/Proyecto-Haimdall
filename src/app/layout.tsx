import type { Metadata } from "next";
import { Inter } from "next/font/google";
import TopBar from "../components/TopBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "HEIMDALL · Rotaciones de cultivo",
  description: "Apoyo a la decisión agrícola con datos climáticos de la NASA.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${inter.variable} font-sans`}><TopBar />{children}</body></html>;
}
