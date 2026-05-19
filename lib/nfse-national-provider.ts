import { createNfseNationalClient, type NfseNationalEnvironment } from "@/lib/nfse-national-client";
import {
  buildSignedNfseNationalDpsXml,
  extractCertificateMaterialFromPfx,
  type NfseNationalDpsBuildInput,
} from "@/lib/nfse-national-xml";

export type NfseNationalIntegrationStatus = {
  enabled: boolean;
  environment: NfseNationalEnvironment;
  municipalCode?: string;
  hasCertificate: boolean;
  ready: boolean;
  missing: string[];
  helper: string;
};

export type NfseNationalConnectivityResult = {
  ok: boolean;
  target: string;
  status?: number;
  snippet?: string;
  error?: string;
};

export type NfseNationalIssueConfig = {
  environment: NfseNationalEnvironment;
  municipalCode: string;
  serviceCode: string;
  series: string;
  requestTimeoutMs: number;
  certPfxBase64: string;
  certPassphrase: string;
};

function normalizeEnvironment(value: string | undefined): NfseNationalEnvironment {
  return value === "production" ? "production" : "restricted";
}

export function getNfseNationalIntegrationStatus(): NfseNationalIntegrationStatus {
  const enabled = process.env.NFSE_NATIONAL_ENABLED === "true";
  const environment = normalizeEnvironment(process.env.NFSE_NATIONAL_ENVIRONMENT);
  const municipalCode = process.env.NFSE_NATIONAL_MUNICIPAL_CODE?.trim();
  const certPfxBase64 = process.env.NFSE_NATIONAL_CERT_PFX_BASE64?.trim();
  const certPassphrase = process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim();
  const serviceCode = process.env.NFSE_NATIONAL_SERVICE_CODE?.trim();
  const series = process.env.NFSE_NATIONAL_SERIES?.trim();

  const missing = [
    !enabled ? "NFSE_NATIONAL_ENABLED" : null,
    !municipalCode ? "NFSE_NATIONAL_MUNICIPAL_CODE" : null,
    !serviceCode ? "NFSE_NATIONAL_SERVICE_CODE" : null,
    !series ? "NFSE_NATIONAL_SERIES" : null,
    !certPfxBase64 ? "NFSE_NATIONAL_CERT_PFX_BASE64" : null,
    !certPassphrase ? "NFSE_NATIONAL_CERT_PASSPHRASE" : null,
  ].filter((item): item is string => !!item);

  return {
    enabled,
    environment,
    municipalCode,
    hasCertificate: !!certPfxBase64,
    ready: enabled && missing.length === 0,
    missing,
    helper:
      enabled && missing.length === 0
        ? "Ambiente oficial configurado para testes/integracao com a NFS-e Nacional."
        : "Faltam variáveis de ambiente para ligar a integração oficial da NFS-e Nacional.",
  };
}

export function getNfseNationalIssueConfig(): NfseNationalIssueConfig {
  const status = getNfseNationalIntegrationStatus();
  const certPfxBase64 = process.env.NFSE_NATIONAL_CERT_PFX_BASE64?.trim();
  const certPassphrase = process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim();
  const serviceCode = process.env.NFSE_NATIONAL_SERVICE_CODE?.trim();
  const series = process.env.NFSE_NATIONAL_SERIES?.trim();

  if (!status.ready || !status.municipalCode || !certPfxBase64 || !certPassphrase || !serviceCode || !series) {
    throw new Error(`Integração NFS-e Nacional incompleta. Pendências: ${status.missing.join(", ") || "revisar variáveis de ambiente"}.`);
  }

  return {
    environment: status.environment,
    municipalCode: status.municipalCode,
    serviceCode,
    series,
    requestTimeoutMs: Number(process.env.NFSE_NATIONAL_TIMEOUT_MS || "15000"),
    certPfxBase64,
    certPassphrase,
  };
}

export function buildSignedDpsPayload(input: Omit<NfseNationalDpsBuildInput, "environment" | "municipalCode" | "serviceCode" | "series">) {
  const config = getNfseNationalIssueConfig();
  const certificate = extractCertificateMaterialFromPfx(config.certPfxBase64, config.certPassphrase);

  return buildSignedNfseNationalDpsXml(
    {
      ...input,
      environment: config.environment,
      municipalCode: config.municipalCode,
      serviceCode: config.serviceCode,
      series: config.series,
    },
    certificate,
  );
}

export async function issueSignedNfsePayload(xmlPayload: string) {
  const config = getNfseNationalIssueConfig();
  const client = createNfseNationalClient({
    environment: config.environment,
    certPfxBase64: config.certPfxBase64,
    certPassphrase: config.certPassphrase,
    requestTimeoutMs: config.requestTimeoutMs,
  });

  return client.issueNfse(xmlPayload);
}

export async function testNfseNationalConnectivity(): Promise<NfseNationalConnectivityResult> {
  const status = getNfseNationalIntegrationStatus();

  if (!status.ready || !status.municipalCode) {
    return {
      ok: false,
      target: "parametros_municipais/{codigoMunicipio}/convenio",
      error: `Integração incompleta. Pendências: ${status.missing.join(", ") || "NFSE_NATIONAL_ENABLED"}.`,
    };
  }

  try {
    const client = createNfseNationalClient({
      environment: status.environment,
      certPfxBase64: process.env.NFSE_NATIONAL_CERT_PFX_BASE64,
      certPassphrase: process.env.NFSE_NATIONAL_CERT_PASSPHRASE,
      requestTimeoutMs: Number(process.env.NFSE_NATIONAL_TIMEOUT_MS || "15000"),
    });

    const response = await client.getMunicipalAgreement(status.municipalCode);

    return {
      ok: response.status >= 200 && response.status < 300,
      target: `/parametros_municipais/${status.municipalCode}/convenio`,
      status: response.status,
      snippet: response.body.slice(0, 280),
    };
  } catch (error) {
    return {
      ok: false,
      target: `/parametros_municipais/${status.municipalCode}/convenio`,
      error: error instanceof Error ? error.message : "Falha desconhecida ao testar a integração oficial.",
    };
  }
}
