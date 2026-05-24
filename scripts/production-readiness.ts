import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import {
  fetchEvolutionInstances,
  getEvolutionConnectionState,
  getEvolutionIntegrationStatus,
  probeEvolutionApi,
} from "@/lib/evolution-api";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import {
  getNfseNationalIntegrationStatus,
  inspectNfseNationalCertificate,
  testNfseNationalConnectivity,
} from "@/lib/nfse-national-provider";
import { getNfseJoinvilleIntegrationStatus, testNfseJoinvilleConnectivity } from "@/lib/nfse-joinville-provider";
import { resolveNfseProvider } from "@/lib/nfse-provider";
import { getTransactionalEmailStatus } from "@/lib/transactional-email";

type CheckLevel = "pass" | "warn" | "fail";

type ReadinessCheck = {
  key: string;
  level: CheckLevel;
  message: string;
};

type WorkspaceSeedSnapshot = {
  company?: {
    city?: string;
    state?: string;
    municipalCode?: string;
  };
};

function isStrongSecret(value: string | undefined, minLength = 32) {
  const normalized = value?.trim() || "";

  if (!normalized) {
    return false;
  }

  if (normalized.length < minLength) {
    return false;
  }

  const lowered = normalized.toLowerCase();

  return !lowered.includes("troque-por") && !lowered.includes("change-me") && !lowered.includes("placeholder");
}

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

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readWorkspaceSeedSnapshot(): WorkspaceSeedSnapshot | null {
  const filePath = path.join(process.cwd(), "data", "demo-workspace.json");

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as WorkspaceSeedSnapshot;
  } catch {
    return null;
  }
}

function addCheck(checks: ReadinessCheck[], key: string, level: CheckLevel, message: string) {
  checks.push({ key, level, message });
}

function isJoinvilleReference(city: string, state: string) {
  return city.trim().toLowerCase() === "joinville" && state.trim().toUpperCase() === "SC";
}

function printSection(title: string) {
  console.log(`\n${title}`);
}

function printChecks(checks: ReadinessCheck[]) {
  const iconByLevel: Record<CheckLevel, string> = {
    pass: "[PASS]",
    warn: "[WARN]",
    fail: "[FAIL]",
  };

  for (const check of checks) {
    console.log(`${iconByLevel[check.level]} ${check.key}: ${check.message}`);
  }
}

