import type { AppointmentStatus } from "./appointment-status.ts";
import { getProviderById, type Provider } from "./providers.ts";
import { TIMEZONE } from "./scheduling.ts";

export type DemoAdminAppointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  provider: Provider;
  patientName: string;
  patientPhone: string;
  visitReason: string;
  symptomDuration: string;
  visitType: string;
  patientNotes: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
};

function provider(id: string) {
  const item = getProviderById(id);
  if (!item) throw new Error(`Profissional demonstrativo inválido: ${id}`);
  return item;
}

export const DEMO_ADMIN_APPOINTMENTS: readonly DemoAdminAppointment[] = [
  {
    id: "demo-001",
    date: "2026-09-10",
    startTime: "09:00",
    endTime: "10:00",
    timezone: TIMEZONE,
    provider: provider("ana-martins"),
    patientName: "Marina Costa (demo)",
    patientPhone: "18900000001",
    visitReason: "Avaliação de desconforto abdominal leve relatado no formulário demonstrativo.",
    symptomDuration: "FEW_DAYS",
    visitType: "FIRST_VISIT",
    patientNotes: "Registro totalmente fictício criado para demonstração do painel.",
    status: "COMPLETED",
    createdAt: "2026-09-08T13:15:00.000Z",
    updatedAt: "2026-09-10T13:05:00.000Z",
    cancelledAt: null,
    completedAt: "2026-09-10T13:05:00.000Z",
  },
  {
    id: "demo-002",
    date: "2026-09-11",
    startTime: "14:00",
    endTime: "15:00",
    timezone: TIMEZONE,
    provider: provider("lucas-ferreira"),
    patientName: "Rafael Mendes (demo)",
    patientPhone: "18900000002",
    visitReason: "Retorno demonstrativo para conversar sobre resultados de exames fictícios.",
    symptomDuration: "NOT_APPLICABLE",
    visitType: "RETURN",
    patientNotes: "Sem observação clínica real; conteúdo apenas ilustrativo.",
    status: "CANCELLED",
    createdAt: "2026-09-08T16:40:00.000Z",
    updatedAt: "2026-09-10T18:20:00.000Z",
    cancelledAt: "2026-09-10T18:20:00.000Z",
    completedAt: null,
  },
  {
    id: "demo-003",
    date: "2026-09-16",
    startTime: "10:00",
    endTime: "11:00",
    timezone: TIMEZONE,
    provider: provider("camila-rocha"),
    patientName: "Camila Nogueira (demo)",
    patientPhone: "18900000003",
    visitReason: "Avaliação demonstrativa de irritação de pele sem qualquer paciente real associado.",
    symptomDuration: "WEEKS",
    visitType: "FIRST_VISIT",
    patientNotes: "Exemplo sintético usado somente para avaliação do case.",
    status: "CONFIRMED",
    createdAt: "2026-09-12T14:10:00.000Z",
    updatedAt: "2026-09-12T14:10:00.000Z",
    cancelledAt: null,
    completedAt: null,
  },
  {
    id: "demo-004",
    date: "2026-09-17",
    startTime: "13:00",
    endTime: "14:00",
    timezone: TIMEZONE,
    provider: provider("beatriz-lima"),
    patientName: "Pedro Almeida (demo)",
    patientPhone: "18900000004",
    visitReason: "Consulta demonstrativa de rotina para ilustrar o fluxo de pré-atendimento.",
    symptomDuration: "NOT_APPLICABLE",
    visitType: "FIRST_VISIT",
    patientNotes: "Dados fictícios e sem vínculo com pessoa real.",
    status: "CONFIRMED",
    createdAt: "2026-09-13T17:25:00.000Z",
    updatedAt: "2026-09-13T17:25:00.000Z",
    cancelledAt: null,
    completedAt: null,
  },
  {
    id: "demo-005",
    date: "2026-09-18",
    startTime: "16:00",
    endTime: "17:00",
    timezone: TIMEZONE,
    provider: provider("ana-martins"),
    patientName: "Juliana Ferreira (demo)",
    patientPhone: "18900000005",
    visitReason: "Relato fictício de dor de cabeça recente para demonstrar a visualização administrativa.",
    symptomDuration: "TODAY",
    visitType: "RETURN",
    patientNotes: "Exemplo demonstrativo; não representa orientação ou triagem médica.",
    status: "CONFIRMED",
    createdAt: "2026-09-14T12:35:00.000Z",
    updatedAt: "2026-09-14T12:35:00.000Z",
    cancelledAt: null,
    completedAt: null,
  },
];

export function filterDemoAppointments({
  date,
  providerId,
  status,
  search,
}: {
  date?: string;
  providerId?: string;
  status?: string;
  search?: string;
}) {
  const query = search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  return DEMO_ADMIN_APPOINTMENTS.filter((item) => {
    if (date && item.date !== date) return false;
    if (providerId && providerId !== "all" && item.provider.id !== providerId) return false;
    if (status && status !== "all" && item.status !== status) return false;
    if (!query) return true;
    return [
      item.patientName,
      item.patientPhone,
      item.provider.name,
      item.provider.specialty,
      item.visitReason,
      item.patientNotes,
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(query);
  });
}
