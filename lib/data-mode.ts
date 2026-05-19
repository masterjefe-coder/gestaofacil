export const DEMO_WORKSPACE_ID = "demo-workspace";

export function isLocalDataMode() {
  return !process.env.DATABASE_URL || process.env.GESTAO_FACIL_DATA_MODE === "local";
}

export function isDatabaseMode() {
  return !isLocalDataMode();
}
