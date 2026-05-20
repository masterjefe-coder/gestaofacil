import { cookies } from "next/headers";

export type DashboardQueueModule = "billing" | "customers" | "quotes" | "orders" | "fiscal";

export type DashboardQueuePreference = {
  view?: string;
  focus?: string;
};

const COOKIE_NAME = "gf-dashboard-queue-preferences";

function isPreferenceMap(value: unknown): value is Partial<Record<DashboardQueueModule, DashboardQueuePreference>> {
  return typeof value === "object" && value !== null;
}

async function readPreferenceMap() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return {} as Partial<Record<DashboardQueueModule, DashboardQueuePreference>>;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPreferenceMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function readDashboardQueuePreference(module: DashboardQueueModule) {
  const map = await readPreferenceMap();
  return map[module] || {};
}

export async function writeDashboardQueuePreference(
  module: DashboardQueueModule,
  preference: DashboardQueuePreference,
) {
  const cookieStore = await cookies();
  const current = await readPreferenceMap();

  current[module] = {
    view: preference.view || undefined,
    focus: preference.focus || undefined,
  };

  cookieStore.set(COOKIE_NAME, JSON.stringify(current), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
