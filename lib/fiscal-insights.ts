import type { NfseDocument } from "@/lib/types";
import type { NfseNationalIssuePreview } from "@/lib/nfse-repository";

export type FiscalInsightPriority = "blocked" | "ready" | "review" | "issued";

export type FiscalInsightItem = {
  documentId: string;
  customer: string;
  amount: string;
  status: NfseDocument["status"];
  serviceDescription: string;
  priority: FiscalInsightPriority;
  priorityLabel: string;
  helper: string;
  missingFields: string[];
  issuedAt?: string;
};

export type FiscalInsightSummary = {
  blockedCount: number;
  readyCount: number;
  reviewCount: number;
  issuedCount: number;
};

function getPriority(document: NfseDocument, preview?: NfseNationalIssuePreview | null): FiscalInsightPriority {
  if (document.status === "Emitida") {
    return "issued";
  }

  if (document.status === "Erro") {
    return "review";
  }

  if (preview && !preview.ready) {
    return "blocked";
  }

  return "ready";
}

function getPriorityLabel(priority: FiscalInsightPriority) {
  switch (priority) {
    case "blocked":
      return "Bloqueada";
    case "ready":
      return "Pronta";
    case "review":
      return "Revisão";
    case "issued":
      return "Emitida";
  }
}

function getHelper(document: NfseDocument, preview?: NfseNationalIssuePreview | null) {
  if (document.status === "Emitida") {
    return "Documento já emitido e fora da fila operacional.";
  }

  if (document.status === "Erro") {
    return document.errorMessage || "Existe bloqueio fiscal pedindo revisão humana.";
  }

  if (preview && !preview.ready) {
    return preview.helper;
  }

  return preview?.helper || "Documento pronto para seguir no fluxo fiscal.";
}

export function buildFiscalInsights(
  documents: NfseDocument[],
  previewMap: Map<string, NfseNationalIssuePreview | null>,
) {
  const items = documents.map((document) => {
    const preview = previewMap.get(document.id);
    const priority = getPriority(document, preview);

    return {
      documentId: document.id,
      customer: document.customer,
      amount: document.serviceAmount,
      status: document.status,
      serviceDescription: document.serviceDescription,
      priority,
      priorityLabel: getPriorityLabel(priority),
      helper: getHelper(document, preview),
      missingFields: preview?.missingFields || [],
      issuedAt: document.issuedAt,
    } satisfies FiscalInsightItem;
  });

  const priorityWeight = (priority: FiscalInsightPriority) => {
    switch (priority) {
      case "blocked":
        return 0;
      case "ready":
        return 1;
      case "review":
        return 2;
      case "issued":
        return 3;
    }
  };

  const sortedItems = [...items].sort((left, right) => {
    const leftWeight = priorityWeight(left.priority);
    const rightWeight = priorityWeight(right.priority);

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.customer.localeCompare(right.customer, "pt-BR");
  });

  const summary = sortedItems.reduce<FiscalInsightSummary>((acc, item) => {
    switch (item.priority) {
      case "blocked":
        acc.blockedCount += 1;
        break;
      case "ready":
        acc.readyCount += 1;
        break;
      case "review":
        acc.reviewCount += 1;
        break;
      case "issued":
        acc.issuedCount += 1;
        break;
    }

    return acc;
  }, {
    blockedCount: 0,
    readyCount: 0,
    reviewCount: 0,
    issuedCount: 0,
  });

  return {
    summary,
    items: sortedItems,
  };
}
