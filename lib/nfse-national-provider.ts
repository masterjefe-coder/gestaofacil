import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
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
  certificateSource?: "base64" | "path";
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

export type NfseNationalCertificateInspection = {
  ok: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  hasPrivateKey?: boolean;
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

type NfseNationalIssueConfigOverrides = {
  municipalCode?: string;
  serviceCode?: string;
};

export type NfseEmissionModeSummary = {
  assisted: {
    available: true;
    loginUrl: string;
    issueUrl: string;
    helper: string;
  };
  automatic: {
    available: boolean;
    helper: string;
  };
};

function normalizeEnvironment(value: string | undefined): NfseNationalEnvironment {
  return value === "production" ? "production" : "restricted";
}

function readChunkedEnv(baseKey: string) {
  const parts = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith(`${baseKey}_PART_`) && typeof value === "string" && value.trim())
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => value!.trim());

  if (parts.length > 0) {
    return parts.join("");
  }

  return process.env[baseKey]?.trim();
}

function getCertificateSource() {
  const certPfxBase64 = readChunkedEnv("NFSE_NATIONAL_CERT_PFX_BASE64") || readChunkedEnv("NFSE_JOINVILLE_CERT_PFX_BASE64");
  const certPfxPath = process.env.NFSE_NATIONAL_CERT_PFX_PATH?.trim() || process.env.NFSE_JOINVILLE_CERT_PFX_PATH?.trim();

  if (certPfxBase64) {
    return {
      source: "base64" as const,
      value: certPfxBase64,
    };
  }

  if (certPfxPath) {
    return {
      source: "path" as const,
      value: certPfxPath,
    };
  }

  return null;
}

async function resolveCertificatePfxBase64() {
  const source = getCertificateSource();

  if (!source) {
    return null;
  }

  if (source.source === "base64") {
    return source.value;
  }

  const fileBuffer = await readFile(source.value);
  return fileBuffer.toString("base64");
}

export function getNfseNationalPortalUrls() {
  return {
    loginUrl: "https://www.nfse.gov.br/EmissorNacional/Login/Index",
    issueUrl: "https://www.nfse.gov.br/EmissorNacional",
  };
}

export function getNfseEmissionModeSummary(): NfseEmissionModeSummary {
  const portal = getNfseNationalPortalUrls();
  const status = getNfseNationalIntegrationStatus();

  return {
    assisted: {
      available: true,
      loginUrl: portal.loginUrl,
      issueUrl: portal.issueUrl,
      helper:
        "Sem certificado, o cliente ainda pode entrar no portal oficial com gov.br, usuario/senha ou certificado e concluir a emissao manualmente.",
    },
    automatic: {
      available: status.ready,
      helper: status.ready
        ? "Certificado e parametros fiscais configurados para tentar emissao automatica pela API oficial."
        : "A emissao automatica fica disponivel quando houver certificado digital e parametros oficiais configurados.",
    },
  };
}

export async function inspectNfseNationalCertificate(): Promise<NfseNationalCertificateInspection> {
  const certPassphrase = process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim() || process.env.NFSE_JOINVILLE_CERT_PASSPHRASE?.trim();
  const certPfxBase64 = await resolveCertificatePfxBase64();

  if (!certPfxBase64 || !certPassphrase) {
    return {
      ok: false,
      error: "Certificado ou senha ainda não configurados para inspeção local.",
    };
  }

  try {
    const certificate = extractCertificateMaterialFromPfx(certPfxBase64, certPassphrase);
    const body = certificate.certificatePem
      .replace("-----BEGIN CERTIFICATE-----", "")
      .replace("-----END CERTIFICATE-----", "")
      .replace(/\r?\n/g, "");
    const x509 = new crypto.X509Certificate(Buffer.from(body, "base64"));

    return {
      ok: true,
      subject: x509.subject,
      issuer: x509.issuer,
      validFrom: x509.validFrom,
      validTo: x509.validTo,
      hasPrivateKey: !!certificate.privateKeyPem,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao inspecionar certificado da NFS-e Nacional.",
    };
  }
}

export function getNfseNationalIntegrationStatus(): NfseNationalIntegrationStatus {
  const enabled = process.env.NFSE_NATIONAL_ENABLED?.trim().toLowerCase() === "true";
  const environment = normalizeEnvironment(process.env.NFSE_NATIONAL_ENVIRONMENT);
  const municipalCode = process.env.NFSE_NATIONAL_MUNICIPAL_CODE?.trim();
  const certificate = getCertificateSource();
  const certPassphrase = process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim();
  const series = process.env.NFSE_NATIONAL_SERIES?.trim();

  const missing = [
    !enabled ? "NFSE_NATIONAL_ENABLED" : null,
    !series ? "NFSE_NATIONAL_SERIES" : null,
    !certificate ? "NFSE_NATIONAL_CERT_PFX_BASE64 ou NFSE_NATIONAL_CERT_PFX_PATH" : null,
    !certPassphrase ? "NFSE_NATIONAL_CERT_PASSPHRASE" : null,
  ].filter((item): item is string => !!item);

  return {
    enabled,
    environment,
    municipalCode,
    hasCertificate: !!certificate,
    certificateSource: certificate?.source,
    ready: enabled && missing.length === 0,
    missing,
    helper:
      enabled && missing.length === 0
        ? "Ambiente oficial configurado para testes/integracao com a NFS-e Nacional."
        : "Faltam variáveis de ambiente para ligar a integração oficial da NFS-e Nacional.",
  };
}

