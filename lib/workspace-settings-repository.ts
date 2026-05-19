import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { resolveIbgeMunicipalityCode } from "@/lib/ibge";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import type { SetupInput } from "@/lib/types";

export async function getWorkspaceSetup() {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    const company = await prisma.company.findUnique({
      where: { workspaceId },
    });

    const resolvedMunicipality = !company?.municipalCode && company?.city && company?.state
      ? await resolveIbgeMunicipalityCode(company.city, company.state)
      : null;

    return {
      name: workspace.name,
      slug: workspace.slug,
      niche: company?.serviceDescription || "Servicos locais e operacao comercial enxuta",
      legalName: company?.legalName || workspace.name,
      tradeName: company?.tradeName || workspace.name,
      document: company?.document || "",
      city: company?.city || "",
      state: company?.state || "",
      municipalCode: company?.municipalCode || resolvedMunicipality?.municipalCode || "",
      serviceDescription: company?.serviceDescription || "",
      defaultFiscalServiceCode: company?.defaultFiscalServiceCode || "",
      defaultPixKey: company?.defaultPixKey || "",
      defaultPaymentMessage: company?.defaultPaymentMessage || "",
    };
  }

  const data = await readDemoWorkspaceData();
  const resolvedMunicipality = !data.company.municipalCode && data.company.city && data.company.state
    ? await resolveIbgeMunicipalityCode(data.company.city, data.company.state)
    : null;

  return {
    ...data.workspace,
    ...data.company,
    municipalCode: data.company.municipalCode || resolvedMunicipality?.municipalCode || "",
  };
}

export async function updateWorkspaceSetup(input: SetupInput) {
  const resolvedMunicipality = input.city && input.state
    ? await resolveIbgeMunicipalityCode(input.city, input.state)
    : null;

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem atualizar o setup do workspace.");
    }

    const [workspace, company] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
      }),
      prisma.company.findUnique({
        where: { workspaceId: context.workspaceId },
      }),
    ]);

    const changedFields = [
      workspace.name !== input.name ? "nome do workspace" : null,
      workspace.slug !== input.slug ? "slug" : null,
      (company?.legalName || "") !== input.legalName ? "razao social" : null,
      (company?.tradeName || workspace.name) !== input.tradeName ? "nome fantasia" : null,
      (company?.document || "") !== input.document ? "documento" : null,
      (company?.city || "") !== input.city ? "cidade" : null,
      (company?.state || "") !== input.state ? "UF" : null,
      (company?.municipalCode || "") !== (resolvedMunicipality?.municipalCode || "") ? "codigo IBGE" : null,
      (company?.serviceDescription || "") !== (input.serviceDescription || input.niche)
        ? "descricao de servicos"
        : null,
      (company?.defaultFiscalServiceCode || "") !== (input.defaultFiscalServiceCode || "") ? "codigo padrao de servico" : null,
      (company?.defaultPixKey || "") !== input.defaultPixKey ? "chave Pix" : null,
      (company?.defaultPaymentMessage || "") !== input.defaultPaymentMessage
        ? "mensagem de cobranca"
        : null,
    ].filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: context.workspaceId },
        data: {
          name: input.name,
          slug: input.slug,
        },
      });

      await tx.company.upsert({
        where: { workspaceId: context.workspaceId },
        update: {
          legalName: input.legalName,
          tradeName: input.tradeName,
          document: input.document,
          city: input.city,
          state: input.state,
          municipalCode: resolvedMunicipality?.municipalCode || null,
          serviceDescription: input.serviceDescription || input.niche,
          defaultFiscalServiceCode: input.defaultFiscalServiceCode || null,
          defaultPixKey: input.defaultPixKey,
          defaultPaymentMessage: input.defaultPaymentMessage,
        },
        create: {
          workspaceId: context.workspaceId,
          legalName: input.legalName,
          tradeName: input.tradeName,
          document: input.document,
          city: input.city,
          state: input.state,
          municipalCode: resolvedMunicipality?.municipalCode || null,
          serviceDescription: input.serviceDescription || input.niche,
          defaultFiscalServiceCode: input.defaultFiscalServiceCode || null,
          defaultPixKey: input.defaultPixKey,
          defaultPaymentMessage: input.defaultPaymentMessage,
        },
      });

      await recordAuditEvent(
        {
          action: "workspace.setup.updated",
          entityType: "workspace",
          entityId: context.workspaceId,
          context,
          payload: {
            summary: changedFields.length
              ? `Setup atualizado: ${changedFields.join(", ")}.`
              : "Setup salvo sem alteracoes materiais.",
            metadata: {
              changedFieldCount: changedFields.length,
              tradeName: input.tradeName,
              city: input.city || null,
              state: input.state || null,
              municipalCode: resolvedMunicipality?.municipalCode || null,
            },
          },
        },
        tx,
      );
    });

    return {
      workspace: {
        name: input.name,
        slug: input.slug,
        niche: input.niche,
      },
      company: {
        legalName: input.legalName,
        tradeName: input.tradeName,
        document: input.document,
        city: input.city,
        state: input.state,
        municipalCode: resolvedMunicipality?.municipalCode || "",
        serviceDescription: input.serviceDescription,
        defaultFiscalServiceCode: input.defaultFiscalServiceCode || "",
        defaultPixKey: input.defaultPixKey,
        defaultPaymentMessage: input.defaultPaymentMessage,
      },
    };
  }

  const data = await readDemoWorkspaceData();

  data.workspace = {
    name: input.name,
    slug: input.slug,
    niche: input.niche,
  };

  data.company = {
    legalName: input.legalName,
    tradeName: input.tradeName,
    document: input.document,
    city: input.city,
    state: input.state,
    municipalCode: resolvedMunicipality?.municipalCode || "",
    serviceDescription: input.serviceDescription,
    defaultFiscalServiceCode: input.defaultFiscalServiceCode || "",
    defaultPixKey: input.defaultPixKey,
    defaultPaymentMessage: input.defaultPaymentMessage,
  };

  await writeDemoWorkspaceData(data);
  return data;
}
