import https from "node:https";

export type NfseNationalEnvironment = "production" | "restricted";

type NfseNationalClientConfig = {
  environment: NfseNationalEnvironment;
  certPfxBase64?: string;
  certPassphrase?: string;
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

const NFSE_NATIONAL_BASE_URLS = {
  restricted: {
    sefin: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional",
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
  });
}

export function createNfseNationalClient(config: NfseNationalClientConfig) {
  const agent = buildAgent(config);

  async function request(input: NfseNationalRequestInput): Promise<NfseNationalResponse> {
    const requestUrl = toRequestUrl(getBaseUrl(config.environment, input.service), input.path);

    return new Promise((resolve, reject) => {
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
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy(new Error("Tempo esgotado ao chamar a API nacional da NFS-e."));
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (input.body) {
        req.write(input.body);
      }

      req.end();
    });
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
          "Content-Type": "application/xml; charset=utf-8",
          Accept: "application/xml, text/xml, application/json;q=0.9, */*;q=0.8",
        },
        body: xmlPayload,
      });
    },
  };
}
