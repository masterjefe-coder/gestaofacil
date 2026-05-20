export type NavItem = {
  href: string;
  label: string;
  helper: string;
};

export type WorkspaceProfile = {
  name: string;
  slug: string;
  niche: string;
};

export type CompanyProfile = {
  legalName: string;
  tradeName: string;
  document: string;
  city: string;
  state: string;
  municipalCode?: string;
  serviceDescription: string;
  defaultFiscalServiceCode?: string;
  defaultPixKey: string;
  defaultPaymentMessage: string;
};

export type SetupInput = WorkspaceProfile & CompanyProfile;

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  isCurrentUser?: boolean;
};

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
  summary: string;
};

export type Stat = {
  label: string;
  value: string;
  helper: string;
};

export type OpportunityStage = "Nova" | "Orcamento" | "Execucao";

export type PipelineItem = {
  title: string;
  subtitle: string;
  meta: string;
};

export type PipelineColumn = {
  title: string;
  total: string;
  items: PipelineItem[];
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  document?: string;
  segment: string;
  city: string;
  status: "Ativo" | "Aguardando retorno" | "Recorrente";
  lastSale: string;
  openAmount: string;
  note: string;
};

export type CustomerInput = {
  name: string;
  phone?: string;
  document?: string;
  segment: string;
  city: string;
  status: Customer["status"];
  note: string;
};

export type CustomerWhatsappActivity = {
  customerId: string;
  customerName: string;
  phone?: string;
  lastEventAt?: string;
  lastEventSummary?: string;
  eventCount: number;
};

export type EntityCadenceState = {
  cadenceLabel: string;
  executionLabel: string;
  completedStepLabel: string;
  nextStepLabel: string;
};

export type Quote = {
  id: string;
  customer: string;
  title: string;
  amount: string;
  status: "Enviado" | "Aprovado" | "Follow-up";
  dueLabel: string;
  summary: string;
  cadence?: EntityCadenceState;
};

export type QuoteInput = {
  customer: string;
  title: string;
  amount: string;
  status: Quote["status"];
  dueLabel: string;
  summary: string;
  cadence?: EntityCadenceState;
};

export type Order = {
  id: string;
  customer: string;
  title: string;
  amount: string;
  status: "Pendente" | "Agendado" | "Em execucao" | "Concluido";
  sourceQuoteId: string;
  note: string;
};

export type ChargeFollowUpChannel = "WhatsApp" | "Ligacao" | "Email" | "Pix reenviado";

export type ChargeFollowUpOutcome =
  | "Sem resposta"
  | "Prometeu pagar"
  | "Pago em analise"
  | "Reagendado"
  | "Contestou";

export type ChargeFollowUpEntry = {
  id: string;
  createdAt: string;
  channel: ChargeFollowUpChannel;
  outcome: ChargeFollowUpOutcome;
  note: string;
};

export type ExternalChargeProvider = "Asaas";

export type ExternalChargeBilling = {
  provider: ExternalChargeProvider;
  environment: "sandbox" | "production";
  customerId?: string;
  paymentId?: string;
  billingType?: "PIX" | "UNDEFINED" | "BOLETO";
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
  pixExpirationDate?: string;
};

export type Charge = {
  id: string;
  customer: string;
  amount: string;
  dueLabel: string;
  dueDate?: string;
  status: "Pendente" | "Hoje" | "Pago";
  source: string;
  paymentLink?: string;
  followUps: ChargeFollowUpEntry[];
  cadence?: EntityCadenceState;
  externalBilling?: ExternalChargeBilling;
};

export type ChargeInput = {
  customer: string;
  amount: string;
  dueLabel: string;
  dueDate?: string;
  status: Charge["status"];
  source: string;
  paymentLink?: string;
  cadence?: EntityCadenceState;
  externalBilling?: ExternalChargeBilling;
};

export type NfseDocument = {
  id: string;
  customer: string;
  orderId: string;
  serviceAmount: string;
  status: "Rascunho" | "Pronta" | "Emitida" | "Erro" | "Cancelada";
  serviceDescription: string;
  serviceCode?: string;
  verificationCode?: string;
  externalId?: string;
  issuedAt?: string;
  errorMessage?: string;
};

export type DemoWorkspaceData = {
  workspace: WorkspaceProfile;
  company: CompanyProfile;
  customers: Customer[];
  quotes: Quote[];
  orders: Order[];
  charges: Charge[];
  nfseDocuments: NfseDocument[];
};
