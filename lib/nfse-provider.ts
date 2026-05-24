import { getNfseEmissionModeSummary, getNfseNationalIntegrationStatus, getNfseNationalPortalUrls } from "@/lib/nfse-national-provider";
import { getNfseJoinvilleIntegrationStatus, getNfseJoinvillePortalUrls } from "@/lib/nfse-joinville-provider";
import type { NfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";

export type NfseProviderKey = "national" | "joinville";

export type NfseProviderResolution = {
  key: NfseProviderKey;
  label: string;
  reason: string;
};

type NfseProviderContext = {
  municipalityStatus?: Pick<NfseNationalMunicipalityStatus, "aderenteEmissorNacional"> | null;
};

type MunicipalProviderDefinition = {
  key: Exclude<NfseProviderKey, "national">;
  label: string;
  isEnabled: () => boolean;
  matches: (city?: string, state?: string) => boolean;
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

const municipalProviders: MunicipalProviderDefinition[] = [
  {
    key: "joinville",
    label: "NF-em Joinville",
    isEnabled: () => process.env.NFSE_JOINVILLE_ENABLED?.trim().toLowerCase() === "true",
    matches: isJoinville,
  },
];

export function listKnownMunicipalNfseProviders() {
  return municipalProviders.map((provider) => ({
    key: provider.key,
    label: provider.label,
    enabled: provider.isEnabled(),
  }));
}

export function getSupportedMunicipalNfseProvider(city?: string, state?: string) {
  return municipalProviders.find((provider) => provider.isEnabled() && provider.matches(city, state)) || null;
}

export function resolveNfseProvider(city?: string, state?: string, context?: NfseProviderContext): NfseProviderResolution {
  const configuredProvider = normalizeProviderKey(process.env.NFSE_PROVIDER?.trim().toLowerCase());
  const municipalProvider = getSupportedMunicipalNfseProvider(city, state);
  const municipalitySupportsNational = context?.municipalityStatus?.aderenteEmissorNacional === true;
  const municipalityBlocksNational = context?.municipalityStatus?.aderenteEmissorNacional === false;

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

  if (municipalityBlocksNational && municipalProvider) {
    return {
      key: municipalProvider.key,
      label: municipalProvider.label,
      reason: "O município ainda não está liberado no Emissor Nacional; fallback municipal habilitado automaticamente.",
    };
  }

  if (municipalitySupportsNational) {
    return {
      key: "national",
      label: "NFS-e Nacional",
      reason: "Município liberado no Emissor Nacional; fluxo nacional permanece como padrão.",
    };
  }

  return {
    key: "national",
    label: "NFS-e Nacional",
    reason: "Fluxo nacional padrão ativo.",
  };
}

export function getResolvedNfseIntegrationStatus(city?: string, state?: string, context?: NfseProviderContext) {
  const provider = resolveNfseProvider(city, state, context);

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

export function getResolvedNfseEmissionModeSummary(city?: string, state?: string, context?: NfseProviderContext) {
  const provider = resolveNfseProvider(city, state, context);

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

export function getResolvedNfsePortalUrls(city?: string, state?: string, context?: NfseProviderContext) {
  const provider = resolveNfseProvider(city, state, context);
  return provider.key === "joinville" ? getNfseJoinvillePortalUrls() : getNfseNationalPortalUrls();
}
