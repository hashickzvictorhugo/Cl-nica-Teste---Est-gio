export type Provider = {
  id: string;
  name: string;
  specialty: string;
  initials: string;
  description: string;
};

export const PROVIDERS = [
  {
    id: "ana-martins",
    name: "Dra. Ana Martins",
    specialty: "Clínica Geral",
    initials: "AM",
    description: "Avaliação clínica e acompanhamento de rotina.",
  },
  {
    id: "lucas-ferreira",
    name: "Dr. Lucas Ferreira",
    specialty: "Cardiologia",
    initials: "LF",
    description: "Acompanhamento cardiovascular e prevenção.",
  },
  {
    id: "camila-rocha",
    name: "Dra. Camila Rocha",
    specialty: "Dermatologia",
    initials: "CR",
    description: "Cuidados com pele, cabelos e unhas.",
  },
  {
    id: "beatriz-lima",
    name: "Dra. Beatriz Lima",
    specialty: "Pediatria",
    initials: "BL",
    description: "Acompanhamento infantil e orientação preventiva.",
  },
] as const satisfies readonly Provider[];

export const DEFAULT_PROVIDER_ID: string = PROVIDERS[0].id;

export function getProviderById(value: unknown): Provider | null {
  if (typeof value !== "string") return null;
  return PROVIDERS.find((provider) => provider.id === value) ?? null;
}

export function resolveProvider(value: unknown): Provider | null {
  if (value === undefined || value === null || value === "") return PROVIDERS[0];
  return getProviderById(value);
}
