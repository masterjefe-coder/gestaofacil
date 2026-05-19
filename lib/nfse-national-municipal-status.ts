import * as XLSX from "xlsx";

const MONITORING_PAGE_URL = "https://www.gov.br/nfse/pt-br/municipios/monitoramento-adesoes";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type MunicipalitySpreadsheetRow = {
  Regiao?: string;
  UF?: string;
  NomeMunicipio?: string;
  CNPJ?: string;
  StatusConvenioSEFIN?: string;
  AderenteAmbienteNacional?: string;
  AderenteEmissorNacional?: string;
  AderenteMAN?: string;
  AtivoNaBase?: string;
  AtivoUltimoPeriodo?: string;
  Populacao?: string | number;
  Situação?: string;
  Publicação?: string;
  "Início de Vigência"?: string;
};

export type NfseNationalMunicipalityStatus = {
  city: string;
  state: string;
  statusConvenio: string;
  aderenteAmbienteNacional: boolean;
  aderenteEmissorNacional: boolean;
  aderenteMan: boolean;
  ativoNaBase: boolean;
  ativoUltimoPeriodo: boolean;
  publication?: string;
  startDate?: string;
  sourceUrl: string;
  checkedAt: string;
};

type MunicipalityStatusCache = {
  expiresAt: number;
  sourceUrl: string;
  rows: MunicipalitySpreadsheetRow[];
};

let municipalityStatusCache: MunicipalityStatusCache | null = null;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isYes(value: string | undefined) {
  return normalizeText(value || "") === "SIM";
}

async function resolveSpreadsheetUrl() {
  const response = await fetch(MONITORING_PAGE_URL, {
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar monitoramento oficial da NFS-e. HTTP ${response.status}.`);
  }

  const html = await response.text();
  const links = [...html.matchAll(/https:\/\/www\.gov\.br\/nfse\/pt-br\/municipios\/monitoramento-adesoes\/[^\s"'<>]+\.xlsx/giu)]
    .map((match) => match[0]);
  const match = links[0];

  if (!match) {
    throw new Error("Não foi possível localizar a planilha oficial de municípios aderentes no portal da NFS-e.");
  }

  return match;
}

async function loadMunicipalitySpreadsheet() {
  if (municipalityStatusCache && municipalityStatusCache.expiresAt > Date.now()) {
    return municipalityStatusCache;
  }

  const sourceUrl = await resolveSpreadsheetUrl();
  const response = await fetch(sourceUrl, {
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar a planilha oficial de municípios aderentes. HTTP ${response.status}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];

  if (!firstSheet) {
    throw new Error("Planilha oficial de municípios aderentes sem abas utilizáveis.");
  }

  const rows = XLSX.utils.sheet_to_json<MunicipalitySpreadsheetRow>(firstSheet, {
    defval: "",
    raw: false,
  });

  municipalityStatusCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    sourceUrl,
    rows,
  };

  return municipalityStatusCache;
}

export async function getNfseNationalMunicipalityStatus(city: string, state: string): Promise<NfseNationalMunicipalityStatus | null> {
  if (!city.trim() || !state.trim()) {
    return null;
  }

  const cache = await loadMunicipalitySpreadsheet();
  const normalizedCity = normalizeText(city);
  const normalizedState = normalizeText(state);
  const match = cache.rows.find((row) =>
    normalizeText(row.NomeMunicipio || "") === normalizedCity
    && normalizeText(row.UF || "") === normalizedState);

  if (!match) {
    return null;
  }

  return {
    city: match.NomeMunicipio || city,
    state: match.UF || state.toUpperCase(),
    statusConvenio: match.StatusConvenioSEFIN || "Não informado",
    aderenteAmbienteNacional: isYes(match.AderenteAmbienteNacional),
    aderenteEmissorNacional: isYes(match.AderenteEmissorNacional),
    aderenteMan: isYes(match.AderenteMAN),
    ativoNaBase: isYes(match.AtivoNaBase),
    ativoUltimoPeriodo: isYes(match.AtivoUltimoPeriodo),
    publication: match.Publicação || undefined,
    startDate: match["Início de Vigência"] || undefined,
    sourceUrl: cache.sourceUrl,
    checkedAt: new Date().toISOString(),
  };
}
