import assert from "node:assert/strict";
import test from "node:test";
import {
  FormInputError,
  readFormCheckbox,
  readOptionalFormEnum,
  readOptionalFormMaybeString,
  readRequiredFormEnum,
  readRequiredFormString,
  readRequiredPositiveNumber,
} from "@/lib/form-inputs";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
}

test("form inputs trim required and optional strings", () => {
  const formData = buildFormData({
    name: "  Gestao Facil ",
    city: " Sao Paulo ",
  });

  assert.equal(readRequiredFormString(formData, "name"), "Gestao Facil");
  assert.equal(readOptionalFormMaybeString(formData, "city"), "Sao Paulo");
  assert.equal(readOptionalFormMaybeString(formData, "state"), undefined);
});

test("form inputs reject invalid required enum values", () => {
  const formData = buildFormData({
    status: "Cancelado",
  });

  assert.throws(
    () => readRequiredFormEnum(formData, "status", ["Ativo", "Recorrente"]),
    (error: unknown) => error instanceof FormInputError && /status/i.test(error.message),
  );
});

test("form inputs keep fallback for optional enum and parse checkbox", () => {
  const formData = buildFormData({
    enabled: "on",
  });

  assert.equal(readOptionalFormEnum(formData, "role", ["MEMBER", "ADMIN"], "MEMBER"), "MEMBER");
  assert.equal(readFormCheckbox(formData, "enabled"), true);
  assert.equal(readFormCheckbox(formData, "disabled"), false);
});

test("form inputs require positive numeric values", () => {
  const valid = buildFormData({
    income: "2500,50",
  });
  const invalid = buildFormData({
    income: "0",
  });

  assert.equal(readRequiredPositiveNumber(valid, "income"), 2500.5);
  assert.throws(
    () => readRequiredPositiveNumber(invalid, "income"),
    (error: unknown) => error instanceof FormInputError,
  );
});
