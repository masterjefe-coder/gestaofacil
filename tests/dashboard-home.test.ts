import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardModuleCards,
  getDashboardPriorityClass,
  getDashboardPriorityLabel,
} from "@/lib/dashboard-home";
import { getEvolutionStateLabel, getSetupHealthTone } from "@/lib/setup-page-helpers";

test("dashboard priority helpers map labels and classes consistently", () => {
  assert.equal(getDashboardPriorityLabel("critical"), "Prioridade crítica");
  assert.equal(getDashboardPriorityLabel("high"), "Prioridade alta");
  assert.equal(getDashboardPriorityLabel("normal"), "Prioridade normal");
  assert.equal(getDashboardPriorityClass("critical"), "priority-critical");
  assert.equal(getDashboardPriorityClass("high"), "priority-high");
  assert.equal(getDashboardPriorityClass("normal"), "priority-normal");
});

test("dashboard home keeps the main module entrypoints available", () => {
  assert.equal(dashboardModuleCards.length >= 8, true);
  assert.equal(dashboardModuleCards.some((item) => item.href === "/dashboard/quotes"), true);
  assert.equal(dashboardModuleCards.some((item) => item.href === "/dashboard/setup#team-section"), true);
});

test("setup page helpers keep integration state copy stable", () => {
  assert.equal(getEvolutionStateLabel("open"), "conectada");
  assert.equal(getEvolutionStateLabel("connecting"), "aguardando pareamento");
  assert.equal(getEvolutionStateLabel(undefined), "desconhecido");
  assert.equal(getSetupHealthTone({ ok: true }), "split-panel success");
  assert.equal(getSetupHealthTone({ ok: false, warning: true }), "split-panel");
});
