import "./globals.css";
import { Inter } from "next/font/google";
import HeroEntrance from "../components/HeroEntrance";
import TopBar from "../components/TopBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={inter.variable}><body><TopBar /><HeroEntrance globe={null} copy={null} actions={null}>{children}</HeroEntrance></body></html>;
}
