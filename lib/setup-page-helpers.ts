export function getEvolutionStateLabel(value: string | undefined) {
  switch (value) {
    case "open":
      return "conectada";
    case "connecting":
      return "aguardando pareamento";
    case "close":
      return "desconectada";
    default:
      return value || "desconhecido";
  }
}

export function getEvolutionOperationalSummary(input: {
  integrationEnabled: boolean;
  probeReachable: boolean;
  instanceState?: string;
}) {
  if (!input.integrationEnabled) {
    return {
      tone: "pending" as const,
      title: "WhatsApp ainda não configurado",
      description: "Conecte a Evolution API e escolha uma instância para começar a operar o canal.",
    };
  }

  if (!input.probeReachable) {
    return {
      tone: "warning" as const,
      title: "API do WhatsApp sem resposta",
      description: "A configuração existe, mas o app não conseguiu alcançar a Evolution API agora.",
    };
  }

  if (input.instanceState === "open") {
    return {
      tone: "success" as const,
      title: "WhatsApp pronto para rotina",
      description: "A API responde e a instância principal já está aberta para operação real.",
    };
  }

  if (input.instanceState === "connecting") {
    return {
      tone: "warning" as const,
      title: "WhatsApp aguardando conclusão",
      description: "A API responde, mas a instância principal ainda está em pareamento e não está pronta para rotina contínua.",
    };
  }

  if (input.instanceState === "close") {
    return {
      tone: "warning" as const,
      title: "WhatsApp configurado, mas desconectado",
      description: "A API responde, porém a instância principal está fechada e precisa ser reconectada.",
    };
  }

  return {
    tone: "warning" as const,
    title: "WhatsApp com estado indefinido",
    description: "A API responde, mas a instância principal ainda não confirmou um estado operacional estável.",
  };
}

export function getNfseMunicipalityBlockSummary(input: {
  city?: string;
  state?: string;
  statusConvenio?: string;
  aderenteAmbienteNacional?: boolean;
  aderenteEmissorNacional?: boolean;
}) {
  if (!input.city || !input.state) {
    return null;
  }

  if (input.aderenteEmissorNacional) {
    return {
      tone: "success" as const,
      title: "Município liberado para emissor nacional",
      description: "O estabelecimento está em município com sinal favorável para emissão pública/API nacional.",
    };
  }

  return {
    tone: "warning" as const,
    title: "Bloqueio municipal para emissão automática",
    description: `${input.city}/${input.state} está com convênio ${String(input.statusConvenio || "não informado").toLowerCase()}, mas ainda sem liberação no Emissor Nacional.`,
  };
}

export function getSetupHealthTone(input: { ok: boolean; warning?: boolean }) {
  if (input.ok && !input.warning) {
    return "split-panel success";
  }

  return "split-panel";
}

export function getSuggestedEvolutionInstanceName(input: {
  configuredInstanceName?: string;
  evolutionInstances: Array<{ instanceName: string; status?: string }>;
}) {
  const configuredInstanceName = input.configuredInstanceName?.trim() || "";

  if (configuredInstanceName) {
    return configuredInstanceName;
  }

  const openInstances = input.evolutionInstances.filter((instance) => (instance.status || "").toLowerCase() === "open");

  return openInstances.length === 1 ? openInstances[0]?.instanceName || "" : "";
}
