import { getNfseEmissionModeSummary, getNfseNationalIntegrationStatus, getNfseNationalPortalUrls } from "@/lib/nfse-national-provider";
import { getNfseJoinvilleIntegrationStatus, getNfseJoinvillePortalUrls } from "@/lib/nfse-joinville-provider";

export type NfseProviderKey = "national" | "joinville";

export type NfseProviderResolution = {
  key: NfseProviderKey;
  label: string;
  reason: string;
};

function normalizeProviderKey(value: string | undefined): NfseProviderKey | "auto" {
  if (value === "joinville") {
    return "joinville";
  }

  if (value === "national") {
    return "national";
  }

  return "auto";
}

function isJoinville(city: string | undefined, state: string | undefined) {
  return (city || "").trim().toLowerCase() === "joinville" && (state || "").trim().toUpperCase() === "SC";
}

export function resolveNfseProvider(city?: string, state?: string): NfseProviderResolution {
  const configuredProvider = normalizeProviderKey(process.env.NFSE_PROVIDER?.trim().toLowerCase());
  const joinvilleEnabled = process.env.NFSE_JOINVILLE_ENABLED?.trim().toLowerCase() === "true";

  if (configuredProvider === "joinville") {
    return {
      key: "joinville",
      label: "NF-em Joinville",
      reason: "Provider municipal forçado por NFSE_PROVIDER=joinville.",
    };
  }

  if (configuredProvider === "national") {
    return {
      key: "national",
      label: "NFS-e Nacional",
      reason: "Provider nacional forçado por NFSE_PROVIDER=national.",
    };
  }

  if (joinvilleEnabled && isJoinville(city, state)) {
    return {
      key: "joinville",
      label: "NF-em Joinville",
      reason: "Joinville/SC detectada com provider municipal habilitado.",
    };
  }

  return {
    key: "national",
    label: "NFS-e Nacional",
    reason: "Fluxo nacional padrão ativo.",
  };
}

export function getResolvedNfseIntegrationStatus(city?: string, state?: string) {
  const provider = resolveNfseProvider(city, state);

  if (provider.key === "joinville") {
    const status = getNfseJoinvilleIntegrationStatus();

    return {
      ...status,
      provider,
    };
  }

  const status = getNfseNationalIntegrationStatus();

  return {
    ...status,
    provider,
  };
}

export function getResolvedNfseEmissionModeSummary(city?: string, state?: string) {
  const provider = resolveNfseProvider(city, state);

  if (provider.key === "joinville") {
    const status = getNfseJoinvilleIntegrationStatus();
    const portal = getNfseJoinvillePortalUrls();

    return {
      assisted: {
        available: true as const,
        loginUrl: portal.loginUrl,
        issueUrl: portal.issueUrl,
        helper:
          "Joinville mantém o emissor municipal NF-em. Sem automação, a equipe ainda pode concluir a emissão no portal oficial da prefeitura.",
      },
      automatic: {
        available: status.ready,
        helper: status.ready
          ? "Provider municipal de Joinville configurado para emissão automática via webservice SOAP."
          : "A automação de Joinville exige inscrição municipal, certificado e parâmetros do webservice configurados.",
      },
    };
  }

  return getNfseEmissionModeSummary();
}

export function getResolvedNfsePortalUrls(city?: string, state?: string) {
  const provider = resolveNfseProvider(city, state);
  return provider.key === "joinville" ? getNfseJoinvillePortalUrls() : getNfseNationalPortalUrls();
}
