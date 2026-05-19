import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

export type NfseNationalSubject = {
  name: string;
  document: string;
  city?: string;
  state?: string;
};

export type NfseNationalDpsBuildInput = {
  environment: "production" | "restricted";
  municipalCode: string;
  serviceCode: string;
  serviceDescription: string;
  serviceAmount: number;
  issuer: NfseNationalSubject;
  customer: NfseNationalSubject;
  series: string;
  number: string;
  competenceDate: Date;
  issueDate: Date;
};

type CertificateMaterial = {
  privateKeyPem: string;
  certificatePem: string;
};

const NFSE_NAMESPACE = "http://www.sped.fazenda.gov.br/nfse";
const XMLDSIG_NAMESPACE = "http://www.w3.org/2000/09/xmldsig#";

function stripNonDigits(value: string) {
  return value.replace(/\D/g, "");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateOnly(value: Date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(value);
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

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}-03:00`;
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function normalizeSeries(value: string) {
  return stripNonDigits(value).padStart(5, "0").slice(-5);
}

function normalizeNumber(value: string) {
  return stripNonDigits(value).padStart(15, "0").slice(-15);
}

function formatDpsNumberValue(value: string) {
  const digits = stripNonDigits(value).replace(/^0+/, "");
  return digits || "1";
}

function normalizeMunicipalCode(value: string) {
  return stripNonDigits(value).padStart(7, "0").slice(-7);
}

function normalizeNationalServiceCode(value: string) {
  const digits = stripNonDigits(value);

  if (digits.length === 6) {
    return digits;
  }

  if (digits.length === 4) {
    return `${digits}01`;
  }

  throw new Error("Codigo nacional do servico invalido para a NFS-e Nacional. Use 6 digitos ou um subitem no formato 00.00.");
}

function inferDocumentType(value: string) {
  const digits = stripNonDigits(value);

  if (digits.length === 11) {
    return { type: "1" as const, digits };
  }

  if (digits.length === 14) {
    return { type: "2" as const, digits };
  }

  return null;
}

function normalizeIdDocument(value: string) {
  const normalized = inferDocumentType(value);

  if (!normalized) {
    throw new Error("Documento fiscal deve conter 11 ou 14 dígitos.");
  }

  return normalized.type === "1"
    ? normalized.digits.padStart(14, "0")
    : normalized.digits;
}

function formatPartyDocumentXml(tagPrefix: "Prest" | "Toma", value: string) {
  const normalized = inferDocumentType(value);

  if (!normalized) {
    throw new Error(`Documento de ${tagPrefix === "Prest" ? "prestador" : "tomador"} inválido para NFS-e Nacional.`);
  }

  if (normalized.type === "1") {
    return `<${tagPrefix === "Prest" ? "CPF" : "CPF"}>${normalized.digits}</${tagPrefix === "Prest" ? "CPF" : "CPF"}>`;
  }

  return `<${tagPrefix === "Prest" ? "CNPJ" : "CNPJ"}>${normalized.digits}</${tagPrefix === "Prest" ? "CNPJ" : "CNPJ"}>`;
}

function buildDpsId(input: NfseNationalDpsBuildInput) {
  const municipalCode = normalizeMunicipalCode(input.municipalCode);
  const docType = inferDocumentType(input.issuer.document);

  if (!docType) {
    throw new Error("Documento do emitente inválido para composição do identificador DPS.");
  }

  return `DPS${municipalCode}${docType.type}${normalizeIdDocument(input.issuer.document)}${normalizeSeries(input.series)}${normalizeNumber(input.number)}`;
}

function buildUnsignedDpsXml(input: NfseNationalDpsBuildInput) {
  const dpsId = buildDpsId(input);
  const municipalCode = normalizeMunicipalCode(input.municipalCode);
  const issueDate = formatDateTime(input.issueDate);
  const competenceDate = formatDateOnly(input.competenceDate);
  const amount = formatAmount(input.serviceAmount);
  const serviceCode = normalizeNationalServiceCode(input.serviceCode);
  const environmentCode = input.environment === "production" ? "1" : "2";
  const appVersion = "gfacil_0.1.0";

  const issuerName = escapeXml(input.issuer.name);
  const customerName = escapeXml(input.customer.name);
  const serviceDescription = escapeXml(input.serviceDescription);

  return {
    dpsId,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="${NFSE_NAMESPACE}" versao="1.00">
  <infDPS Id="${dpsId}">
    <tpAmb>${environmentCode}</tpAmb>
    <dhEmi>${issueDate}</dhEmi>
    <verAplic>${appVersion}</verAplic>
    <serie>${normalizeSeries(input.series)}</serie>
    <nDPS>${formatDpsNumberValue(input.number)}</nDPS>
    <dCompet>${competenceDate}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${municipalCode}</cLocEmi>
    <prest>
      ${formatPartyDocumentXml("Prest", input.issuer.document)}
      <xNome>${issuerName}</xNome>
      <regTrib>
        <opSimpNac>3</opSimpNac>
        <regApTribSN>1</regApTribSN>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${formatPartyDocumentXml("Toma", input.customer.document)}
      <xNome>${customerName}</xNome>
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${municipalCode}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${serviceCode}</cTribNac>
        <xDescServ>${serviceDescription}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${amount}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`,
  };
}

function pemFromForgeKey(privateKey: forge.pki.PrivateKey) {
  return forge.pki.privateKeyToPem(privateKey);
}

function pemFromForgeCert(certificate: forge.pki.Certificate) {
  return forge.pki.certificateToPem(certificate);
}

export function extractCertificateMaterialFromPfx(certPfxBase64: string, certPassphrase: string): CertificateMaterial {
  const der = forge.util.decode64(certPfxBase64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, certPassphrase);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];

  const privateKey = keyBags[0]?.key;
  const certificate = certBags[0]?.cert;

  if (!privateKey || !certificate) {
    throw new Error("Não foi possível extrair chave privada e certificado do PFX da NFS-e Nacional.");
  }

  return {
    privateKeyPem: pemFromForgeKey(privateKey),
    certificatePem: pemFromForgeCert(certificate),
  };
}

export function buildSignedNfseNationalDpsXml(
  input: NfseNationalDpsBuildInput,
  certificate: CertificateMaterial,
) {
  const unsigned = buildUnsignedDpsXml(input);
  const document = new DOMParser().parseFromString(unsigned.xml, "application/xml");
  const signature = new SignedXml({
    privateKey: certificate.privateKeyPem,
    publicCert: certificate.certificatePem,
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  });

  signature.addReference({
    xpath: "//*[local-name(.)='infDPS']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });
  (signature as SignedXml & {
    keyInfoProvider: {
      getKeyInfo: () => string;
      getKey: () => string;
    };
  }).keyInfoProvider = {
    getKeyInfo: () =>
      `<X509Data xmlns="${XMLDSIG_NAMESPACE}"><X509Certificate>${certificate.certificatePem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\r?\n/g, "")}</X509Certificate></X509Data>`,
    getKey: () => certificate.privateKeyPem,
  };
  signature.computeSignature(unsigned.xml, {
    location: {
      reference: "//*[local-name(.)='infDPS']",
      action: "after",
    },
  });

  const signedXml = signature.getSignedXml();
  const digest = createHash("sha256").update(signedXml).digest("hex");

  return {
    dpsId: unsigned.dpsId,
    xml: signedXml,
    digest,
    xmlDocument: document,
  };
}
