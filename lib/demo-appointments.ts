import type { AppointmentStatus } from "./appointment-status";
import { getProviderById, type Provider } from "./providers";
import { TIMEZONE } from "./scheduling";

export type DemoAdminAppointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  provider: Provider;
  patientName: string;
  patientPhone: string;
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
    return [item.patientName, item.patientPhone, item.provider.name, item.provider.specialty]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(query);
  });
}
