export function normalizePhone(value: string | undefined | null) {
  return (value || "").replace(/\D/g, "");
}

export function normalizeRemoteJid(value: string | undefined | null) {
  const raw = (value || "").trim();

  if (!raw) {
    return "";
  }

  return normalizePhone(raw.split("@")[0] || raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNestedString(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    if (!isRecord(current) || !(key in current)) {
      return "";
    }

    current = current[key];
  }

  return typeof current === "string" ? current.trim() : "";
}

export function extractMessageId(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const candidates = [
    ["messageId"],
    ["id"],
    ["key", "id"],
    ["data", "messageId"],
    ["data", "id"],
    ["data", "key", "id"],
    ["response", "messageId"],
    ["response", "id"],
    ["response", "key", "id"],
  ];

  for (const path of candidates) {
    const candidate = getNestedString(payload, path);

    if (candidate) {
      return candidate;
    }
  }

  return "";
}

export function extractRemoteJid(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const candidates = [
    ["remoteJid"],
    ["jid"],
    ["key", "remoteJid"],
    ["data", "remoteJid"],
    ["data", "jid"],
    ["data", "key", "remoteJid"],
    ["response", "remoteJid"],
    ["response", "jid"],
    ["response", "key", "remoteJid"],
  ];

  for (const path of candidates) {
    const candidate = getNestedString(payload, path);

    if (candidate) {
      return candidate;
    }
  }

  return "";
}

export function extractMessagePreview(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const candidates = [
    ["text"],
    ["body"],
    ["message"],
    ["data", "text"],
    ["data", "body"],
    ["data", "message"],
    ["data", "message", "conversation"],
    ["data", "message", "text"],
    ["response", "text"],
    ["response", "body"],
    ["response", "message"],
  ];

  for (const path of candidates) {
    const candidate = getNestedString(payload, path);

    if (candidate) {
      return candidate;
    }
  }

  return "";
}
