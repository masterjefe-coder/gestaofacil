import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const REQUEST_ID_HEADER = "x-request-id";

type RequestLike = Request | NextRequest;

export function getOrCreateRequestId(request: RequestLike): string {
  const incomingRequestId = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return incomingRequestId || randomUUID();
}

export function attachRequestId<T extends NextResponse>(response: T, requestId: string): T {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
