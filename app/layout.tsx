import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gestaofacilsistemas.com.br"),
  title: {
    default: "Gestão Fácil Sistemas",
    template: "%s | Gestão Fácil Sistemas",
  },
  description:
    "Sistema comercial para pequenos negócios venderem, cobrarem e emitirem NFS-e sem retrabalho.",
  applicationName: "Gestão Fácil Sistemas",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Gestão Fácil Sistemas",
    description:
      "Sistema comercial para pequenos negócios venderem, cobrarem e emitirem NFS-e sem retrabalho.",
    url: "https://www.gestaofacilsistemas.com.br",
    siteName: "Gestão Fácil Sistemas",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/brand/logo-wordmark.png",
        width: 485,
        height: 123,
        alt: "Gestão Fácil Sistemas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gestão Fácil Sistemas",
    description:
      "Venda pelo WhatsApp, cobre por Pix e emita nota sem retrabalho.",
    images: ["/brand/logo-wordmark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  );
}
