import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Magnus SRL — Richiesta Ricambi e Accessori",
  description: "Invia la tua richiesta di ricambi, accessori, lubrificanti e vernici per veicoli americani. Il nostro team ti risponderà al più presto.",
  openGraph: {
    title: "Magnus SRL — Richiesta Ricambi e Accessori",
    description: "Invia la tua richiesta di ricambi, accessori, lubrificanti e vernici per veicoli americani.",
    siteName: "Magnus SRL",
    locale: "it_IT",
    type: "website",
  },
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
