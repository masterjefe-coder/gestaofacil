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

export type SubscriptionPlanCode = "ESSENTIAL" | "PROFESSIONAL" | "OPERATION" | "ENTERPRISE";
export type SubscriptionStatusCode = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";
export type SubscriptionBillingCycleCode = "MONTHLY" | "YEARLY";

export type WorkspaceSubscriptionProfile = {
  plan: SubscriptionPlanCode;
  status: SubscriptionStatusCode;
  billingCycle: SubscriptionBillingCycleCode;
  trialStartedAt?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  asaasPaymentLink?: string;
  externalReference?: string;
  notes?: string;
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
  asaasApiKey?: string;
  asaasAccountId?: string;
  asaasWalletId?: string;
  asaasUseOwnAccount?: boolean;
  asaasSplitEnabled?: boolean;
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

export type WorkspaceInviteStatus = "Pendente" | "Aceito" | "Revogado" | "Expirado";
export type WorkspaceInviteDeliveryStatus = "Enviado" | "Pendente" | "Falhou";

export type WorkspaceInviteSummary = {
  id: string;
  email: string;
  name?: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: WorkspaceInviteStatus;
  deliveryStatus: WorkspaceInviteDeliveryStatus;
  expiresAt: string;
  inviteUrl?: string;
  lastSentAt?: string;
  lastDeliveryError?: string;
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

export type WorkspaceUserAlertPreferences = {
  showOperationalAlerts: boolean;
  showNotificationCenter: boolean;
  emailOnInviteAccepted: boolean;
  emailOnSecurityAlerts: boolean;
};

export type WorkspaceAccessEventTone = "neutral" | "warning" | "positive";

export type WorkspaceAccessEvent = {
  id: string;
  title: string;
  summary: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
  tone: WorkspaceAccessEventTone;
  deviceLabel?: string;
};

export type WorkspaceAccessSummary = {
  successCount: number;
  failedCount: number;
  lockedCount: number;
  resetCount: number;
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

export type ChargeIntegrationWarning = {
  provider: ExternalChargeProvider;
  stage: "charge_creation";
  message: string;
  createdAt: string;
};

export type Charge = {
  id: string;
  customer: string;
  amount: string;
  dueLabel: string;
  dueDate?: string;
  status: "Pendente" | "Hoje" | "Pago" | "Vencida";
  source: string;
  paymentLink?: string;
  followUps: ChargeFollowUpEntry[];
  cadence?: EntityCadenceState;
  externalBilling?: ExternalChargeBilling;
  integrationWarning?: ChargeIntegrationWarning;
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
  integrationWarning?: ChargeIntegrationWarning;
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
  subscription: WorkspaceSubscriptionProfile;
  customers: Customer[];
  quotes: Quote[];
  orders: Order[];
  charges: Charge[];
  nfseDocuments: NfseDocument[];
};
