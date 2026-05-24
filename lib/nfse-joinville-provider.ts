import https from "node:https";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { withRetry } from "@/lib/api-retry";
import { getLogger, summarizeExternalErrorDetails } from "@/lib/api-logger";
import { extractCertificateMaterialFromPfx } from "@/lib/nfse-national-xml";

const logger = getLogger({ service: "nfse-joinville" });

export type NfseJoinvilleEnvironment = "production" | "homologation";

export type NfseJoinvilleIntegrationStatus = {
  enabled: boolean;
  environment: NfseJoinvilleEnvironment;
  municipalRegistration?: string;
  series: string;
  hasCertificate: boolean;
  certificateSource?: "base64" | "path";
  ready: boolean;
  missing: string[];
  helper: string;
};

export type NfseJoinvilleConnectivityResult = {
  ok: boolean;
  target: string;
  status?: number;
  snippet?: string;
  error?: string;
};

export type NfseJoinvilleIssueConfig = {
  environment: NfseJoinvilleEnvironment;
  municipalRegistration: string;
  series: string;
  rpsType: string;
  natureOperation: string;
  simpleNationalOption: string;
  culturalIncentive: string;
  withheldIss: string;
  requestTimeoutMs: number;
  certPfxBase64: string;
  certPassphrase: string;
};

type NfseJoinvilleIssueConfigOverrides = {
  municipalRegistration?: string;
  series?: string;
};

type NfseJoinvilleSubject = {
  name: string;
  document: string;
  city?: string;
  state?: string;
  postalCode?: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  complement?: string;
};

export type NfseJoinvilleRpsBuildInput = {
  municipalCode: string;
  serviceCode: string;
  serviceDescription: string;
  serviceAmount: number;
  issuer: NfseJoinvilleSubject;
  customer: NfseJoinvilleSubject;
  number: string;
  issueDate: Date;
};

export type NfseJoinvilleIssueResult = {
  number?: string;
  verificationCode?: string;
  issuedAt?: string;
  rawResponseXml: string;
};

const JOINVILLE_BASE_URLS = {
  production: {
    services: "https://nfem.joinville.sc.gov.br/nfse_integracao/Services",
    consultas: "https://nfem.joinville.sc.gov.br/nfse_integracao/Consultas",
    integracao: "https://nfem.joinville.sc.gov.br/nfse_integracao/Integracao",
    portal: "https://nfem.joinville.sc.gov.br/",
  },
  homologation: {
    services: "https://nfsehomologacao.joinville.sc.gov.br/nfse_integracao/Services",
    consultas: "https://nfsehomologacao.joinville.sc.gov.br/nfse_integracao/Consultas",
    integracao: "https://nfsehomologacao.joinville.sc.gov.br/nfse_integracao/Integracao",
    portal: "https://nfsehomologacao.joinville.sc.gov.br/",
  },
} as const;

function normalizeEnvironment(value: string | undefined): NfseJoinvilleEnvironment {
  return value === "homologation" ? "homologation" : "production";
}

function stripNonDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeSeries(value: string) {
  const digits = stripNonDigits(value);
  return digits || "3000";
}

function normalizeRpsNumber(value: string) {
  return stripNonDigits(value).slice(-15) || `${Date.now()}`.slice(-15);
}

