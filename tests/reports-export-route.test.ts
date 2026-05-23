import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { GET as getReportExport, reportExportRouteDeps } from "@/app/api/reports/export/route";
import type { DashboardReportSnapshot } from "@/lib/dashboard-repository-types";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  requireApiModuleAccess: reportExportRouteDeps.requireApiModuleAccess,
  getDashboardReportSnapshot: reportExportRouteDeps.getDashboardReportSnapshot,
};

function restoreReportExportDeps() {
  reportExportRouteDeps.requireApiModuleAccess = originalDeps.requireApiModuleAccess;
  reportExportRouteDeps.getDashboardReportSnapshot = originalDeps.getDashboardReportSnapshot;
}

test("reports export route forwards unauthorized response with request id", async () => {
  reportExportRouteDeps.requireApiModuleAccess = async () =>
    NextResponse.json({ error: "Seu perfil atual nao pode executar esta operacao neste workspace." }, { status: 403 });

  try {
    const requestId = "reports-export-unauthorized-request-id";
    const response = await getReportExport(new Request("http://localhost/api/reports/export", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.match(payload.error, /nao pode executar/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreReportExportDeps();
  }
});

test("reports export route returns workbook attachment with request id", async () => {
  reportExportRouteDeps.requireApiModuleAccess = async () => null;
  reportExportRouteDeps.getDashboardReportSnapshot = async (): Promise<DashboardReportSnapshot> => ({
    generatedAt: "2026-05-23 09:00",
    summary: [{ label: "Receita", value: "R$ 12.000", helper: "Leitura do dia" }],
    cadenceMetrics: [{ label: "Contato", value: "3", helper: "Acompanhar clientes" }],
    cadenceRisks: [{
      id: "risk-cadencia-atrasada",
      title: "Cadencia atrasada",
      description: "Existem itens sem contato",
      href: "/dashboard/quotes",
      hrefLabel: "Revisar operacao",
    }],
    cadenceLanes: [],
    recommendations: [],
    agenda: [],
    topQuotes: [{
      quoteId: "quote-1",
      customer: "Cliente A",
      title: "Proposta mensal",
      amount: "R$ 5.000",
      status: "Enviado",
      dueLabel: "Hoje",
      summary: "Plano com setup inicial",
      customerPhone: "5511999999999",
      customerStatus: "Ativo",
      customerOpenAmount: "R$ 0",
      whatsappEventCount: 1,
      whatsappLastEventAt: "2026-05-23T09:00:00.000Z",
      whatsappLastEventSummary: "Cliente respondeu no WhatsApp",
      priority: "hot",
      priorityLabel: "Quente",
      cadenceLabel: "Contato hoje",
      executionLabel: "Ativo",
      completedStepLabel: "Proposta enviada",
      nextStepLabel: "Cobrar retorno",
      helper: "Cliente quente para retomada",
    }],
    topCharges: [{
      id: "charge-1",
      customer: "Cliente B",
      amount: "R$ 2.000",
      urgency: "today",
      urgencyLabel: "Vence hoje",
      bucket: "attention",
      title: "Cobrar vencimento do dia",
      summary: "Cobranca exige contato hoje",
      recommendedAction: "Enviar lembrete",
      slaLabel: "Hoje",
      cadenceLabel: "Lembrete",
      executionLabel: "Pendente",
      completedStepLabel: "Cobranca enviada",
      nextStepLabel: "Confirmar pagamento",
      suggestedMessage: "Oi, passo para lembrar do vencimento.",
      nextFollowUpDate: "2026-05-23",
      nextFollowUpLabel: "Contato precisa acontecer hoje.",
      slaStatus: "today",
      lastContactLabel: "Sem contato registrado ainda.",
    }],
    topCustomers: [{
      customerId: "customer-1",
      customerName: "Cliente C",
      status: "Ativo",
      phone: "5511988888888",
      city: "Sao Paulo",
      openAmount: "R$ 1.000",
      lastSale: "2026-05-20",
      eventCount: 2,
      lastEventAt: "2026-05-23T08:00:00.000Z",
      lastEventSummary: "Pediu retorno",
      priority: "followup",
      headline: "Bom momento para follow-up",
      helper: "Chamar no WhatsApp",
    }],
    fiscalItems: [{
      documentId: "nfse-1",
      customer: "Cliente D",
      amount: "R$ 900",
      status: "Pronta",
      serviceDescription: "Consultoria",
      priority: "ready",
      priorityLabel: "Alta",
      helper: "Emitir nota",
      missingFields: [],
      issuedAt: undefined,
    }],
  });

  try {
    const requestId = "reports-export-request-id";
    const response = await getReportExport(new Request("http://localhost/api/reports/export", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(
      response.headers.get("Content-Type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.match(response.headers.get("Content-Disposition") || "", /gestao-facil-relatorio\.xlsx/i);

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });

    assert.deepEqual(workbook.SheetNames, ["Resumo", "Cadencia", "Alertas", "Orcamentos", "Cobrancas", "Clientes", "Fiscal"]);
    const summaryRows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Resumo);
    const quotesRows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Orcamentos);

    assert.equal(summaryRows[0]?.Indicador, "Receita");
    assert.equal(quotesRows[0]?.Cliente, "Cliente A");
  } finally {
    restoreReportExportDeps();
  }
});
