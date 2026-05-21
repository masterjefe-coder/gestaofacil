import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";

export async function POST(request: Request) {
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
  } catch {
    return NextResponse.json({ tracked: false }, { status: 200 });
  }

  return NextResponse.json({ tracked: true });
}
