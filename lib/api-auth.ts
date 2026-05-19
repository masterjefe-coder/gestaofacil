import { NextResponse } from "next/server";
import { AuthSessionError, requireSessionUser } from "@/lib/auth-session";

export async function requireApiSession() {
  try {
    await requireSessionUser();
    return null;
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Falha ao validar sessao." }, { status: 500 });
  }
}
