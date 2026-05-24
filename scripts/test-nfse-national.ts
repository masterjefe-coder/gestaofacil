import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { decodeNfseXmlGZipB64 } from "@/lib/nfse-national-client";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import { buildSignedDpsPayload, inspectNfseNationalCertificate, testNfseNationalConnectivity } from "@/lib/nfse-national-provider";
import { readDemoWorkspaceData } from "@/lib/demo-store";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function printBlock(title: string, payload: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function resolveFiscalSetup() {
  const data = await readDemoWorkspaceData();

  return {
    legalName:
      getArgValue("--legalName")
      || process.env.NFSE_REFERENCE_LEGAL_NAME?.trim()
      || data.company.legalName,
    tradeName:
      getArgValue("--tradeName")
      || process.env.NFSE_REFERENCE_TRADE_NAME?.trim()
      || data.company.tradeName,
    document:
      getArgValue("--issuerDocument")
      || process.env.NFSE_REFERENCE_DOCUMENT?.trim()
      || data.company.document,
    city:
      getArgValue("--city")
      || process.env.NFSE_REFERENCE_CITY?.trim()
      || data.company.city,
    state:
      getArgValue("--state")
      || process.env.NFSE_REFERENCE_STATE?.trim()
      || data.company.state,
    municipalCode:
      getArgValue("--municipalCode")
      || process.env.NFSE_NATIONAL_MUNICIPAL_CODE?.trim()
      || data.company.municipalCode,
    serviceDescription:
      getArgValue("--serviceDescription")
      || process.env.NFSE_REFERENCE_SERVICE_DESCRIPTION?.trim()
      || data.company.serviceDescription,
    defaultFiscalServiceCode:
      getArgValue("--serviceCode")
      || process.env.NFSE_NATIONAL_SERVICE_CODE?.trim()
      || data.company.defaultFiscalServiceCode,
  };
}

function issueViaWindowsHttpClient(payloadPath: string) {
  const script = `
$envFile = Join-Path (Get-Location) '.env.local'
$lines = Get-Content $envFile
foreach ($rawLine in $lines) {
  $line = $rawLine.Trim()
  if (-not $line -or $line.StartsWith('#')) { continue }
  $idx = $line.IndexOf('=')
  if ($idx -lt 0) { continue }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim().Trim('"')
  if (-not (Test-Path "Env:$key")) { Set-Item -Path "Env:$key" -Value $value }
}
$certPassword = ConvertTo-SecureString $env:NFSE_NATIONAL_CERT_PASSPHRASE -AsPlainText -Force
$imported = Import-PfxCertificate -FilePath $env:NFSE_NATIONAL_CERT_PFX_PATH -CertStoreLocation Cert:\\CurrentUser\\My -Password $certPassword -Exportable
try {
  $thumb = $imported.Thumbprint
  $body = Get-Content '${payloadPath.replace(/\\/g, "\\\\")}' -Raw
  $url = if ($env:NFSE_NATIONAL_ENVIRONMENT -eq 'production') { 'https://sefin.nfse.gov.br/SefinNacional/nfse' } else { 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse' }
  $resp = Invoke-WebRequest -Uri $url -CertificateThumbprint $thumb -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -SkipHttpErrorCheck
  [PSCustomObject]@{ StatusCode = [int]$resp.StatusCode; Body = $resp.Content } | ConvertTo-Json -Depth 8
} finally {
  if ($imported -and $imported.PSPath) { Remove-Item -LiteralPath $imported.PSPath -Force }
}`.trim();

  return execFileSync("pwsh", ["-NoProfile", "-Command", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const overrideCustomerName = getArgValue("--customerName");
  const overrideCustomerDocument = getArgValue("--customerDocument");

  const certificate = await inspectNfseNationalCertificate();
  printBlock("CERTIFICADO", certificate);

  const setup = await resolveFiscalSetup();
  const municipalCode = setup.municipalCode;
  const municipalCity = setup.city;
  const municipalState = setup.state;
  printBlock("SETUP", {
    legalName: setup.legalName,
    document: setup.document,
    city: municipalCity,
    state: municipalState,
    municipalCode,
    defaultFiscalServiceCode: setup.defaultFiscalServiceCode,
  });

  const municipalityStatus = await getNfseNationalMunicipalityStatus(municipalCity || "", municipalState || "");
  printBlock("STATUS MUNICIPIO", municipalityStatus);

  const connectivity = await testNfseNationalConnectivity(municipalCode);
  printBlock("CONECTIVIDADE", connectivity);

  const data = await readDemoWorkspaceData();
  const document = data.nfseDocuments[0];
  const customer = data.customers.find((item) => item.name === document.customer);

  if (!document || !customer?.document) {
    throw new Error("Documento fiscal demo ou documento do cliente não encontrados para o teste.");
  }

  const signed = await buildSignedDpsPayload({
    issuer: {
      name: setup.legalName || setup.tradeName,
      document: setup.document,
      city: municipalCity,
      state: municipalState,
    },
    customer: {
      name: overrideCustomerName || customer.name,
      document: overrideCustomerDocument || customer.document,
      city: customer.city,
      state: municipalState,
    },
    serviceDescription: document.serviceDescription || setup.serviceDescription,
    serviceAmount: Number(document.serviceAmount.replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".")),
    competenceDate: new Date(),
    issueDate: new Date(),
    number: `${Date.now()}`.slice(-15),
  }, {
    municipalCode,
    serviceCode: document.serviceCode || setup.defaultFiscalServiceCode,
  });

  printBlock("DPS PREVIEW", {
    dpsId: signed.dpsId,
    digest: signed.digest,
    xmlPreview: signed.xml.slice(0, 1200),
  });

  const payloadPath = path.join(process.cwd(), ".tmp-nfse-payload.json");
  writeFileSync(payloadPath, JSON.stringify({
    dpsXmlGZipB64: gzipSync(Buffer.from(signed.xml, "utf8")).toString("base64"),
  }), "utf8");
  const response = JSON.parse(issueViaWindowsHttpClient(payloadPath)) as { StatusCode: number; Body: string };

  let parsedBody: unknown = response.Body;

  try {
    parsedBody = JSON.parse(response.Body);
  } catch {
    parsedBody = response.Body;
  }

  if (
    typeof parsedBody === "object"
    && parsedBody !== null
    && "nfseXmlGZipB64" in parsedBody
    && typeof (parsedBody as { nfseXmlGZipB64?: unknown }).nfseXmlGZipB64 === "string"
  ) {
    parsedBody = {
      ...(parsedBody as Record<string, unknown>),
      nfseXmlPreview: decodeNfseXmlGZipB64((parsedBody as { nfseXmlGZipB64: string }).nfseXmlGZipB64).slice(0, 2000),
    };
  }

  printBlock("RESPOSTA EMISSAO", {
    status: response.StatusCode,
    body: parsedBody,
  });
}

main().catch((error) => {
  console.error("\n=== FALHA NO TESTE NACIONAL ===");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
