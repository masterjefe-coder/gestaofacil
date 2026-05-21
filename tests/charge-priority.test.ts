import test from "node:test";
import assert from "node:assert/strict";
import { getChargeUrgency, getChargeUrgencyLabel, sortChargesByPriority } from "@/lib/charge-priority";
import type { Charge } from "@/lib/types";

function buildCharge(partial: Partial<Charge>): Charge {
  return {
    id: partial.id || "charge-1",
    customer: partial.customer || "Cliente",
    amount: partial.amount || "R$ 100",
    dueLabel: partial.dueLabel || "acompanhar cobranca",
    dueDate: partial.dueDate,
    status: partial.status || "Pendente",
    source: partial.source || "Pix",
    paymentLink: partial.paymentLink,
    followUps: partial.followUps || [],
    cadence: partial.cadence,
    externalBilling: partial.externalBilling,
  };
}

test("getChargeUrgency treats overdue date as overdue", () => {
  const charge = buildCharge({
    dueDate: "2026-05-20",
    status: "Vencida",
  });

  assert.equal(getChargeUrgency(charge, new Date("2026-05-21T12:00:00.000Z")), "overdue");
  assert.equal(getChargeUrgencyLabel(charge, new Date("2026-05-21T12:00:00.000Z")), "Atrasada");
});

test("sortChargesByPriority keeps overdue charges ahead of upcoming ones", () => {
  const charges = sortChargesByPriority([
    buildCharge({ id: "upcoming", dueDate: "2026-05-24", status: "Pendente", customer: "B" }),
    buildCharge({ id: "overdue", dueDate: "2026-05-20", status: "Vencida", customer: "A" }),
  ], new Date("2026-05-21T12:00:00.000Z"));

  assert.deepEqual(charges.map((charge) => charge.id), ["overdue", "upcoming"]);
});
