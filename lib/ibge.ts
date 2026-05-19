type IbgeMunicipalityLookupResult = {
  city: string;
  state: string;
  municipalCode: string;
  source: "static" | "ibge-api";
};

const STATIC_IBGE_CITY_CODES: Record<string, string> = {
  "joinville/sc": "4209102",
  "belo horizonte/mg": "3106200",
  "sao paulo/sp": "3550308",
  "campinas/sp": "3509502",
  "curitiba/pr": "4106902",
};

function normalizeCity(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeState(value: string) {
  return value.trim().toLowerCase();
}

function buildKey(city: string, state: string) {
  return `${normalizeCity(city)}/${normalizeState(state)}`;
}

export async function resolveIbgeMunicipalityCode(city: string, state: string): Promise<IbgeMunicipalityLookupResult | null> {
  const normalizedCity = normalizeCity(city);
  const normalizedState = normalizeState(state);

  if (!normalizedCity || !normalizedState) {
    return null;
  }

  const staticMatch = STATIC_IBGE_CITY_CODES[buildKey(city, state)];

  if (staticMatch) {
    return {
      city,
      state: state.toUpperCase(),
      municipalCode: staticMatch,
      source: "static",
    };
  }

  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state.toUpperCase())}/municipios`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as Array<{ id: number; nome: string }>;
    const municipality = data.find((item) => normalizeCity(item.nome) === normalizedCity);

    if (!municipality) {
      return null;
    }

    return {
      city: municipality.nome,
      state: state.toUpperCase(),
      municipalCode: String(municipality.id),
      source: "ibge-api",
    };
  } catch {
    return null;
  }
}
