export const SYMPTOM_DURATIONS = [
  "TODAY",
  "FEW_DAYS",
  "WEEKS",
  "MONTHS",
  "NOT_APPLICABLE",
] as const;

export type SymptomDuration = (typeof SYMPTOM_DURATIONS)[number];

export const VISIT_TYPES = ["FIRST_VISIT", "RETURN"] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export function sanitizeVisitReason(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 5 && normalized.length <= 300 ? normalized : null;
}

export function sanitizeSymptomDuration(
  value: unknown,
): SymptomDuration | "" | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  return SYMPTOM_DURATIONS.includes(value as SymptomDuration)
    ? (value as SymptomDuration)
    : null;
}

export function sanitizeVisitType(value: unknown): VisitType | null {
  if (typeof value !== "string") return null;
  return VISIT_TYPES.includes(value as VisitType) ? (value as VisitType) : null;
}

export function sanitizePatientNotes(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= 500 ? normalized : null;
}

export function symptomDurationLabel(value: string) {
  switch (value) {
    case "TODAY": return "Hoje";
    case "FEW_DAYS": return "Alguns dias";
    case "WEEKS": return "Algumas semanas";
    case "MONTHS": return "Alguns meses";
    case "NOT_APPLICABLE": return "Não se aplica";
    default: return "Não informado";
  }
}

export function visitTypeLabel(value: string) {
  switch (value) {
    case "FIRST_VISIT": return "Primeira consulta";
    case "RETURN": return "Retorno";
    default: return "Não informado";
  }
}
