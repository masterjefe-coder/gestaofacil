import { isLocalDataMode } from "@/lib/data-mode";

export function canUsePublicDemoCredentials() {
  return isLocalDataMode() && process.env.GESTAO_FACIL_ENABLE_PUBLIC_DEMO?.trim().toLowerCase() === "true";
}

export function isWebhookSecretConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}
