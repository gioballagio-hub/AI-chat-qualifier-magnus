import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Lead Qualifier — Agenzia Immobiliare",
  description: "Qualifica la tua richiesta immobiliare in 60 secondi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${geist.variable} font-sans antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
