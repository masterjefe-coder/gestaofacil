import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { recordAuditEvent } from "@/lib/audit-repository";

const logger = getLogger({ route: "api/auth/logout-track" });

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });

  try {
    const context = await getCurrentWorkspaceContext();
    const userAgent = request.headers.get("user-agent");

    await recordAuditEvent({
      action: "auth.logout.requested",
      entityType: "user",
      entityId: context.userId,
      context,
      payload: {
        summary: `${context.email} encerrou a sessão do workspace.`,
        metadata: {
          email: context.email,
          userAgent: userAgent || null,
        },
      },
    });

    requestLogger.info("Logout tracked", { email: context.email });
    return attachRequestId(NextResponse.json({ tracked: true }), requestId);
  } catch {
    requestLogger.warn("Logout tracking failed");
    return attachRequestId(NextResponse.json({ tracked: false }, { status: 200 }), requestId);
  }
}
