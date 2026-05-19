"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createNfseFromCharge,
  createQuickNfseDraft,
  issueNfseNationalDocument,
  updateNfseStatus,
} from "@/lib/nfse-repository";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import { testNfseNationalConnectivity } from "@/lib/nfse-national-provider";
import { inspectNfseNationalCertificate } from "@/lib/nfse-national-provider";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function revalidateFiscalViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/fiscal");
}

export async function createNfseDraftAction(formData: FormData) {
  const chargeId = getString(formData, "chargeId");

  if (!chargeId) {
    return;
  }

  await createNfseFromCharge(chargeId);
  revalidateFiscalViews();
}

export async function createQuickNfseDraftAction(formData: FormData) {
  const lookup = getString(formData, "lookup");
  const amount = getString(formData, "amount");
  const serviceDescription = getString(formData, "serviceDescription");

  if (!lookup || !amount || !serviceDescription) {
    return;
  }

  await createQuickNfseDraft({
    lookup,
    amount,
    serviceDescription,
  });
  revalidateFiscalViews();
}

export async function markNfseReadyAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await updateNfseStatus(id, "Pronta");
  revalidateFiscalViews();
}

export async function markNfseIssuedAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await updateNfseStatus(id, "Emitida");
  revalidateFiscalViews();
}

export async function issueNfseNationalAction(formData: FormData) {
  const id = getString(formData, "id");
  const serviceCode = getString(formData, "serviceCode");

  if (!id) {
    return;
  }

  await issueNfseNationalDocument(id, {
    serviceCode,
  });
  revalidateFiscalViews();
}

export async function markNfseErrorAction(formData: FormData) {
  const id = getString(formData, "id");
  const errorMessage = getString(formData, "errorMessage");

  if (!id) {
    return;
  }

  await updateNfseStatus(id, "Erro", errorMessage || "Documento precisa de revisão antes da emissão.");
  revalidateFiscalViews();
}

export async function testNfseNationalConnectivityAction() {
  const setup = await getWorkspaceSetup();
  const result = await testNfseNationalConnectivity(setup.municipalCode);

  const status = result.status ? String(result.status) : "";
  const message = result.ok
    ? `Conectado ao ambiente oficial. Endpoint: ${result.target}. Status: ${status || "OK"}.`
    : `Falha ao testar ambiente oficial. ${result.error || result.snippet || result.target}`;

  redirect(`/dashboard/fiscal?integrationMessage=${encodeURIComponent(message)}&integrationOk=${result.ok ? "1" : "0"}`);
}

export async function inspectNfseNationalCertificateAction() {
  const result = await inspectNfseNationalCertificate();
  const message = result.ok
    ? `Certificado válido. Sujeito: ${result.subject}. Validade final: ${result.validTo || "não informada"}.`
    : `Falha ao inspecionar certificado. ${result.error || "Erro desconhecido."}`;

  redirect(`/dashboard/fiscal?certificateMessage=${encodeURIComponent(message)}&certificateOk=${result.ok ? "1" : "0"}`);
}
