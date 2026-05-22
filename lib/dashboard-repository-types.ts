import type { buildChargeFollowUpActions } from "@/lib/charge-follow-up";
import type { buildCustomerEngagementInsights } from "@/lib/customer-engagement-insights";
import type { buildQuoteInsights } from "@/lib/quote-insights";
import type { buildFiscalInsights } from "@/lib/fiscal-insights";
import type { Stat } from "@/lib/types";

export type AgendaItem = {
  title: string;
  description: string;
};

export type DashboardActionKind =
  | "quote_followup"
  | "quote_approved"
  | "quote_to_charge"
  | "customer_status"
  | "charge_today";

export type DashboardAction = {
  label: string;
  kind: DashboardActionKind;
  targetId: string;
  status?: string;
  note?: string;
  dueLabel?: string;
};

export type DashboardCadenceMetric = {
  label: string;
  value: string;
  helper: string;
};

export type DashboardCadenceRisk = {
  id: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
};

export type DashboardCadenceItem = {
  id: string;
  lane: "blocked" | "conversion" | "commitment";
  kicker: string;
  title: string;
  description: string;
  helper: string;
  href: string;
  hrefLabel: string;
  action?: DashboardAction;
};

export type DashboardCadenceLane = {
  id: DashboardCadenceItem["lane"];
  title: string;
  helper: string;
  items: DashboardCadenceItem[];
};

export type DashboardRecommendation = {
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  priority: "critical" | "high" | "normal";
  kicker: string;
  action?: DashboardAction;
};

export type DashboardReportSnapshot = {
  generatedAt: string;
  summary: Stat[];
  cadenceMetrics: DashboardCadenceMetric[];
  cadenceRisks: DashboardCadenceRisk[];
  cadenceLanes: DashboardCadenceLane[];
  recommendations: DashboardRecommendation[];
  agenda: AgendaItem[];
  topQuotes: ReturnType<typeof buildQuoteInsights>["items"];
  topCharges: ReturnType<typeof buildChargeFollowUpActions>;
  topCustomers: ReturnType<typeof buildCustomerEngagementInsights>["items"];
  fiscalItems: ReturnType<typeof buildFiscalInsights>["items"];
};
