export function resolveAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const evolutionWebhookUrl = process.env.EVOLUTION_WEBHOOK_URL?.trim();

  if (evolutionWebhookUrl) {
    try {
      return new URL(evolutionWebhookUrl).origin;
    } catch {
      return null;
    }
  }

  return null;
}
