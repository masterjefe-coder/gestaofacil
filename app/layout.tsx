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
    default: "Gestao Facil Sistemas",
    template: "%s | Gestao Facil Sistemas",
  },
  description:
    "Sistema comercial para pequenos negocios venderem, cobrarem e emitirem NFS-e sem retrabalho.",
  applicationName: "Gestao Facil Sistemas",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Gestao Facil Sistemas",
    description:
      "Sistema comercial para pequenos negocios venderem, cobrarem e emitirem NFS-e sem retrabalho.",
    url: "https://www.gestaofacilsistemas.com.br",
    siteName: "Gestao Facil Sistemas",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/brand/logo-wordmark.png",
        width: 485,
        height: 123,
        alt: "Gestao Facil Sistemas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gestao Facil Sistemas",
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
