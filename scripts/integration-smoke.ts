import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getAsaasAccountStatus, getAsaasIntegrationStatus, inspectAsaasAccount, listAsaasPendingDocuments } from "@/lib/asaas";
import {
  fetchEvolutionInstances,
  getEvolutionConnectionState,
  getEvolutionIntegrationStatus,
  probeEvolutionApi,
} from "@/lib/evolution-api";
import {
  getNfseNationalMunicipalityStatus,
  listNfseNationalCoverageGaps,
} from "@/lib/nfse-national-municipal-status";
import {
  getNfseNationalIntegrationStatus,
  inspectNfseNationalCertificate,
  testNfseNationalConnectivity,
} from "@/lib/nfse-national-provider";
import { getNfseJoinvilleIntegrationStatus, testNfseJoinvilleConnectivity } from "@/lib/nfse-joinville-provider";
import { resolveNfseProvider } from "@/lib/nfse-provider";
import { getTransactionalEmailStatus, sendTransactionalEmail } from "@/lib/transactional-email";

type DemoWorkspaceSnapshot = {
  company?: {
    city?: string;
    state?: string;
    municipalCode?: string;
  };
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function printTitle(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printJson(payload: unknown) {
  console.log(JSON.stringify(payload, null, 2));
}

function readDemoWorkspaceSnapshot(): DemoWorkspaceSnapshot | null {
  const filePath = path.join(process.cwd(), "data", "demo-workspace.json");

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as DemoWorkspaceSnapshot;
  } catch {
    return null;
  }
}

function isJoinvilleReference(city: string, state: string) {
  return city.trim().toLowerCase() === "joinville" && state.trim().toUpperCase() === "SC";
}

async function runAsaasChecks() {
  const status = getAsaasIntegrationStatus();
  printTitle("ASAAS");
  printJson({
    integration: status,
  });

  if (!status.enabled) {
    return { ok: false, reason: "Asaas nao configurado." };
  }

  const apiKey = process.env.ASAAS_API_KEY?.trim();

  if (!apiKey) {
    return { ok: false, reason: "ASAAS_API_KEY ausente." };
  }

  const [accountStatus, walletInspection, pendingDocuments] = await Promise.all([
    getAsaasAccountStatus(apiKey),
    inspectAsaasAccount(apiKey),
    listAsaasPendingDocuments(apiKey).catch((error) => [
      {
        type: "Falha ao consultar documentos",
        status: error instanceof Error ? error.message : "Erro desconhecido",
        pending: true,
      },
    ]),
  ]);

  printJson({
    accountStatus,
    walletInspection,
    pendingDocuments,
  });

  return { ok: true };
}

async function runEvolutionChecks() {
  const status = getEvolutionIntegrationStatus();
  printTitle("EVOLUTION");
  printJson({
    integration: status,
  });

  if (!status.enabled) {
    return { ok: false, reason: "Evolution nao configurada." };
  }

  const [connectivity, instances] = await Promise.all([
    probeEvolutionApi(),
    fetchEvolutionInstances(),
  ]);
  const defaultInstance = status.instance;
  const selectedInstance = defaultInstance
    ? instances.find((instance) => instance.instanceName === defaultInstance) || null
    : null;
  const connectionState = defaultInstance
    ? await getEvolutionConnectionState(defaultInstance).catch((error) => ({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }))
    : null;

  printJson({
    connectivity,
    instances,
    selectedInstance,
    connectionState,
  });

  const effectiveState =
    typeof connectionState === "object" && connectionState && "instance" in connectionState
      ? connectionState.instance?.state || selectedInstance?.status || "unknown"
      : selectedInstance?.status || "unknown";

  return {
    ok: Boolean(connectivity.reachable) && effectiveState === "open",
    effectiveState,
  };
}

async function runNfseChecks() {
  const demoWorkspace = readDemoWorkspaceSnapshot();
  const city = getArgValue("--city") || demoWorkspace?.company?.city || "";
  const state = getArgValue("--state") || demoWorkspace?.company?.state || "";
  const municipalityStatus = city && state
    ? await getNfseNationalMunicipalityStatus(city, state).catch((error) => ({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }))
    : null;
  const provider = resolveNfseProvider(
    city,
    state,
    municipalityStatus && "aderenteEmissorNacional" in municipalityStatus
      ? { municipalityStatus }
      : undefined,
  );
  const status = provider.key === "joinville" ? getNfseJoinvilleIntegrationStatus() : getNfseNationalIntegrationStatus();
  printTitle("NFSE");
  printJson({
    provider,
    integration: status,
  });

  const certificate = status.hasCertificate
    ? await inspectNfseNationalCertificate()
    : { ok: false, error: "Certificado ausente." };
  const connectivity = provider.key === "joinville"
    ? await testNfseJoinvilleConnectivity()
    : await testNfseNationalConnectivity();
  const coverageGapPreview = await listNfseNationalCoverageGaps(12).catch(() => []);

  printJson({
    certificate,
    connectivity,
    setupReference: {
      city: city || null,
      state: state || null,
      municipalCode:
        ("municipalCode" in status ? status.municipalCode : undefined)
        || demoWorkspace?.company?.municipalCode
        || null,
    },
    municipalityStatus,
    firstWaveMunicipalGaps: coverageGapPreview.map((item) => ({
      city: item.city,
      state: item.state,
      population: item.population,
      statusConvenio: item.statusConvenio,
    })),
  });

  if (provider.key === "national" && municipalityStatus && "aderenteEmissorNacional" in municipalityStatus && isJoinvilleReference(city, state) && municipalityStatus.aderenteEmissorNacional === false) {
    console.log("Recomendacao: Joinville/SC segue mais aderente ao provider municipal NF-em. Ative NFSE_JOINVILLE_ENABLED e informe a inscricao municipal para validar esse fluxo.");
  }

  const municipalityBlocksAutomaticIssuance =
    provider.key === "national"
    && municipalityStatus
    && typeof municipalityStatus === "object"
    && "aderenteEmissorNacional" in municipalityStatus
    && municipalityStatus.aderenteEmissorNacional === false;

  return {
    ok: status.ready && certificate.ok && connectivity.ok && !municipalityBlocksAutomaticIssuance,
    blockedByMunicipality: Boolean(municipalityBlocksAutomaticIssuance),
  };
}

async function runTransactionalEmailChecks() {
  const status = getTransactionalEmailStatus();
  printTitle("TRANSACTIONAL EMAIL");
  printJson({
    integration: status,
  });

  const testEmail = getArgValue("--send-test-email");

  if (!testEmail) {
    console.log("Envio real nao executado. Use --send-test-email voce@dominio.com para disparar um email de smoke.");
    return { ok: status.enabled };
  }

  if (!status.enabled) {
    console.log("Email transacional ainda nao esta configurado; envio de smoke ignorado.");
    return { ok: false };
  }

  const delivery = await sendTransactionalEmail({
    to: testEmail,
    subject: "Smoke test do Gestao Facil",
    text: "Este email confirma que o envio transacional do Gestao Facil esta operacional.",
    html: "<p>Este email confirma que o envio transacional do Gestao Facil esta operacional.</p>",
  });

  printJson({
    delivery,
  });

  return { ok: true };
}

async function main() {
  const envFile = getArgValue("--env") || ".env.local";
  loadEnvFile(path.join(process.cwd(), envFile));

  console.log("Gestao Facil Integration Smoke");
  console.log(`Ambiente carregado de: ${envFile}`);
  console.log("Padrao seguro: nenhuma cobranca, nota ou alteracao operacional e criada.");

  const asaas = await runAsaasChecks();
  const evolution = await runEvolutionChecks();
  const nfse = await runNfseChecks();
  const email = await runTransactionalEmailChecks();

  printTitle("RESUMO");
  printJson({
    asaas,
    evolution,
    nfse,
    email,
  });
}

main().catch((error) => {
  console.error("\n=== FALHA NO SMOKE DAS INTEGRACOES ===");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
