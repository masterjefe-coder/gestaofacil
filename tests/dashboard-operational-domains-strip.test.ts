import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardOperationalDomainsStrip } from "@/components/dashboard-operational-domains-strip";

test("dashboard operational domains strip highlights clickable domains in attention", () => {
  const html = renderToStaticMarkup(createElement(DashboardOperationalDomainsStrip, {
    signals: [
      {
        href: "/dashboard/setup",
        label: "WhatsApp",
        status: "warning",
      },
      {
        href: "/dashboard/fiscal",
        label: "Fiscal",
        status: "critical",
      },
    ],
  }));

  assert.match(html, /2 dominios pedem atencao agora\./);
  assert.match(html, /WhatsApp/);
  assert.match(html, /Fiscal/);
  assert.match(html, /dashboard-domain-chip-critical/);
});

test("dashboard operational domains strip shows healthy fallbacks when there are no signals", () => {
  const html = renderToStaticMarkup(createElement(DashboardOperationalDomainsStrip, {
    signals: [],
  }));

  assert.match(html, /Operacao distribuida e estavel/);
  assert.match(html, /Base estavel/);
  assert.match(html, /Fluxo estavel/);
});
