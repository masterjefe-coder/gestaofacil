import { isLocalDataMode } from "@/lib/data-mode";

export function canUsePublicDemoCredentials() {
  return isLocalDataMode();
}

export function isWebhookSecretConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}