function formatDateTime(value: Date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "00";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDocumentXml(value: string) {
  const digits = stripNonDigits(value);

  if (digits.length === 11) {
    return `<CpfCnpj><Cpf>${digits}</Cpf></CpfCnpj>`;
  }

  if (digits.length === 14) {
    return `<CpfCnpj><Cnpj>${digits}</Cnpj></CpfCnpj>`;
  }

  throw new Error("Documento fiscal do tomador deve conter 11 ou 14 dígitos para Joinville.");
}

function buildSoapEnvelope(operation: string, argumentName: string, payload: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.nfse.integracao.ws.publica/">`
    + `<soapenv:Header/>`
    + `<soapenv:Body>`
    + `<ser:${operation}>`
    + `<${argumentName}>${escapeXml(payload)}</${argumentName}>`
    + `</ser:${operation}>`
    + `</soapenv:Body>`
    + `</soapenv:Envelope>`;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractSoapReturn(body: string) {
  const match = body.match(/<return>([\s\S]*?)<\/return>/i);

  if (!match?.[1]) {
    return body;
  }

  return decodeXmlEntities(match[1].trim());
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
  const certPfxBase64 = readChunkedEnv("NFSE_JOINVILLE_CERT_PFX_BASE64") || readChunkedEnv("NFSE_NATIONAL_CERT_PFX_BASE64");
  const certPfxPath = process.env.NFSE_JOINVILLE_CERT_PFX_PATH?.trim() || process.env.NFSE_NATIONAL_CERT_PFX_PATH?.trim();

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

function buildAgent() {
  return new https.Agent({
    keepAlive: true,
  });
}

async function postSoapRequest(url: string, operation: string, argumentName: string, payload: string, timeoutMs: number) {
  const envelope = buildSoapEnvelope(operation, argumentName, payload);

  return withRetry(
    () =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        logger.info("Joinville NF-em SOAP request", {
          operation,
          url,
        });

        const startTime = Date.now();
        const req = https.request(
          url,
          {
            method: "POST",
            agent: buildAgent(),
            headers: {
              "Content-Type": "text/xml; charset=utf-8",
              Accept: "text/xml, application/xml;q=0.9, */*;q=0.8",
              SOAPAction: "\"\"",
            },
            timeout: timeoutMs,
          },
          (res) => {
            const chunks: Buffer[] = [];

            res.on("data", (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });

            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              const duration = Date.now() - startTime;
              const detailSummary = summarizeExternalErrorDetails(body);

              if ((res.statusCode || 0) >= 400) {
                logger.error("Joinville NF-em SOAP request failed", undefined, {
                  operation,
                  status: res.statusCode || 0,
                  duration,
                  detailSummary,
                });
              } else {
                logger.info("Joinville NF-em SOAP request successful", {
                  operation,
                  status: res.statusCode || 0,
                  duration,
                });
              }

              resolve({
                status: res.statusCode || 0,
                body,
              });
            });
          },
        );

        req.on("timeout", () => {
          req.destroy(new Error("Tempo esgotado ao chamar o webservice municipal de Joinville."));
        });

        req.on("error", (error) => {
          logger.error("Joinville NF-em SOAP request error", error);
          reject(error);
        });

        req.write(envelope);
        req.end();
      }),
    {
      telemetryKey: `joinville-nfse-${operation.toLowerCase()}`,
      maxAttempts: 2,
      initialDelayMs: 1500,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
  );
}

function parseIssuedNfseXml(xml: string): NfseJoinvilleIssueResult {
  const number = xml.match(/<Numero>([^<]+)<\/Numero>/i)?.[1]?.trim();
  const verificationCode = xml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i)?.[1]?.trim();
  const issuedAt = xml.match(/<DataEmissao>([^<]+)<\/DataEmissao>/i)?.[1]?.trim();

  return {
    number,
    verificationCode,
    issuedAt,
    rawResponseXml: xml,
  };
}

export function getNfseJoinvillePortalUrls() {
  const environment = normalizeEnvironment(process.env.NFSE_JOINVILLE_ENVIRONMENT?.trim());
  const base = JOINVILLE_BASE_URLS[environment].portal;

  return {
    loginUrl: base,
    issueUrl: base,
  };
}

export function getNfseJoinvilleIntegrationStatus(): NfseJoinvilleIntegrationStatus {
  const enabled = process.env.NFSE_JOINVILLE_ENABLED?.trim().toLowerCase() === "true";
  const environment = normalizeEnvironment(process.env.NFSE_JOINVILLE_ENVIRONMENT?.trim());
  const municipalRegistration = process.env.NFSE_JOINVILLE_MUNICIPAL_REGISTRATION?.trim();
  const certificate = getCertificateSource();
  const certPassphrase = process.env.NFSE_JOINVILLE_CERT_PASSPHRASE?.trim() || process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim();
  const series = normalizeSeries(process.env.NFSE_JOINVILLE_RPS_SERIES?.trim() || "3000");

  const missing = [
    !enabled ? "NFSE_JOINVILLE_ENABLED" : null,
    !municipalRegistration ? "NFSE_JOINVILLE_MUNICIPAL_REGISTRATION" : null,
    !certificate ? "NFSE_JOINVILLE_CERT_PFX_BASE64 ou NFSE_JOINVILLE_CERT_PFX_PATH" : null,
    !certPassphrase ? "NFSE_JOINVILLE_CERT_PASSPHRASE" : null,
  ].filter((item): item is string => !!item);

  return {
    enabled,
    environment,
    municipalRegistration,
    series,
    hasCertificate: !!certificate,
    certificateSource: certificate?.source,
    ready: enabled && missing.length === 0,
    missing,
    helper:
      enabled && missing.length === 0
        ? "Provider municipal de Joinville configurado para emissão automática via NF-em."
        : "Faltam variáveis de ambiente para operar o provider municipal de Joinville.",
  };
}

