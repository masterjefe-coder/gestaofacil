import type { Metadata } from "next";

type BuildMarketingMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function buildMarketingMetadata({
  title,
  description,
  path,
}: BuildMarketingMetadataInput): Metadata {
  const url = `https://www.gestaofacilsistemas.com.br${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
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
      title,
      description,
      images: ["/brand/logo-wordmark.png"],
    },
  };
}
