import test from "node:test";
import assert from "node:assert/strict";
import {
  getTransactionalEmailStatus,
  parseEmailFromAddress,
  sendTransactionalEmail,
  transactionalEmailDeps,
} from "@/lib/transactional-email";
import { resetAllCircuitBreakerStates } from "@/lib/api-retry";

const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

test.afterEach(() => {
  process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
  process.env.EMAIL_FROM = originalEnv.EMAIL_FROM;
  transactionalEmailDeps.fetch = (...args: Parameters<typeof fetch>) => fetch(...args);
  resetAllCircuitBreakerStates();
});

test("parseEmailFromAddress accepts display name and extracts normalized address", () => {
  assert.deepEqual(parseEmailFromAddress("Gestao Facil <Convites@GestaoFacilSistemas.com.br>"), {
    valid: true,
    address: "convites@gestaofacilsistemas.com.br",
    displayName: "Gestao Facil",
  });
});

test("parseEmailFromAddress rejects invalid values", () => {
  assert.deepEqual(parseEmailFromAddress("sem-email-valido"), {
    valid: false,
    address: undefined,
    displayName: undefined,
  });
});

test("getTransactionalEmailStatus reports enabled only when api key and sender are valid", () => {
  process.env.RESEND_API_KEY = "re_test_123";
  process.env.EMAIL_FROM = "Gestao Facil <convites@gestaofacilsistemas.com.br>";

  assert.deepEqual(getTransactionalEmailStatus(), {
    enabled: true,
    apiKeyConfigured: true,
    fromConfigured: true,
    fromAddress: "convites@gestaofacilsistemas.com.br",
    fromDisplayName: "Gestao Facil",
    helper: "Email transacional pronto para convites, recuperacao de senha e alertas.",
  });
});

test("sendTransactionalEmail rejects invalid configuration before calling provider", async () => {
  process.env.RESEND_API_KEY = "re_test_123";
  process.env.EMAIL_FROM = "valor-invalido";

  await assert.rejects(
    sendTransactionalEmail({
      to: "cliente@empresa.com.br",
      subject: "Teste",
      html: "<p>Teste</p>",
      text: "Teste",
    }),
    /Configure RESEND_API_KEY e EMAIL_FROM/,
  );
});

test("sendTransactionalEmail posts to provider and returns provider id", async () => {
  process.env.RESEND_API_KEY = "re_test_123";
  process.env.EMAIL_FROM = "Gestao Facil <convites@gestaofacilsistemas.com.br>";

  transactionalEmailDeps.fetch = async (input, init) => {
    assert.equal(input, "https://api.resend.com/emails");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer re_test_123");

    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await sendTransactionalEmail({
    to: "cliente@empresa.com.br",
    subject: "Teste",
    html: "<p>Teste</p>",
    text: "Teste",
  });

  assert.deepEqual(result, { id: "email_123" });
});
