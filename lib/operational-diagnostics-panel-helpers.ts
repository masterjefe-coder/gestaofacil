export type OperationalDiagnosticsSignal = {
  action: string;
  createdAt: string;
  summary: string;
};

export type OperationalDiagnosticsSignalTone = "ok" | "warning" | "neutral";
export type OperationalDiagnosticsDomainSummary = {
  primary?: OperationalDiagnosticsSignal;
  primaryTone: OperationalDiagnosticsSignalTone;
  recovery?: OperationalDiagnosticsSignal;
};

export function getOperationalDiagnosticAction(checkKey: string) {
  switch (checkKey) {
    case "app-base-url":
    case "auth-secrets":
    case "health-token":
      return {
        href: "#access-section",
        label: "Revisar acesso",
      };
    case "asaas-webhook":
      return {
        href: "#integrations-section",
        label: "Ajustar cobrança",
      };
    case "evolution-webhook":
    case "evolution-connectivity":
      return {
        href: "#integrations-section",
        label: "Revisar WhatsApp",
      };
    case "nfse-readiness":
    case "nfse-certificate":
      return {
        href: "/dashboard/fiscal",
        label: "Abrir fiscal",
      };
    case "api-resilience":
      return {
        href: "/api/diagnostics",
        label: "Abrir JSON",
      };
    default:
      return null;
  }
}

export function getPrimarySignal<T extends OperationalDiagnosticsSignal>(signals: T[]) {
  return signals[0];
}

export function getOperationalSignalTone(signal: OperationalDiagnosticsSignal | undefined) {
  if (!signal) {
    return "neutral" as OperationalDiagnosticsSignalTone;
  }

  const action = signal.action.toLowerCase();
  const summary = signal.summary.toLowerCase();

  if (
    action.includes("failed")
    || action.includes("disconnected")
    || action.includes("overdue")
    || action.includes("timeout")
    || (action.includes("nfse.updated") && summary.includes("erro"))
    || summary.includes("falha")
    || summary.includes("erro")
    || summary.includes("limit")
    || summary.includes("perdeu conex")
    || summary.includes("instavel")
    || summary.includes("sem resposta")
    || summary.includes("offline")
  ) {
    return "warning" as OperationalDiagnosticsSignalTone;
  }

  if (
    action.includes("issued")
    || action.includes("received")
    || action.includes("confirmed")
    || action.includes("created")
    || action.includes("synced")
    || action.includes("messages_upsert")
    || summary.includes("conectada")
    || summary.includes("conectado")
    || summary.includes("emitido")
    || summary.includes("emitida")
  ) {
    return "ok" as OperationalDiagnosticsSignalTone;
  }

  return "neutral" as OperationalDiagnosticsSignalTone;
}

export function getOperationalSignalToneClass(tone: OperationalDiagnosticsSignalTone) {
  switch (tone) {
    case "ok":
      return "split-panel success";
    case "warning":
      return "split-panel";
    default:
      return "split-panel";
  }
}

export function summarizeOperationalSignals<T extends OperationalDiagnosticsSignal>(signals: T[]): OperationalDiagnosticsDomainSummary {
  const primaryWarning = signals.find((signal) => getOperationalSignalTone(signal) === "warning");
  const latestOk = signals.find((signal) => getOperationalSignalTone(signal) === "ok");
  const latest = signals[0];
  const primary = primaryWarning || latest;
  const primaryTone = getOperationalSignalTone(primary);

  return {
    primary,
    primaryTone,
    recovery: primaryWarning ? latestOk : undefined,
  };
}
