import crypto from "node:crypto";

const ENCRYPTED_PREFIX = "enc:v1:";
const IV_LENGTH = 12;

function getKeyMaterial() {
  return process.env.WORKSPACE_SECRET_KEY?.trim()
    || process.env.AUTH_SECRET?.trim()
    || process.env.NEXTAUTH_SECRET?.trim()
    || "";
}

function getEncryptionKey() {
  const material = getKeyMaterial();

  if (!material) {
    throw new Error("Defina WORKSPACE_SECRET_KEY ou AUTH_SECRET para proteger segredos do workspace.");
  }

  return crypto.createHash("sha256").update(material).digest();
}

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value && value.startsWith(ENCRYPTED_PREFIX));
}

export function encryptWorkspaceSecret(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (isEncryptedSecret(normalized)) {
    return normalized;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptWorkspaceSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!isEncryptedSecret(normalized)) {
    return normalized;
  }

  const payload = normalized.slice(ENCRYPTED_PREFIX.length);
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Segredo criptografado do workspace está em formato inválido.");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
