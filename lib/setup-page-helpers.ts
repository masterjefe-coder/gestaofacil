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

export function getSetupHealthTone(input: { ok: boolean; warning?: boolean }) {
  if (input.ok && !input.warning) {
    return "split-panel success";
  }

  return "split-panel";
}
