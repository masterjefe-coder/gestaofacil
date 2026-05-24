import { listNfseNationalCoverageGaps } from "@/lib/nfse-national-municipal-status";
import { listKnownMunicipalNfseProviders } from "@/lib/nfse-provider";

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const limit = Number(getArgValue("--limit") || "20");
  const gaps = await listNfseNationalCoverageGaps(limit);
  const knownProviders = listKnownMunicipalNfseProviders();

  console.log("Gestao Facil NFSE Municipal Priority");
  console.log(`Municipios analisados: ${gaps.length}`);
  console.log(`Providers municipais ja preparados na base: ${knownProviders.map((provider) => provider.label).join(", ") || "nenhum"}`);

  if (gaps.length === 0) {
    console.log("Nenhum municipio com gap de emissor nacional foi encontrado na base oficial atual.");
    return;
  }

  console.log("\nTop oportunidades por populacao e gap no Emissor Nacional:\n");

  for (const [index, item] of gaps.entries()) {
    const populationLabel = item.population
      ? new Intl.NumberFormat("pt-BR").format(item.population)
      : "nao informada";
    const alreadyCovered =
      item.city.trim().toUpperCase() === "JOINVILLE" && item.state.trim().toUpperCase() === "SC";

    console.log(
      `${String(index + 1).padStart(2, "0")}. ${item.city}/${item.state} | Populacao: ${populationLabel} | Convenio: ${item.statusConvenio}${alreadyCovered ? " | provider municipal ja integrado" : ""}`,
    );
  }

  console.log(`\nFonte oficial: ${gaps[0]?.sourceUrl || "nao identificada"}`);
  console.log(`Base consultada em: ${gaps[0]?.checkedAt || new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("\n[FAIL] nfse-municipal-priority:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
