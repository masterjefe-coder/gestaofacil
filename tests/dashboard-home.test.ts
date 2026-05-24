import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardModuleCards,
  getDashboardHeroState,
  getOperationalPromotionForRecommendation,
  orderDashboardModuleCards,
  orderDashboardRecommendations,
  getDashboardPriorityClass,
  getDashboardPriorityLabel,
} from "@/lib/dashboard-home";
import { mapOperationalAlertsToNavigationSignals } from "@/lib/dashboard-navigation-signals";
import {
  getEvolutionOperationalSummary,
  getEvolutionStateLabel,
  getNfseMunicipalityBlockSummary,
  getSetupHealthTone,
} from "@/lib/setup-page-helpers";

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

test("dashboard navigation exposes operational domains in existing modules", () => {
  const signals = mapOperationalAlertsToNavigationSignals([
    {
      id: "evolution-unreachable",
      tone: "warning",
      title: "WhatsApp com conectividade instavel",
      message: "Sem resposta",
    },
    {
      id: "fiscal-not-ready",
      tone: "warning",
      title: "Setup fiscal ainda incompleto",
      message: "Pendencia fiscal",
    },
  ]);

  assert.equal(signals.some((item) => item.href === "/dashboard/setup" && item.label === "WhatsApp"), true);
  assert.equal(signals.some((item) => item.href === "/dashboard/fiscal" && item.label === "Fiscal"), true);
});

test("dashboard home prioritizes module cards that are operationally critical", () => {
  const ordered = orderDashboardModuleCards([
    {
      href: "/dashboard/fiscal",
      label: "Fiscal",
      status: "critical",
    },
    {
      href: "/dashboard/setup",
      label: "WhatsApp",
      status: "warning",
    },
  ]);

  assert.equal(ordered[0]?.href, "/dashboard/fiscal");
  assert.equal(ordered[1]?.href, "/dashboard/setup#integrations-section");
  assert.equal(ordered.some((item) => item.href === dashboardModuleCards[0]?.href), true);
});

test("dashboard home prioritizes recommendations tied to critical operational domains", () => {
  const ordered = orderDashboardRecommendations([
    {
      kicker: "Comercial",
      title: "Retomar proposta de Studio Lume",
      description: "Follow-up comercial.",
      href: "/dashboard/quotes?focus=hot",
      hrefLabel: "Abrir orçamentos",
      priority: "critical",
    },
    {
      kicker: "Fiscal",
      title: "Destravar documento de Casa Nobre",
      description: "Documento travado.",
      href: "/dashboard/fiscal?focus=blocked",
      hrefLabel: "Abrir fiscal",
      priority: "high",
    },
  ], [
    {
      href: "/dashboard/fiscal",
      label: "Fiscal",
      status: "critical",
    },
  ]);

  assert.equal(ordered[0]?.href, "/dashboard/fiscal?focus=blocked");
  assert.equal(ordered[1]?.href, "/dashboard/quotes?focus=hot");
});

test("dashboard home exposes operational promotion metadata for matching recommendations", () => {
  const promotion = getOperationalPromotionForRecommendation({
    kicker: "Fiscal",
    title: "Destravar documento de Casa Nobre",
    description: "Documento travado.",
    href: "/dashboard/fiscal?focus=blocked",
    hrefLabel: "Abrir fiscal",
    priority: "high",
  }, [
    {
      href: "/dashboard/fiscal",
      label: "Fiscal",
      status: "critical",
    },
  ]);

  assert.deepEqual(promotion, {
    label: "Prioridade operacional",
    status: "critical",
    signalLabel: "Fiscal",
  });
});

test("dashboard hero promotes critical operational alert over recommendation flow", () => {
  const hero = getDashboardHeroState([
    {
      kicker: "Comercial",
      title: "Retomar proposta de Studio Lume",
      description: "Follow-up comercial.",
      href: "/dashboard/quotes?focus=hot",
      hrefLabel: "Abrir orçamentos",
      priority: "critical",
    },
  ], [
    {
      href: "/dashboard/setup",
      label: "Plano",
      status: "critical",
    },
  ], {
    id: "subscription-restricted",
    tone: "critical",
    title: "Assinatura exige atenção",
    message: "O workspace opera com limitações.",
    href: "/dashboard/setup?subscriptionIntent=1&operationalFocus=subscription#subscription-section",
    hrefLabel: "Ajustar plano",
    recoveryMessage: "Checkout sincronizado recentemente.",
  });

  assert.equal(hero.mode, "operational");
  assert.equal(hero.priority, "critical");
  assert.equal(hero.href, "/dashboard/setup?subscriptionIntent=1&operationalFocus=subscription#subscription-section");
  assert.equal(hero.badgeLabel, "Prioridade operacional");
  assert.equal(hero.sourceLabel, "Plano");
});

test("setup page helpers keep integration state copy stable", () => {
  assert.equal(getEvolutionStateLabel("open"), "conectada");
  assert.equal(getEvolutionStateLabel("connecting"), "aguardando pareamento");
  assert.equal(getEvolutionStateLabel(undefined), "desconhecido");
  assert.equal(getSetupHealthTone({ ok: true }), "split-panel success");
  assert.equal(getSetupHealthTone({ ok: false, warning: true }), "split-panel");
});

test("setup page helpers classify evolution operational readiness", () => {
  assert.deepEqual(getEvolutionOperationalSummary({
    integrationEnabled: true,
    probeReachable: true,
    instanceState: "open",
  }), {
    tone: "success",
    title: "WhatsApp pronto para rotina",
    description: "A API responde e a instância principal já está aberta para operação real.",
  });

  assert.deepEqual(getEvolutionOperationalSummary({
    integrationEnabled: true,
    probeReachable: true,
    instanceState: "close",
  }), {
    tone: "warning",
    title: "WhatsApp configurado, mas desconectado",
    description: "A API responde, porém a instância principal está fechada e precisa ser reconectada.",
  });
});

test("setup page helpers explain municipal blockage for nfse automatic issuance", () => {
  assert.deepEqual(getNfseMunicipalityBlockSummary({
    city: "JOINVILLE",
    state: "SC",
    statusConvenio: "Conveniado Ativo",
    aderenteAmbienteNacional: true,
    aderenteEmissorNacional: false,
  }), {
    tone: "warning",
    title: "Bloqueio municipal para emissão automática",
    description: "JOINVILLE/SC está com convênio conveniado ativo, mas ainda sem liberação no Emissor Nacional.",
  });
});
