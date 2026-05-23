import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { getDashboardReportSnapshot } from "@/lib/workspace-repository";

const logger = getLogger({ route: "api/reports/export" });

export const reportExportRouteDeps = {
  requireApiModuleAccess,
  getDashboardReportSnapshot,
};

function createSheet(rows: Array<Record<string, string | number>>) {
  return XLSX.utils.json_to_sheet(rows);
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await reportExportRouteDeps.requireApiModuleAccess("reports", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const report = await reportExportRouteDeps.getDashboardReportSnapshot();
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.summary.map((item) => ({
      Indicador: item.label,
      Valor: item.value,
      Leitura: item.helper,
    })),
  ), "Resumo");

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.cadenceMetrics.map((item) => ({
      Indicador: item.label,
      Valor: item.value,
      Leitura: item.helper,
    })),
  ), "Cadencia");

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.cadenceRisks.map((item) => ({
      Alerta: item.title,
      Descricao: item.description,
      Acesso: item.href,
    })),
  ), "Alertas");

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.topQuotes.map((item) => ({
      Cliente: item.customer,
      Valor: item.amount,
      Status: item.status,
      Cadencia: item.cadenceLabel,
      Execucao: item.executionLabel,
      EtapaConcluida: item.completedStepLabel,
      ProximaEtapa: item.nextStepLabel,
    })),
  ), "Orcamentos");

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.topCharges.map((item) => ({
      Cliente: item.customer,
      Valor: item.amount,
      SLA: item.slaLabel,
      Cadencia: item.cadenceLabel,
      Execucao: item.executionLabel,
      EtapaConcluida: item.completedStepLabel,
      ProximaEtapa: item.nextStepLabel,
    })),
  ), "Cobrancas");

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.topCustomers.map((item) => ({
      Cliente: item.customerName,
      Status: item.status,
      Aberto: item.openAmount,
      Leitura: item.headline,
      ProximoPasso: item.helper,
    })),
  ), "Clientes");

  XLSX.utils.book_append_sheet(workbook, createSheet(
    report.fiscalItems.map((item) => ({
      Cliente: item.customer,
      Valor: item.amount,
      Prioridade: item.priorityLabel,
      Leitura: item.helper,
    })),
  ), "Fiscal");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  requestLogger.info("Dashboard report exported", {
    summaryRows: report.summary.length,
    topQuoteRows: report.topQuotes.length,
    topChargeRows: report.topCharges.length,
    topCustomerRows: report.topCustomers.length,
    fiscalRows: report.fiscalItems.length,
  });

  return attachRequestId(
    new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="gestao-facil-relatorio.xlsx"',
      },
    }),
    requestId,
  );
}
