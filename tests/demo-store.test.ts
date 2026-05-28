import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { readDemoWorkspaceData } from "@/lib/demo-store";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "demo-workspace.json");

async function withDemoStoreFixture<T>(fixture: unknown, fn: () => Promise<T>) {
  await mkdir(dataDir, { recursive: true });
  const previous = await readFile(dataFile, "utf8").catch(() => null);

  await writeFile(dataFile, JSON.stringify(fixture, null, 2), "utf8");

  try {
    return await fn();
  } finally {
    if (previous === null) {
      await unlink(dataFile).catch(() => undefined);
    } else {
      await writeFile(dataFile, previous, "utf8");
    }
  }
}

test("readDemoWorkspaceData merges missing defaults into partial demo store data", async () => {
  await withDemoStoreFixture(
    {
      workspace: {
        slug: "workspace-personalizado",
      },
      company: {
        tradeName: "Empresa Demo Personalizada",
      },
    },
    async () => {
      const data = await readDemoWorkspaceData();

      assert.equal(data.workspace.slug, "workspace-personalizado");
      assert.equal(data.workspace.name, "Gestao Facil Demo");
      assert.equal(data.company.tradeName, "Empresa Demo Personalizada");
      assert.equal(data.company.legalName, "LOJA ONLINE OFERTAS DO TON LTDA");
      assert.equal(data.company.evolutionInstanceName, "ofertas-do-ton");
      assert.equal(data.subscription.plan, "PROFESSIONAL");
      assert.equal(Array.isArray(data.customers), true);
      assert.equal(Array.isArray(data.charges), true);
    },
  );
});