async function main() {
  const envFile = getArgValue("--env") || ".env.local";
  loadEnvFile(path.join(process.cwd(), envFile));

  const strict = hasFlag("--strict");
  const checks: ReadinessCheck[] = [];
  const localMode = isLocalDataMode();
  const asaas = getAsaasIntegrationStatus();
  const evolution = getEvolutionIntegrationStatus();
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  const authSecret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  const workspaceSecretKey = process.env.WORKSPACE_SECRET_KEY?.trim();
  const healthToken = process.env.HEALTHCHECK_TOKEN?.trim();
  const publicDemoEnabled = process.env.GESTAO_FACIL_ENABLE_PUBLIC_DEMO === "true";
  const transactionalEmail = getTransactionalEmailStatus();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const workspaceSeed = readWorkspaceSeedSnapshot();
  const nfseReferenceCity =
    getArgValue("--city")
    || process.env.NFSE_REFERENCE_CITY?.trim()
    || workspaceSeed?.company?.city
    || "";
  const nfseReferenceState =
    getArgValue("--state")
    || process.env.NFSE_REFERENCE_STATE?.trim()
    || workspaceSeed?.company?.state
    || "";
  const nfseProvider = resolveNfseProvider(nfseReferenceCity, nfseReferenceState);
  const nfse = nfseProvider.key === "joinville" ? getNfseJoinvilleIntegrationStatus() : getNfseNationalIntegrationStatus();

  addCheck(
    checks,
    "runtime-mode",
    localMode ? "warn" : "pass",
    localMode
      ? "Modo local/demo ainda ativo. Para producao, defina GESTAO_FACIL_DATA_MODE=database."
      : "Modo database ativo para persistencia principal.",
  );
  addCheck(
    checks,
    "database-url",
    databaseUrl ? "pass" : "fail",
    databaseUrl ? "DATABASE_URL configurada." : "DATABASE_URL ausente.",
  );
  addCheck(
    checks,
    "app-base-url",
    appBaseUrl ? "pass" : "fail",
    appBaseUrl ? `APP_BASE_URL configurada como ${appBaseUrl}.` : "APP_BASE_URL ausente.",
  );
  addCheck(
    checks,
    "auth-secret",
    isStrongSecret(authSecret) ? "pass" : "fail",
    isStrongSecret(authSecret)
      ? "Segredo de autenticacao configurado com forca minima aceitavel."
      : "AUTH_SECRET ou NEXTAUTH_SECRET ausente, fraco ou com placeholder.",
  );
  addCheck(
    checks,
    "workspace-secret-key",
    isStrongSecret(workspaceSecretKey) ? "pass" : "fail",
    isStrongSecret(workspaceSecretKey)
      ? "WORKSPACE_SECRET_KEY configurada com forca minima aceitavel."
      : "WORKSPACE_SECRET_KEY ausente, fraca ou com placeholder.",
  );
  addCheck(
    checks,
    "health-token",
    healthToken ? "pass" : "warn",
    healthToken
      ? "HEALTHCHECK_TOKEN configurado para diagnostico autenticado."
      : "HEALTHCHECK_TOKEN ausente; o detalhamento operacional dependera de sessao autenticada.",
  );
  addCheck(
    checks,
    "public-demo",
    publicDemoEnabled ? "warn" : "pass",
    publicDemoEnabled
      ? "Login demo publico esta habilitado. Desative para producao aberta."
      : "Login demo publico desabilitado.",
  );
  addCheck(
    checks,
    "transactional-email",
    transactionalEmail.enabled ? "pass" : "warn",
    transactionalEmail.enabled
      ? `Email transacional configurado com remetente ${transactionalEmail.fromAddress}.`
      : !transactionalEmail.apiKeyConfigured
        ? "RESEND_API_KEY ausente; convites, alertas e reset por email nao funcionarao."
        : "EMAIL_FROM ausente ou invalido; o provedor nao conseguira enviar emails transacionais.",
  );

  addCheck(
    checks,
    "asaas-config",
    asaas.enabled ? "pass" : "warn",
    asaas.enabled
      ? `Asaas configurado em ${asaas.environment} com helper operacional ativo.`
      : "Asaas ainda nao configurado no ambiente.",
  );
  addCheck(
    checks,
    "asaas-webhook",
    asaas.webhookConfigured ? "pass" : "warn",
    asaas.webhookConfigured
      ? "Webhook do Asaas configurado."
      : "Webhook do Asaas incompleto; baixa automatica nao sera confiavel.",
  );

  const evolutionConnectivity = await probeEvolutionApi();
  const evolutionInstances = evolution.enabled ? await fetchEvolutionInstances().catch(() => []) : [];
  const selectedEvolutionInstance = evolution.instance
    ? evolutionInstances.find((instance) => instance.instanceName === evolution.instance) || null
    : null;
  const evolutionConnectionState = evolution.instance
    ? await getEvolutionConnectionState(evolution.instance).catch(() => null)
    : null;
  const effectiveEvolutionState = evolutionConnectionState?.instance?.state || selectedEvolutionInstance?.status || null;
  addCheck(
    checks,
    "evolution-config",
    evolution.enabled ? "pass" : "warn",
    evolution.enabled
      ? "Evolution API configurada."
      : "Evolution API ainda nao configurada no ambiente.",
  );
  addCheck(
    checks,
    "evolution-webhook",
    evolution.webhookConfigured ? "pass" : "warn",
    evolution.webhookConfigured
      ? "Webhook da Evolution configurado."
      : "Webhook da Evolution incompleto; retorno operacional do WhatsApp ficara parcial.",
  );
  addCheck(
    checks,
    "evolution-connectivity",
    !evolution.enabled ? "warn" : evolutionConnectivity.reachable ? "pass" : "fail",
    !evolution.enabled
      ? "Conectividade da Evolution nao foi validada porque a integracao nao esta configurada."
      : evolutionConnectivity.summary,
  );
  addCheck(
    checks,
    "evolution-instance-state",
    !evolution.enabled
      ? "warn"
      : effectiveEvolutionState === "open"
        ? "pass"
        : effectiveEvolutionState
          ? "fail"
          : "warn",
    !evolution.enabled
      ? "Instancia principal do WhatsApp nao foi validada porque a integracao nao esta configurada."
      : effectiveEvolutionState === "open"
        ? `Instancia principal ${evolution.instance} esta aberta para operacao real.`
        : effectiveEvolutionState
          ? `Instancia principal ${evolution.instance} esta em estado ${effectiveEvolutionState} e ainda nao esta pronta para rotina continua.`
          : `Nao foi possivel confirmar o estado operacional da instancia principal ${evolution.instance}.`,
  );

  addCheck(
    checks,
    "nfse-config",
    nfse.ready ? "pass" : nfse.enabled ? "warn" : "warn",
    nfse.ready
      ? `${nfseProvider.label} configurada para operacao automatica.`
      : `${nfseProvider.label} ainda incompleta: ${nfse.missing.join(", ") || "revisar parametros do emissor"}.`,
  );

  if (nfse.hasCertificate) {
    const certificateInspection = await inspectNfseNationalCertificate();
    addCheck(
      checks,
      "nfse-certificate",
      certificateInspection.ok ? "pass" : "fail",
      certificateInspection.ok
        ? `Certificado fiscal lido com sucesso. Valido ate ${certificateInspection.validTo || "data nao identificada"}.`
        : certificateInspection.error || "Falha ao inspecionar o certificado fiscal.",
    );
  } else {
    addCheck(
      checks,
      "nfse-certificate",
      "warn",
      "Certificado fiscal ainda nao configurado; emissao automatica nao sera liberada.",
    );
  }

  const nfseMunicipalityStatus = nfseProvider.key === "national" && nfseReferenceCity && nfseReferenceState
    ? await getNfseNationalMunicipalityStatus(nfseReferenceCity, nfseReferenceState).catch(() => null)
    : null;
  const municipalityBlocksAutomaticIssuance = Boolean(
    nfseMunicipalityStatus && !nfseMunicipalityStatus.aderenteEmissorNacional,
  );
  const nfseConnectivity =
    nfse.ready && !municipalityBlocksAutomaticIssuance
      ? nfseProvider.key === "joinville"
        ? await testNfseJoinvilleConnectivity().catch(() => null)
        : await testNfseNationalConnectivity().catch(() => null)
      : null;

  addCheck(
    checks,
    "nfse-municipality",
    nfseProvider.key === "joinville"
      ? "pass"
      : !nfseReferenceCity || !nfseReferenceState
      ? "warn"
      : !nfseMunicipalityStatus
        ? "warn"
        : nfseMunicipalityStatus.aderenteEmissorNacional
          ? "pass"
          : "warn",
    nfseProvider.key === "joinville"
      ? "Joinville/SC pode operar pelo provider municipal NF-em sem depender do Emissor Nacional publico."
      : !nfseReferenceCity || !nfseReferenceState
      ? "Cidade e UF de referencia nao foram encontradas para validar a elegibilidade municipal da NFS-e. Use --city/--state ou NFSE_REFERENCE_CITY/NFSE_REFERENCE_STATE."
      : !nfseMunicipalityStatus
        ? `Nao foi possivel localizar ${nfseReferenceCity}/${nfseReferenceState} na base publica de municipios aderentes.`
        : nfseMunicipalityStatus.aderenteEmissorNacional
          ? `${nfseMunicipalityStatus.city}/${nfseMunicipalityStatus.state} esta liberado para emissor nacional.`
          : isJoinvilleReference(nfseReferenceCity, nfseReferenceState)
            ? `${nfseMunicipalityStatus.city}/${nfseMunicipalityStatus.state} tem convenio ${nfseMunicipalityStatus.statusConvenio}, mas ainda nao esta liberado no Emissor Nacional. Para este municipio, priorize o provider municipal NF-em.`
            : `${nfseMunicipalityStatus.city}/${nfseMunicipalityStatus.state} tem convenio ${nfseMunicipalityStatus.statusConvenio}, mas ainda nao esta liberado no Emissor Nacional.`,
  );

  addCheck(
    checks,
    "nfse-connectivity",
    !nfse.ready
      ? "warn"
      : municipalityBlocksAutomaticIssuance
        ? "warn"
        : nfseConnectivity?.ok
          ? "pass"
          : "fail",
    !nfse.ready
      ? "Conectividade da NFS-e nao foi validada porque a integracao oficial ainda nao esta completa."
      : municipalityBlocksAutomaticIssuance
        ? "A conectividade automatica da NFS-e fica limitada enquanto o municipio nao liberar o Emissor Nacional."
        : nfseConnectivity?.ok
          ? `Endpoint oficial da NFS-e respondeu para ${nfseConnectivity.target}.`
          : nfseConnectivity?.error
            ? `Falha ao validar endpoint oficial da NFS-e: ${nfseConnectivity.error}`
            : nfseConnectivity?.status
              ? `Endpoint oficial da NFS-e respondeu com status ${nfseConnectivity.status}.`
              : "Nao foi possivel concluir a validacao da conectividade oficial da NFS-e.",
  );

  const passCount = checks.filter((check) => check.level === "pass").length;
  const warnCount = checks.filter((check) => check.level === "warn").length;
  const failCount = checks.filter((check) => check.level === "fail").length;

  printSection("Gestao Facil Production Readiness");
  console.log(`Ambiente carregado de: ${envFile}`);
  console.log(`Modo estrito: ${strict ? "sim" : "nao"}`);
  printChecks(checks);

  printSection("Resumo");
  console.log(`Pass: ${passCount}`);
  console.log(`Warn: ${warnCount}`);
  console.log(`Fail: ${failCount}`);

  printSection("Proxima acao sugerida");

  if (failCount > 0) {
    console.log("Feche primeiro os FAILs para evitar deploy quebrado ou integracoes indisponiveis.");
  } else if (warnCount > 0) {
    console.log("O ambiente sobe, mas ainda ha riscos operacionais. Feche os WARNs antes de abrir para clientes reais.");
  } else {
    console.log("Ambiente pronto para deploy e validacao assistida.");
  }

  if (failCount > 0 || (strict && warnCount > 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\n[FAIL] readiness-script:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
