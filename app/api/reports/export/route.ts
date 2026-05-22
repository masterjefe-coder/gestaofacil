import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { getDashboardReportSnapshot } from "@/lib/workspace-repository";

function createSheet(rows: Array<Record<string, string | number>>) {
  return XLSX.utils.json_to_sheet(rows);
}

export async function GET() {
  const unauthorized = await requireApiModuleAccess("reports", "canView");
  if (unauthorized) {
    return unauthorized;
  }

  const report = await getDashboardReportSnapshot();
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

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="gestao-facil-relatorio.xlsx"',
    },
  });
}
