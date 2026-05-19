import { randomUUID } from "node:crypto";
import { NfseStatus, type Customer as DbCustomer, type NfseDocument as DbNfseDocument, type Order as DbOrder } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { findCustomerByLookup } from "@/lib/customer-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { formatCurrency, parseCurrencyToNumber } from "@/lib/demo-data-codecs";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import { buildSignedDpsPayload, issueSignedNfsePayload } from "@/lib/nfse-national-provider";
import type { Charge, DemoWorkspaceData, NfseDocument, Order, Quote } from "@/lib/types";

export type FiscalReadinessSummary = {
  ready: boolean;
  missingFields: string[];
  helper: string;
};

export type NfseNationalIssuePreview = {
  ready: boolean;
  helper: string;
  missingFields: string[];
  municipalCode?: string;
  serviceCode?: string;
  dpsId?: string;
  digest?: string;
  xmlPreview?: string;
};

type QuickNfseDraftInput = {
  lookup: string;
  amount: string;
  serviceDescription: string;
};

type NfseIssueOptions = {
  serviceCode?: string;
};

function formatIssuedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mapNfseStatus(status: NfseDocument["status"]): NfseStatus {
  switch (status) {
    case "Pronta":
      return "READY";
    case "Emitida":
      return "ISSUED";
    case "Erro":
      return "ERROR";
    case "Cancelada":
      return "CANCELED";
    default:
      return "DRAFT";
  }
}

function mapDbNfseStatus(status: NfseStatus): NfseDocument["status"] {
  switch (status) {
    case "READY":
      return "Pronta";
    case "ISSUED":
      return "Emitida";
    case "ERROR":
      return "Erro";
    case "CANCELED":
      return "Cancelada";
    default:
      return "Rascunho";
  }
}

function toNfseView(document: DbNfseDocument & { customer: DbCustomer; order: DbOrder }): NfseDocument {
  return {
    id: document.id,
    customer: document.customer.name,
    orderId: document.orderId,
    serviceAmount: formatCurrency(Number(document.serviceAmount)),
    status: mapDbNfseStatus(document.status),
    serviceDescription: document.order.internalNotes || "Documento fiscal criado a partir do fluxo operacional.",
    verificationCode: document.verificationCode || undefined,
    externalId: document.externalId || undefined,
    issuedAt: document.issuedAt ? formatIssuedAt(document.issuedAt) : undefined,
    errorMessage: document.errorMessage || undefined,
  };
}

function findOrderForCharge(data: DemoWorkspaceData, charge: Charge) {
  return data.orders.find((order) => order.customer === charge.customer && order.amount === charge.amount)
    || data.orders.find((order) => order.customer === charge.customer);
}

async function ensureLocalQuickOrder(
  data: DemoWorkspaceData,
  customerName: string,
  amount: string,
  serviceDescription: string,
) {
  const existingOrder = data.orders.find((order) => order.customer === customerName && order.amount === amount && order.note === serviceDescription);

  if (existingOrder) {
    return existingOrder;
  }

  const supportQuote: Quote = {
    id: randomUUID(),
    customer: customerName,
    title: serviceDescription,
    amount,
    status: "Aprovado",
    dueLabel: "Fluxo fiscal rápido",
    summary: "Base operacional criada para emissão fiscal rápida.",
  };

  const order: Order = {
    id: randomUUID(),
    customer: customerName,
    title: serviceDescription,
    amount,
    status: "Concluido",
    sourceQuoteId: supportQuote.id,
    note: serviceDescription,
  };

  data.quotes = [supportQuote, ...data.quotes];
  data.orders = [order, ...data.orders];

  return order;
}

function labelFiscalField(key: string) {
  switch (key) {
    case "legalName":
      return "razão social";
    case "tradeName":
      return "nome fantasia";
    case "document":
      return "documento";
    case "city":
      return "cidade";
    case "state":
      return "UF";
    case "serviceDescription":
      return "descrição padrão de serviços";
    default:
      return key;
  }
}

function normalizeDocumentDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeAmountNumber(value: string) {
  return parseCurrencyToNumber(value);
}

function deriveDpsNumber(id: string, createdAt: Date) {
  const hash = id.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const timestamp = createdAt.getTime().toString().slice(-9).padStart(9, "0");
  return `${timestamp}${hash}`;
}

function summarizeXml(xml: string) {
  return xml.replace(/>\s+</g, "><").slice(0, 600);
}

