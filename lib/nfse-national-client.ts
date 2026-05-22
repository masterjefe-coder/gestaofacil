import https from "node:https";
import { gunzipSync, gzipSync } from "node:zlib";
import { withRetry } from "@/lib/api-retry";
import { getLogger } from "@/lib/api-logger";

const logger = getLogger({ service: "nfse-national" });

export type NfseNationalEnvironment = "production" | "restricted";

type NfseNationalClientConfig = {
  environment: NfseNationalEnvironment;
  certPfxBase64?: string;
  certPassphrase?: string;
  certificatePem?: string;
  privateKeyPem?: string;
  requestTimeoutMs: number;
};

type NfseNationalRequestInput = {
  service: "sefin" | "parametrizacao";
  method: "GET" | "POST" | "HEAD";
  path: string;
  headers?: Record<string, string>;
  body?: string;
};

export type NfseNationalResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

function encodeXmlPayload(xmlPayload: string) {
  return JSON.stringify({
    dpsXmlGZipB64: gzipSync(Buffer.from(xmlPayload, "utf8")).toString("base64"),
  });
}

export function decodeNfseXmlGZipB64(value: string) {
  return gunzipSync(Buffer.from(value, "base64")).toString("utf8");
}

const NFSE_NATIONAL_BASE_URLS = {
  restricted: {
    sefin: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
    parametrizacao: "https://adn.producaorestrita.nfse.gov.br/parametrizacao",
  },
  production: {
    sefin: "https://sefin.nfse.gov.br/SefinNacional",
    parametrizacao: "https://adn.nfse.gov.br/parametrizacao",
  },
} as const;

function getBaseUrl(environment: NfseNationalEnvironment, service: "sefin" | "parametrizacao") {
  return NFSE_NATIONAL_BASE_URLS[environment][service];
}

function toRequestUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${normalizedBase}${normalizedPath}`);
}

function buildAgent(config: NfseNationalClientConfig) {
  const hasCertificate = !!config.certPfxBase64;

  return new https.Agent({
    keepAlive: true,
    pfx: hasCertificate ? Buffer.from(config.certPfxBase64!, "base64") : undefined,
    passphrase: config.certPassphrase || undefined,
    cert: config.certificatePem,
    key: config.privateKeyPem,
  });
}

export function createNfseNationalClient(config: NfseNationalClientConfig) {
  const agent = buildAgent(config);

  async function request(input: NfseNationalRequestInput): Promise<NfseNationalResponse> {
    const requestUrl = toRequestUrl(getBaseUrl(config.environment, input.service), input.path);

    return withRetry(
      () => {
        logger.info("NFS-e National API request", {
          method: input.method,
          service: input.service,
          path: input.path,
          environment: config.environment,
        });

        const startTime = Date.now();

        return new Promise<NfseNationalResponse>((resolve, reject) => {
          const req = https.request(
            requestUrl,
            {
              method: input.method,
              agent,
              headers: input.headers,
              timeout: config.requestTimeoutMs,
            },
            (res) => {
              const chunks: Buffer[] = [];

              res.on("data", (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              });

              res.on("end", () => {
                const duration = Date.now() - startTime;
                const response = {
                  status: res.statusCode || 0,
                  headers: res.headers,
                  body: Buffer.concat(chunks).toString("utf8"),
                };

                if (res.statusCode && res.statusCode >= 400) {
                  logger.error("NFS-e National API request failed", undefined, {
                    status: res.statusCode,
                    duration,
                  });
                } else {
                  logger.info("NFS-e National API request successful", {
                    status: res.statusCode,
                    duration,
                  });
                }

                resolve(response);
              });
            },
          );

          req.on("timeout", () => {
            req.destroy(new Error("Tempo esgotado ao chamar a API nacional da NFS-e."));
          });

          req.on("error", (error) => {
            const duration = Date.now() - startTime;
            logger.error("NFS-e National API request error", error, { duration });
            reject(error);
          });

          if (input.body) {
            req.write(input.body);
          }

          req.end();
        });
      },
      {
        maxAttempts: 3,
        initialDelayMs: 2000,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      }
    );
  }

  return {
    request,
    getMunicipalAgreement(codigoMunicipio: string) {
      return request({
        service: "parametrizacao",
        method: "GET",
        path: `/parametros_municipais/${codigoMunicipio}/convenio`,
        headers: {
          Accept: "application/json, application/xml, text/plain;q=0.9, */*;q=0.8",
        },
      });
    },
    getNfseByAccessKey(chaveAcesso: string) {
      return request({
        service: "sefin",
        method: "GET",
        path: `/nfse/${encodeURIComponent(chaveAcesso)}`,
        headers: {
          Accept: "application/xml, text/xml, application/json;q=0.9, */*;q=0.8",
        },
      });
    },
    getDpsById(dpsId: string) {
      return request({
        service: "sefin",
        method: "GET",
        path: `/dps/${encodeURIComponent(dpsId)}`,
        headers: {
          Accept: "application/xml, text/xml, application/json;q=0.9, */*;q=0.8",
        },
      });
    },
    issueNfse(xmlPayload: string) {
      return request({
        service: "sefin",
        method: "POST",
        path: "/nfse",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json, */*;q=0.8",
        },
        body: encodeXmlPayload(xmlPayload),
      });
    },
  };
}
