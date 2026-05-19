import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { charges, customers, nfseDocuments, orders, quotes } from "@/lib/mock-data";
import type { CompanyProfile, DemoWorkspaceData, WorkspaceProfile } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "demo-workspace.json");

const defaultWorkspace: WorkspaceProfile = {
  name: "Gestao Facil Demo",
  slug: "gestao-facil-demo",
  niche: "Servicos locais e operacao comercial enxuta",
};

const defaultCompany: CompanyProfile = {
  legalName: "Gestao Facil Servicos Digitais LTDA",
  tradeName: "Gestao Facil",
  document: "12.345.678/0001-90",
  city: "Belo Horizonte",
  state: "MG",
  serviceDescription: "Operacao comercial, cobranca e emissao para pequenos negocios de servico.",
  defaultPixKey: "financeiro@gestaofacil.local",
  defaultPaymentMessage:
    "Pagamento referente ao servico contratado. Envie o comprovante por WhatsApp.",
};

const defaultData: DemoWorkspaceData = {
  workspace: defaultWorkspace,
  company: defaultCompany,
  customers,
  quotes,
  orders,
  charges,
  nfseDocuments,
};

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, JSON.stringify(defaultData, null, 2), "utf8");
  }
}

export async function readDemoWorkspaceData() {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<DemoWorkspaceData>;

  return {
    workspace: parsed.workspace ?? defaultWorkspace,
    company: parsed.company ?? defaultCompany,
    customers: parsed.customers ?? customers,
    quotes: parsed.quotes ?? quotes,
    orders: parsed.orders ?? orders,
    charges: parsed.charges ?? charges,
    nfseDocuments: parsed.nfseDocuments ?? nfseDocuments,
  } satisfies DemoWorkspaceData;
}

export async function writeDemoWorkspaceData(data: DemoWorkspaceData) {
  await ensureStore();
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}