export async function getNfseJoinvilleIssueConfig(
  overrides?: NfseJoinvilleIssueConfigOverrides,
): Promise<NfseJoinvilleIssueConfig> {
  const status = getNfseJoinvilleIntegrationStatus();
  const certPassphrase = process.env.NFSE_JOINVILLE_CERT_PASSPHRASE?.trim() || process.env.NFSE_NATIONAL_CERT_PASSPHRASE?.trim();
  const certPfxBase64 = await resolveCertificatePfxBase64();
  const municipalRegistration = overrides?.municipalRegistration?.trim() || status.municipalRegistration;
  const series = normalizeSeries(overrides?.series?.trim() || status.series);

  if (!status.ready || !municipalRegistration || !certPfxBase64 || !certPassphrase) {
    throw new Error(`Integração municipal de Joinville incompleta. Pendências: ${[
      ...status.missing,
      !municipalRegistration ? "inscricao municipal" : null,
    ].filter(Boolean).join(", ") || "revisar variáveis de ambiente"}.`);
  }

  return {
    environment: status.environment,
    municipalRegistration,
    series,
    rpsType: process.env.NFSE_JOINVILLE_RPS_TYPE?.trim() || "1",
    natureOperation: process.env.NFSE_JOINVILLE_NATUREZA_OPERACAO?.trim() || "1",
    simpleNationalOption: process.env.NFSE_JOINVILLE_OPTANTE_SIMPLES?.trim() || "1",
    culturalIncentive: process.env.NFSE_JOINVILLE_INCENTIVADOR_CULTURAL?.trim() || "2",
    withheldIss: process.env.NFSE_JOINVILLE_ISS_RETIDO?.trim() || "2",
    requestTimeoutMs: Number(process.env.NFSE_JOINVILLE_TIMEOUT_MS || "15000"),
    certPfxBase64,
    certPassphrase,
  };
}

export async function testNfseJoinvilleConnectivity(): Promise<NfseJoinvilleConnectivityResult> {
  const status = getNfseJoinvilleIntegrationStatus();
  const endpoint = `${JOINVILLE_BASE_URLS[status.environment].services}?wsdl`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(Number(process.env.NFSE_JOINVILLE_TIMEOUT_MS || "15000")),
    });
    const body = await response.text();

    return {
      ok: response.ok && body.includes("RecepcionarLoteRps"),
      target: endpoint,
      status: response.status,
      snippet: body.slice(0, 280),
    };
  } catch (error) {
    return {
      ok: false,
      target: endpoint,
      error: error instanceof Error ? error.message : "Falha desconhecida ao consultar o WSDL de Joinville.",
    };
  }
}

