export class FormInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormInputError";
  }
}

export function readRequiredFormString(formData: FormData, key: string, message = "Dados obrigatorios ausentes.") {
  const value = String(formData.get(key) || "").trim();

  if (!value) {
    throw new FormInputError(message);
  }

  return value;
}

export function readOptionalFormString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export function readOptionalFormMaybeString(formData: FormData, key: string) {
  const value = readOptionalFormString(formData, key);
  return value || undefined;
}

export function readOptionalFormEnum<T extends string>(
  formData: FormData,
  key: string,
  options: readonly T[],
  fallback: T,
  message?: string,
) {
  const value = readOptionalFormString(formData, key);

  if (!value) {
    return fallback;
  }

  if (!options.includes(value as T)) {
    throw new FormInputError(message || `Valor invalido para ${key}.`);
  }

  return value as T;
}

export function readRequiredFormEnum<T extends string>(
  formData: FormData,
  key: string,
  options: readonly T[],
  message?: string,
) {
  const value = readRequiredFormString(formData, key, message);

  if (!options.includes(value as T)) {
    throw new FormInputError(message || `Valor invalido para ${key}.`);
  }

  return value as T;
}

export function readFormCheckbox(formData: FormData, key: string) {
  return readOptionalFormString(formData, key) === "on";
}

export function readRequiredPositiveNumber(
  formData: FormData,
  key: string,
  message = "Informe um valor numerico valido.",
) {
  const raw = readRequiredFormString(formData, key, message).replace(",", ".");
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new FormInputError(message);
  }

  return value;
}