export async function getNfseNationalIssueConfig(overrides?: NfseNationalIssueConfigOverrides): Promise<NfseNationalIssueConfig> {
  const status = getNfseNationalIntegrationStatus();
  const certPassphrase = process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim();
  const serviceCode = overrides?.serviceCode?.trim() || process.env.NFSE_NATIONAL_SERVICE_CODE?.trim();
  const series = process.env.NFSE_NATIONAL_SERIES?.trim();
  const certPfxBase64 = await resolveCertificatePfxBase64();
  const municipalCode = overrides?.municipalCode?.trim() || status.municipalCode;

  if (!status.ready || !municipalCode || !certPfxBase64 || !certPassphrase || !serviceCode || !series) {
    const dynamicMissing = [
      ...status.missing,
      !municipalCode ? "codigo IBGE do municipio emissor" : null,
      !serviceCode ? "codigo do servico da emissao" : null,
    ].filter((item): item is string => !!item);

    throw new Error(`Integração NFS-e Nacional incompleta. Pendências: ${dynamicMissing.join(", ") || "revisar variáveis de ambiente"}.`);
  }

  return {
    environment: status.environment,
    municipalCode,
    serviceCode,
    series,
    requestTimeoutMs: Number(process.env.NFSE_NATIONAL_TIMEOUT_MS || "15000"),
    certPfxBase64,
    certPassphrase,
  };
}

export async function buildSignedDpsPayload(
  input: Omit<NfseNationalDpsBuildInput, "environment" | "municipalCode" | "serviceCode" | "series">,
  overrides?: NfseNationalIssueConfigOverrides,
) {
  const config = await getNfseNationalIssueConfig(overrides);
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

export async function issueSignedNfsePayload(xmlPayload: string, overrides?: NfseNationalIssueConfigOverrides) {
  const config = await getNfseNationalIssueConfig(overrides);
  const certificate = extractCertificateMaterialFromPfx(config.certPfxBase64, config.certPassphrase);
  const client = createNfseNationalClient({
    environment: config.environment,
    certPfxBase64: config.certPfxBase64,
    certPassphrase: config.certPassphrase,
    certificatePem: certificate.certificatePem,
    privateKeyPem: certificate.privateKeyPem,
    requestTimeoutMs: config.requestTimeoutMs,
  });

  return client.issueNfse(xmlPayload);
}

export async function testNfseNationalConnectivity(municipalCodeOverride?: string): Promise<NfseNationalConnectivityResult> {
  const status = getNfseNationalIntegrationStatus();
  const municipalCode = municipalCodeOverride?.trim() || status.municipalCode;

  if (!status.ready || !municipalCode) {
    return {
      ok: false,
      target: "parametros_municipais/{codigoMunicipio}/convenio",
      error: `Integração incompleta. Pendências: ${[...status.missing, !municipalCode ? "codigo IBGE do municipio emissor" : null].filter(Boolean).join(", ") || "NFSE_NATIONAL_ENABLED"}.`,
    };
  }

  try {
    const certPfxBase64 = await resolveCertificatePfxBase64();
    const certificate = certPfxBase64 && process.env.NFSE_NATIONAL_CERT_PASSPHRASE
      ? extractCertificateMaterialFromPfx(certPfxBase64, process.env.NFSE_NATIONAL_CERT_PASSPHRASE)
      : null;
    const client = createNfseNationalClient({
      environment: status.environment,
      certPfxBase64: certPfxBase64 || undefined,
      certPassphrase: process.env.NFSE_NATIONAL_CERT_PASSPHRASE,
      certificatePem: certificate?.certificatePem,
      privateKeyPem: certificate?.privateKeyPem,
      requestTimeoutMs: Number(process.env.NFSE_NATIONAL_TIMEOUT_MS || "15000"),
    });

    const response = await client.getMunicipalAgreement(municipalCode);

    return {
      ok: response.status >= 200 && response.status < 300,
      target: `/parametros_municipais/${municipalCode}/convenio`,
      status: response.status,
      snippet: response.body.slice(0, 280),
    };
  } catch (error) {
    return {
      ok: false,
      target: `/parametros_municipais/${municipalCode}/convenio`,
      error: error instanceof Error ? error.message : "Falha desconhecida ao testar a integração oficial.",
    };
  }
}