function parseIssuedNfseMetadata(xml: string) {
  const accessKeyMatch = xml.match(/<chNFSe>([^<]+)<\/chNFSe>/i) || xml.match(/<ChNFSe>([^<]+)<\/ChNFSe>/i);
  const verificationMatch =
    xml.match(/<cVerif>([^<]+)<\/cVerif>/i)
    || xml.match(/<codigoVerificacao>([^<]+)<\/codigoVerificacao>/i);

  return {
    accessKey: accessKeyMatch?.[1]?.trim(),
    verificationCode: verificationMatch?.[1]?.trim(),
  };
}

async function ensureLocalOrderForCharge(data: DemoWorkspaceData, charge: Charge): Promise<Order> {
  const existing = findOrderForCharge(data, charge);

  if (existing) {
    return existing;
  }

  const order: Order = {
    id: randomUUID(),
    customer: charge.customer,
    title: `Servico faturado - ${charge.customer}`,
    amount: charge.amount,
    status: "Concluido",
    sourceQuoteId: `quote_support_${charge.id}`,
    note: "Pedido tecnico criado para sustentar emissao fiscal.",
  };

  data.orders = [order, ...data.orders];
  return order;
}

export async function listNfseDocuments(): Promise<NfseDocument[]> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    return data.nfseDocuments;
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const documents = await prisma.nfseDocument.findMany({
    where: { workspaceId },
    include: {
      customer: true,
      order: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return documents.map(toNfseView);
}

export async function createNfseFromCharge(chargeId: string): Promise<NfseDocument | null> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const charge = data.charges.find((item) => item.id === chargeId);

    if (!charge) {
      return null;
    }

    const existing = data.nfseDocuments.find((document) => document.customer === charge.customer && document.serviceAmount === charge.amount);

    if (existing) {
      return existing;
    }

    const order = await ensureLocalOrderForCharge(data, charge);
    const document: NfseDocument = {
      id: randomUUID(),
      customer: charge.customer,
      orderId: order.id,
      serviceAmount: charge.amount,
      status: "Rascunho",
      serviceDescription: order.note,
    };

    data.nfseDocuments = [document, ...data.nfseDocuments];
    await writeDemoWorkspaceData(data);
    return document;
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const charge = await prisma.charge.findFirst({
    where: {
      id: chargeId,
      workspaceId: context.workspaceId,
    },
    include: {
      customer: true,
      order: {
        include: {
          nfseDocument: true,
        },
      },
    },
  });

  if (!charge) {
    return null;
  }

  if (charge.order.nfseDocument) {
    const existing = await prisma.nfseDocument.findUnique({
      where: { orderId: charge.orderId },
      include: { customer: true, order: true },
    });

    return existing ? toNfseView(existing) : null;
  }

  const created = await prisma.nfseDocument.create({
    data: {
      workspaceId: context.workspaceId,
      customerId: charge.customerId,
      orderId: charge.orderId,
      serviceAmount: charge.amount,
      status: "DRAFT",
    },
    include: {
      customer: true,
      order: true,
    },
  });

  await recordAuditEvent({
    action: "nfse.created",
    entityType: "nfse",
    entityId: created.id,
    payload: {
      summary: `Rascunho fiscal criado para ${created.customer.name}.`,
      metadata: {
        customer: created.customer.name,
        orderId: created.orderId,
        amount: formatCurrency(Number(created.serviceAmount)),
      },
    },
    context,
  });

  return toNfseView(created);
}

export async function updateNfseStatus(
  id: string,
  status: NfseDocument["status"],
  errorMessage?: string,
): Promise<NfseDocument | null> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const index = data.nfseDocuments.findIndex((document) => document.id === id);

    if (index === -1) {
      return null;
    }

    const current = data.nfseDocuments[index];
    const updated: NfseDocument = {
      ...current,
      status,
      issuedAt: status === "Emitida" ? formatIssuedAt(new Date()) : current.issuedAt,
      verificationCode: status === "Emitida" ? current.verificationCode || `VF-${current.id.slice(0, 6).toUpperCase()}` : current.verificationCode,
      externalId: status === "Emitida" ? current.externalId || `NFS-${current.id.slice(0, 8).toUpperCase()}` : current.externalId,
      errorMessage: status === "Erro" ? errorMessage || "Falha operacional na preparação do documento." : undefined,
    };

    data.nfseDocuments[index] = updated;
    await writeDemoWorkspaceData(data);
    return updated;
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const updated = await prisma.nfseDocument.update({
    where: { id },
    data: {
      status: mapNfseStatus(status),
      issuedAt: status === "Emitida" ? new Date() : null,
      verificationCode: status === "Emitida" ? `VF-${id.slice(0, 6).toUpperCase()}` : undefined,
      externalId: status === "Emitida" ? `NFS-${id.slice(0, 8).toUpperCase()}` : undefined,
      errorMessage: status === "Erro" ? errorMessage || "Falha operacional na preparação do documento." : null,
    },
    include: {
      customer: true,
      order: true,
    },
  });

  await recordAuditEvent({
    action: "nfse.updated",
    entityType: "nfse",
    entityId: updated.id,
    payload: {
      summary: `Documento fiscal de ${updated.customer.name} atualizado para ${status.toLowerCase()}.`,
      metadata: {
        customer: updated.customer.name,
        status,
        orderId: updated.orderId,
      },
    },
    context,
  });

  return toNfseView(updated);
}

