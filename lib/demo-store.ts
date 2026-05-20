import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { charges, customers, nfseDocuments, orders, quotes } from "@/lib/mock-data";
import type { CompanyProfile, DemoWorkspaceData, WorkspaceProfile, WorkspaceSubscriptionProfile } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "demo-workspace.json");

const defaultWorkspace: WorkspaceProfile = {
  name: "Gestao Facil Demo",
  slug: "gestao-facil-demo",
  niche: "Servicos locais e operacao comercial enxuta",
};

const defaultCompany: CompanyProfile = {
  legalName: "LOJA ONLINE OFERTAS DO TON LTDA",
  tradeName: "Ofertas do Ton",
  document: "43.300.030/0001-26",
  city: "Joinville",
  state: "SC",
  municipalCode: "4209102",
  serviceDescription: "Digitacao e servicos administrativos com emissao fiscal assistida e automatica.",
  defaultFiscalServiceCode: "17.02",
  defaultPixKey: "43300030000126",
  defaultPaymentMessage:
    "Pagamento referente aos servicos contratados. Envie o comprovante por WhatsApp.",
  asaasAccountId: "",
  asaasWalletId: "",
  asaasUseOwnAccount: false,
  asaasSplitEnabled: false,
};

const defaultSubscription: WorkspaceSubscriptionProfile = {
  plan: "PROFESSIONAL",
  status: "TRIALING",
  billingCycle: "MONTHLY",
  trialStartedAt: "2026-05-20T12:00:00.000Z",
  trialEndsAt: "2026-06-03T12:00:00.000Z",
  notes: "Workspace demo criado em trial para demonstrar a jornada de assinatura.",
};

const defaultData: DemoWorkspaceData = {
  workspace: defaultWorkspace,
  company: defaultCompany,
  subscription: defaultSubscription,
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
    subscription: parsed.subscription ?? defaultSubscription,
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