export async function buildSignedJoinvilleRpsXml(
  input: NfseJoinvilleRpsBuildInput,
  overrides?: NfseJoinvilleIssueConfigOverrides,
) {
  const config = await getNfseJoinvilleIssueConfig(overrides);
  const certificate = extractCertificateMaterialFromPfx(config.certPfxBase64, config.certPassphrase);
  const timestamp = input.issueDate;
  const documentId = `GFJOINVILLE_${normalizeRpsNumber(input.number)}`;
  const rpsNumber = normalizeRpsNumber(input.number);
  const providerDocument = stripNonDigits(input.issuer.document);
  const customerName = escapeXml(input.customer.name);
  const customerStreet = escapeXml(input.customer.street || "NAO INFORMADO");
  const customerNumber = escapeXml(input.customer.number || "S/N");
  const customerNeighborhood = escapeXml(input.customer.neighborhood || "CENTRO");
  const customerCityCode = stripNonDigits(input.municipalCode).padStart(7, "0").slice(-7);
  const customerState = escapeXml((input.customer.state || input.issuer.state || "SC").toUpperCase());
  const customerPostalCode = stripNonDigits(input.customer.postalCode || "").slice(0, 8);
  const customerCity = escapeXml(input.customer.city || "JOINVILLE");
  const customerComplement = input.customer.complement ? `<Complemento>${escapeXml(input.customer.complement)}</Complemento>` : "";
  const discriminacao = escapeXml(input.serviceDescription);
  const serviceCode = escapeXml(input.serviceCode);
  const amount = formatAmount(input.serviceAmount);
  const municipalCode = stripNonDigits(input.municipalCode).padStart(7, "0").slice(-7);

  const unsignedXml = `<?xml version="1.0" encoding="UTF-8"?>`
    + `<GerarNfseEnvio xmlns="http://www.publica.inf.br">`
    + `<Rps>`
    + `<InfRps id="${documentId}">`
    + `<IdentificacaoRps>`
    + `<Numero>${rpsNumber}</Numero>`
    + `<Serie>${config.series}</Serie>`
    + `<Tipo>${config.rpsType}</Tipo>`
    + `</IdentificacaoRps>`
    + `<DataEmissao>${formatDateTime(timestamp)}</DataEmissao>`
    + `<NaturezaOperacao>${config.natureOperation}</NaturezaOperacao>`
    + `<OptanteSimplesNacional>${config.simpleNationalOption}</OptanteSimplesNacional>`
    + `<IncentivadorCultural>${config.culturalIncentive}</IncentivadorCultural>`
    + `<Status>1</Status>`
    + `<Servico>`
    + `<Valores>`
    + `<ValorServicos>${amount}</ValorServicos>`
    + `<IssRetido>${config.withheldIss}</IssRetido>`
    + `</Valores>`
    + `<ItemListaServico>${serviceCode}</ItemListaServico>`
    + `<Discriminacao>${discriminacao}</Discriminacao>`
    + `<CodigoMunicipio>${municipalCode}</CodigoMunicipio>`
    + `</Servico>`
    + `<Prestador>`
    + `<Cnpj>${providerDocument}</Cnpj>`
    + `<InscricaoMunicipal>${escapeXml(config.municipalRegistration)}</InscricaoMunicipal>`
    + `</Prestador>`
    + `<Tomador>`
    + `<IdentificacaoTomador>${formatDocumentXml(input.customer.document)}</IdentificacaoTomador>`
    + `<RazaoSocial>${customerName}</RazaoSocial>`
    + `<Endereco>`
    + `<Endereco>${customerStreet}</Endereco>`
    + `<Numero>${customerNumber}</Numero>`
    + customerComplement
    + `<Bairro>${customerNeighborhood}</Bairro>`
    + `<CodigoMunicipio>${customerCityCode}</CodigoMunicipio>`
    + `<Uf>${customerState}</Uf>`
    + (customerPostalCode ? `<Cep>${customerPostalCode}</Cep>` : "")
    + `<Municipio>${customerCity}</Municipio>`
    + `</Endereco>`
    + `</Tomador>`
    + `</InfRps>`
    + `</Rps>`
    + `</GerarNfseEnvio>`;

  const signature = new SignedXml({
    privateKey: certificate.privateKeyPem,
    publicCert: certificate.certificatePem,
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
  });

  signature.addReference({
    xpath: "//*[local-name(.)='InfRps']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });

  (signature as SignedXml & {
    keyInfoProvider: {
      getKeyInfo: () => string;
      getKey: () => string;
    };
  }).keyInfoProvider = {
    getKeyInfo: () =>
      `<X509Data xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Certificate>${certificate.certificatePem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\r?\n/g, "")}</X509Certificate></X509Data>`,
    getKey: () => certificate.privateKeyPem,
  };

  signature.computeSignature(unsignedXml, {
    location: {
      reference: "//*[local-name(.)='InfRps']",
      action: "after",
    },
  });

  return {
    documentId,
    xml: signature.getSignedXml(),
    digest: crypto.createHash("sha256").update(signature.getSignedXml()).digest("hex"),
    xmlDocument: new DOMParser().parseFromString(unsignedXml, "application/xml"),
  };
}

export async function issueJoinvilleRps(
  input: NfseJoinvilleRpsBuildInput,
  overrides?: NfseJoinvilleIssueConfigOverrides,
): Promise<NfseJoinvilleIssueResult> {
  const config = await getNfseJoinvilleIssueConfig(overrides);
  const signed = await buildSignedJoinvilleRpsXml(input, overrides);
  const endpoint = JOINVILLE_BASE_URLS[config.environment].services;
  const response = await postSoapRequest(endpoint, "GerarNfse", "XML", signed.xml, config.requestTimeoutMs);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`NF-em Joinville recusou a emissão. HTTP ${response.status}. ${summarizeExternalErrorDetails(response.body) || endpoint}`);
  }

  const returnedXml = extractSoapReturn(response.body);
  const parsed = parseIssuedNfseXml(returnedXml);

  if (!parsed.number || !parsed.verificationCode) {
    throw new Error(`NF-em Joinville respondeu sem número/código de verificação. ${summarizeExternalErrorDetails(returnedXml) || returnedXml.slice(0, 180)}`);
  }

  return parsed;
}