export async function listNfseReadyQueue() {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const existingOrders = new Set(data.nfseDocuments.map((document) => document.orderId));

    return data.charges
      .filter((charge) => charge.status === "Pago")
      .map((charge) => ({
        charge,
        order: findOrderForCharge(data, charge),
      }))
      .filter((item) => !item.order || !existingOrders.has(item.order.id))
      .map((item) => ({
        chargeId: item.charge.id,
        customer: item.charge.customer,
        amount: item.charge.amount,
        helper: "Recebimento confirmado e pronto para virar rascunho fiscal.",
      }));
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const paidCharges = await prisma.charge.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: "PAID",
    },
    include: {
      customer: true,
      order: {
        include: {
          nfseDocument: true,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  return paidCharges
    .filter((charge) => !charge.order.nfseDocument)
    .map((charge) => ({
      chargeId: charge.id,
      customer: charge.customer.name,
      amount: formatCurrency(Number(charge.amount)),
      helper: "Recebimento confirmado e pronto para virar rascunho fiscal.",
    }));
}

export async function getFiscalSetupReadiness(): Promise<FiscalReadinessSummary> {
  const setup = await getWorkspaceSetup();
  const requiredFields = [
    ["legalName", setup.legalName],
    ["tradeName", setup.tradeName],
    ["document", setup.document],
    ["city", setup.city],
    ["state", setup.state],
    ["serviceDescription", setup.serviceDescription],
  ] as const;

  const missingFields = requiredFields
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => labelFiscalField(key));

  return {
    ready: missingFields.length === 0,
    missingFields,
    helper:
      missingFields.length === 0
        ? "Empresa pronta para sustentar emissão fiscal no fluxo atual."
        : `Antes de emitir de verdade, complete: ${missingFields.join(", ")}.`,
  };
}

export async function getNfseNationalIssuePreview(id: string): Promise<NfseNationalIssuePreview | null> {
  const readiness = await getFiscalSetupReadiness();
  const setup = await getWorkspaceSetup();
  const municipalityStatus = await getNfseNationalMunicipalityStatus(setup.city || "", setup.state || "");
  const municipalCode = setup.municipalCode?.trim();
  const defaultServiceCode = setup.defaultFiscalServiceCode?.trim() || process.env.NFSE_NATIONAL_SERVICE_CODE?.trim() || "";

  if (municipalityStatus && !municipalityStatus.aderenteEmissorNacional) {
    return {
      ready: false,
      helper: "Seu município de estabelecimento ainda não possui convênio ativo para emissão pública no Emissor Nacional.",
      missingFields: ["municipio habilitado no emissor nacional"],
      municipalCode,
    };
  }

  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const document = data.nfseDocuments.find((item) => item.id === id);

    if (!document) {
      return null;
    }

    const customer = data.customers.find((item) => item.name === document.customer);
    const missingFields = [
      ...readiness.missingFields,
      !municipalCode ? "codigo IBGE do municipio emissor" : null,
      !defaultServiceCode ? "codigo do servico padrao" : null,
      !normalizeDocumentDigits(customer?.document).length ? "documento do cliente" : null,
      municipalityStatus && !municipalityStatus.aderenteEmissorNacional ? "municipio habilitado no emissor nacional" : null,
    ].filter((item): item is string => !!item);

    if (missingFields.length > 0) {
      return {
        ready: false,
        helper: `Antes de emitir no ambiente nacional, complete: ${missingFields.join(", ")}.`,
        missingFields,
      };
    }

    const signed = await buildSignedDpsPayload({
      issuer: {
        name: setup.legalName || setup.tradeName,
        document: setup.document,
        city: setup.city,
        state: setup.state,
      },
      customer: {
        name: document.customer,
        document: customer?.document || "",
        city: customer?.city,
        state: setup.state,
      },
      serviceDescription: document.serviceDescription || setup.serviceDescription,
      serviceAmount: normalizeAmountNumber(document.serviceAmount),
      competenceDate: new Date(),
      issueDate: new Date(),
      number: deriveDpsNumber(document.id, new Date()),
    }, {
      municipalCode,
      serviceCode: document.serviceCode || defaultServiceCode,
    });

    return {
      ready: true,
      helper: "Rascunho preparado para envio como DPS assinada ao ambiente nacional.",
      missingFields: [],
      municipalCode,
      serviceCode: document.serviceCode || defaultServiceCode,
      dpsId: signed.dpsId,
      digest: signed.digest,
      xmlPreview: summarizeXml(signed.xml),
    };
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const dbDocument = await prisma.nfseDocument.findFirst({
    where: {
      id,
      workspaceId: context.workspaceId,
    },
    include: {
      customer: true,
      order: true,
    },
  });

  if (!dbDocument) {
    return null;
  }

  const missingFields = [
    ...readiness.missingFields,
    !municipalCode ? "codigo IBGE do municipio emissor" : null,
    !defaultServiceCode ? "codigo do servico padrao" : null,
    !normalizeDocumentDigits(dbDocument.customer.document).length ? "documento do cliente" : null,
    municipalityStatus && !municipalityStatus.aderenteEmissorNacional ? "municipio habilitado no emissor nacional" : null,
  ].filter((item): item is string => !!item);

  if (missingFields.length > 0) {
    return {
      ready: false,
      helper: `Antes de emitir no ambiente nacional, complete: ${missingFields.join(", ")}.`,
      missingFields,
    };
  }

  const signed = await buildSignedDpsPayload({
    issuer: {
      name: setup.legalName || setup.tradeName,
      document: setup.document,
      city: setup.city,
      state: setup.state,
    },
    customer: {
      name: dbDocument.customer.name,
      document: dbDocument.customer.document || "",
      city: dbDocument.customer.city || undefined,
      state: dbDocument.customer.state || undefined,
    },
    serviceDescription: dbDocument.order.internalNotes || setup.serviceDescription,
    serviceAmount: Number(dbDocument.serviceAmount),
    competenceDate: dbDocument.createdAt,
    issueDate: new Date(),
    number: deriveDpsNumber(dbDocument.id, dbDocument.createdAt),
  }, {
    municipalCode,
    serviceCode: defaultServiceCode,
  });

  return {
    ready: true,
    helper: "Rascunho preparado para envio como DPS assinada ao ambiente nacional.",
    missingFields: [],
    municipalCode,
    serviceCode: defaultServiceCode,
    dpsId: signed.dpsId,
    digest: signed.digest,
    xmlPreview: summarizeXml(signed.xml),
  };
}

export async function issueNfseNationalDocument(id: string, options?: NfseIssueOptions): Promise<NfseDocument | null> {
  const preview = await getNfseNationalIssuePreview(id);

  if (!preview) {
    return null;
  }

  if (!preview.ready) {
    return updateNfseStatus(id, "Erro", preview.helper);
  }

  const setup = await getWorkspaceSetup();
  const municipalCode = setup.municipalCode?.trim();
  const serviceCode = options?.serviceCode?.trim() || setup.defaultFiscalServiceCode?.trim() || process.env.NFSE_NATIONAL_SERVICE_CODE?.trim() || "";

  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const document = data.nfseDocuments.find((item) => item.id === id);
    const customer = document ? data.customers.find((item) => item.name === document.customer) : null;

    if (!document || !customer?.document) {
      return updateNfseStatus(id, "Erro", "Cliente local sem documento fiscal para simular a emissão.");
    }

    const signed = await buildSignedDpsPayload({
      issuer: {
        name: setup.legalName || setup.tradeName,
        document: setup.document,
        city: setup.city,
        state: setup.state,
      },
      customer: {
        name: customer.name,
        document: customer.document,
        city: customer.city,
        state: setup.state,
      },
      serviceDescription: document.serviceDescription || setup.serviceDescription || "Servico operacional",
      serviceAmount: normalizeAmountNumber(document.serviceAmount),
      competenceDate: new Date(),
      issueDate: new Date(),
      number: deriveDpsNumber(id, new Date()),
    }, {
      municipalCode,
      serviceCode,
    });

    document.serviceCode = serviceCode;
    await writeDemoWorkspaceData(data);

    return updateNfseStatus(id, "Emitida", `Simulação local concluída. DPS ${signed.dpsId} preparada para envio real.`);
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const dbDocument = await prisma.nfseDocument.findFirst({
    where: {
      id,
      workspaceId: context.workspaceId,
    },
    include: {
      customer: true,
      order: true,
    },
  });

  if (!dbDocument) {
    return null;
  }

  try {
    const signed = await buildSignedDpsPayload({
      issuer: {
        name: setup.legalName || setup.tradeName,
        document: setup.document,
        city: setup.city,
        state: setup.state,
      },
      customer: {
        name: dbDocument.customer.name,
        document: dbDocument.customer.document || "",
        city: dbDocument.customer.city || undefined,
        state: dbDocument.customer.state || undefined,
      },
      serviceDescription: dbDocument.order.internalNotes || setup.serviceDescription,
      serviceAmount: Number(dbDocument.serviceAmount),
      competenceDate: dbDocument.createdAt,
      issueDate: new Date(),
      number: deriveDpsNumber(dbDocument.id, dbDocument.createdAt),
    }, {
      municipalCode,
      serviceCode,
    });

    const response = await issueSignedNfsePayload(signed.xml, {
      municipalCode,
      serviceCode,
    });

    if (response.status < 200 || response.status >= 300) {
      return updateNfseStatus(
        id,
        "Erro",
        `SEFIN Nacional rejeitou a DPS. HTTP ${response.status}. ${response.body.slice(0, 180)}`,
      );
    }

    const metadata = parseIssuedNfseMetadata(response.body);
    const updated = await prisma.nfseDocument.update({
      where: { id },
      data: {
        status: "ISSUED",
        issuedAt: new Date(),
        externalId: metadata.accessKey || signed.dpsId,
        verificationCode: metadata.verificationCode || signed.digest.slice(0, 12).toUpperCase(),
        errorMessage: null,
      },
      include: {
        customer: true,
        order: true,
      },
    });

    await recordAuditEvent({
      action: "nfse.national.issued",
      entityType: "nfse",
      entityId: updated.id,
      payload: {
        summary: `Documento fiscal enviado para a SEFIN Nacional para ${updated.customer.name}.`,
        metadata: {
          customer: updated.customer.name,
          httpStatus: response.status,
          accessKey: metadata.accessKey || null,
          dpsId: signed.dpsId,
        },
      },
      context,
    });

    return toNfseView(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao emitir na NFS-e Nacional.";
    return updateNfseStatus(id, "Erro", message);
  }
}

export async function createQuickNfseDraft(input: QuickNfseDraftInput): Promise<NfseDocument | null> {
  const customer = await findCustomerByLookup(input.lookup);

  if (!customer || !input.amount.trim() || !input.serviceDescription.trim()) {
    return null;
  }

  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const order = await ensureLocalQuickOrder(data, customer.name, input.amount, input.serviceDescription);
    const existing = data.nfseDocuments.find((document) => document.orderId === order.id);

    if (existing) {
      return existing;
    }

    const document: NfseDocument = {
      id: randomUUID(),
      customer: customer.name,
      orderId: order.id,
      serviceAmount: input.amount,
      status: "Rascunho",
      serviceDescription: input.serviceDescription,
    };

    data.nfseDocuments = [document, ...data.nfseDocuments];
    await writeDemoWorkspaceData(data);
    return document;
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const dbCustomer = await prisma.customer.findFirst({
    where: {
      workspaceId: context.workspaceId,
      OR: [
        { name: customer.name },
        ...(customer.document ? [{ document: customer.document }] : []),
      ],
    },
  });

  if (!dbCustomer) {
    return null;
  }

  const quote = await prisma.quote.create({
    data: {
      workspaceId: context.workspaceId,
      customerId: dbCustomer.id,
      title: input.serviceDescription,
      summary: "Base operacional criada para emissão fiscal rápida.",
      status: "APPROVED",
      subtotal: parseCurrencyToNumber(input.amount),
      total: parseCurrencyToNumber(input.amount),
      discount: 0,
    },
  });

  const order = await prisma.order.create({
    data: {
      workspaceId: context.workspaceId,
      customerId: dbCustomer.id,
      quoteId: quote.id,
      status: "COMPLETED",
      internalNotes: input.serviceDescription,
    },
    include: {
      customer: true,
      quote: true,
    },
  });

  const created = await prisma.nfseDocument.create({
    data: {
      workspaceId: context.workspaceId,
      customerId: dbCustomer.id,
      orderId: order.id,
      serviceAmount: parseCurrencyToNumber(input.amount),
      status: "DRAFT",
    },
    include: {
      customer: true,
      order: true,
    },
  });

  await recordAuditEvent({
    action: "nfse.quickdraft.created",
    entityType: "nfse",
    entityId: created.id,
    payload: {
      summary: `Rascunho fiscal rápido criado para ${created.customer.name}.`,
      metadata: {
        customer: created.customer.name,
        amount: input.amount,
      },
    },
    context,
  });

  return toNfseView(created);
}
