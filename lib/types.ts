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
  serviceDescription: string;
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
  document?: string;
  segment: string;
  city: string;
  status: Customer["status"];
  note: string;
};

export type Quote = {
  id: string;
  customer: string;
  title: string;
  amount: string;
  status: "Enviado" | "Aprovado" | "Follow-up";
  dueLabel: string;
  summary: string;
};

export type QuoteInput = {
  customer: string;
  title: string;
  amount: string;
  status: Quote["status"];
  dueLabel: string;
  summary: string;
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

export type Charge = {
  id: string;
  customer: string;
  amount: string;
  dueLabel: string;
  dueDate?: string;
  status: "Pendente" | "Hoje" | "Pago";
  source: string;
  followUps: ChargeFollowUpEntry[];
};

export type ChargeInput = {
  customer: string;
  amount: string;
  dueLabel: string;
  dueDate?: string;
  status: Charge["status"];
  source: string;
};

export type NfseDocument = {
  id: string;
  customer: string;
  orderId: string;
  serviceAmount: string;
  status: "Rascunho" | "Pronta" | "Emitida" | "Erro" | "Cancelada";
  serviceDescription: string;
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
