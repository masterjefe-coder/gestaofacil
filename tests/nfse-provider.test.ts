import assert from "node:assert/strict";
import test from "node:test";
import { resolveNfseProvider } from "@/lib/nfse-provider";

const originalEnv = {
  NFSE_PROVIDER: process.env.NFSE_PROVIDER,
  NFSE_JOINVILLE_ENABLED: process.env.NFSE_JOINVILLE_ENABLED,
};

function restoreEnv() {
  process.env.NFSE_PROVIDER = originalEnv.NFSE_PROVIDER;
  process.env.NFSE_JOINVILLE_ENABLED = originalEnv.NFSE_JOINVILLE_ENABLED;
}

test("resolveNfseProvider keeps national as default fallback", () => {
  process.env.NFSE_PROVIDER = "auto";
  process.env.NFSE_JOINVILLE_ENABLED = "false";

  try {
    const provider = resolveNfseProvider("Curitiba", "PR");

    assert.equal(provider.key, "national");
  } finally {
    restoreEnv();
  }
});

test("resolveNfseProvider activates joinville provider automatically when enabled", () => {
  process.env.NFSE_PROVIDER = "auto";
  process.env.NFSE_JOINVILLE_ENABLED = "true";

  try {
    const provider = resolveNfseProvider("Joinville", "SC", {
      municipalityStatus: {
        aderenteEmissorNacional: false,
      },
    });

    assert.equal(provider.key, "joinville");
    assert.match(provider.reason, /fallback municipal/i);
  } finally {
    restoreEnv();
  }
});

test("resolveNfseProvider keeps national as default when municipality is covered by emissor nacional", () => {
  process.env.NFSE_PROVIDER = "auto";
  process.env.NFSE_JOINVILLE_ENABLED = "true";

  try {
    const provider = resolveNfseProvider("Joinville", "SC", {
      municipalityStatus: {
        aderenteEmissorNacional: true,
      },
    });

    assert.equal(provider.key, "national");
    assert.match(provider.reason, /Município liberado/i);
  } finally {
    restoreEnv();
  }
});

test("resolveNfseProvider honors explicit provider override", () => {
  process.env.NFSE_PROVIDER = "joinville";
  process.env.NFSE_JOINVILLE_ENABLED = "false";

  try {
    const provider = resolveNfseProvider("Sao Paulo", "SP");

    assert.equal(provider.key, "joinville");
  } finally {
    restoreEnv();
  }
});
