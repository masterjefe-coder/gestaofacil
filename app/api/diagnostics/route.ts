import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getLogger } from "@/lib/api-logger";
import { buildOperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { timingSafeCompare } from "@/lib/security-crypto";

const logger = getLogger({ route: "api/diagnostics" });

async function getSessionEmailSafe() {
  try {
    return (await getServerSession(authOptions))?.user?.email?.trim() || null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("outside a request scope")) {
      return null;
    }

    throw error;
  }
}

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const configuredHealthToken = process.env.HEALTHCHECK_TOKEN?.trim();
  const receivedHealthToken = request.headers.get("x-health-token")?.trim();
  const hasValidHealthToken = timingSafeCompare(receivedHealthToken, configuredHealthToken);
  const sessionEmail = hasValidHealthToken ? null : await getSessionEmailSafe();
  const canSeeDetails = hasValidHealthToken || Boolean(sessionEmail);

  if (!canSeeDetails) {
    requestLogger.warn("Operational diagnostics rejected because requester is not authorized");
    return attachRequestId(
      NextResponse.json({ error: "Diagnostico operacional nao autorizado." }, { status: 401 }),
      requestId,
    );
  }

  const snapshot = await buildOperationalDiagnosticsSnapshot(requestId);
  const warningCount = snapshot.checks.filter((check) => check.level === "warning").length;

  requestLogger.info("Operational diagnostics served", {
    warningCount,
    mode: snapshot.runtime.mode,
    asaasEnabled: snapshot.integrations.asaas.enabled,
    evolutionEnabled: snapshot.integrations.evolution.enabled,
    nfseReady: snapshot.integrations.nfse.ready,
    openCircuitBreakerCount: snapshot.resilience.openCircuitBreakerCount,
    halfOpenCircuitBreakerCount: snapshot.resilience.halfOpenCircuitBreakerCount,
  });

  return attachRequestId(NextResponse.json(snapshot), requestId);
}
