import { and, asc, eq, like, ne, or } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { requireAdmin, isAdminScope } from "@/lib/admin-auth";
import {
  isAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import { databaseError, jsonError } from "@/lib/api-response";
import { enforceBookingRateLimit } from "@/lib/booking-rate-limit";
import {
  getHolidayForDate,
  HolidayServiceError,
} from "@/lib/holiday-service";
import { getProviderById, resolveProvider } from "@/lib/providers";
import { JsonBodyError, readJsonObject } from "@/lib/request-json";
import {
  BOOKING_MIN_LEAD_MINUTES,
  CANCELLATION_MIN_LEAD_MINUTES,
  getEndTime,
  hasSlotEnded,
  isPastDate,
  isSlotBookable,
  isSupportedDate,
  isValidStartTime,
  isWeekend,
  isWithinCancellationWindow,
  sanitizePatientName,
  sanitizePatientPhone,
  SCHEDULING_YEAR,
  TIMEZONE,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

function normalizedStatus(value: string): AppointmentStatus {
  return isAppointmentStatus(value) ? value : "CONFIRMED";
}

function providerFor(row: typeof appointments.$inferSelect) {
  return getProviderById(row.providerId) ?? {
    id: row.providerId,
    name: "Profissional",
    specialty: "Atendimento",
    initials: "PR",
    description: "",
  };
}

function presentAdminAppointment(row: typeof appointments.$inferSelect) {
  return {
    id: row.id,
    date: row.appointmentDate,
    startTime: row.startTime,
    endTime: isValidStartTime(row.startTime) ? getEndTime(row.startTime) : row.startTime,
    timezone: TIMEZONE,
    provider: providerFor(row),
    patientName: row.patientName,
    patientPhone: row.patientPhone ?? "",
    status: normalizedStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

function presentPublicConfirmation(row: typeof appointments.$inferSelect) {
  return {
    id: row.id,
    date: row.appointmentDate,
    startTime: row.startTime,
    endTime: isValidStartTime(row.startTime) ? getEndTime(row.startTime) : row.startTime,
    timezone: TIMEZONE,
    provider: providerFor(row),
    status: normalizedStatus(row.status),
  };
}

function jsonBodyError(error: unknown, fallback: string) {
  if (error instanceof JsonBodyError) {
    return jsonError(error.status, error.code, error.message);
  }
  return jsonError(400, "VALIDATION_ERROR", fallback);
}

async function patientHasConflict({
  patientPhone,
  date,
  startTime,
  excludeId,
}: {
  patientPhone: string;
  date: string;
  startTime: string;
  excludeId?: string;
}) {
  if (!patientPhone) return false;
  const predicates = [
    eq(appointments.patientPhone, patientPhone),
    eq(appointments.appointmentDate, date),
    eq(appointments.startTime, startTime),
    ne(appointments.status, "CANCELLED"),
  ];
  if (excludeId) predicates.push(ne(appointments.id, excludeId));
  const rows = await getDb()
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...predicates))
    .limit(1);
  return rows.length > 0;
}

async function providerSlotTaken({
  providerId,
  date,
  startTime,
  excludeId,
}: {
  providerId: string;
  date: string;
  startTime: string;
  excludeId?: string;
}) {
  const predicates = [
    eq(appointments.providerId, providerId),
    eq(appointments.appointmentDate, date),
    eq(appointments.startTime, startTime),
    ne(appointments.status, "CANCELLED"),
  ];
  if (excludeId) predicates.push(ne(appointments.id, excludeId));
  const rows = await getDb()
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...predicates))
    .limit(1);
  return rows.length > 0;
}

export async function GET(request: Request) {
  if (!isAdminScope(request)) {
    return Response.json(
      { appointments: [], count: 0, protected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const authError = await requireAdmin(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const providerId = url.searchParams.get("providerId")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const search = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";

  if (date && !isSupportedDate(date)) {
    return jsonError(400, "INVALID_DATE", `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`);
  }
  if (providerId && providerId !== "all" && !getProviderById(providerId)) {
    return jsonError(400, "INVALID_PROVIDER", "Escolha um profissional válido para filtrar a agenda.");
  }
  if (status && status !== "all" && !isAppointmentStatus(status)) {
    return jsonError(400, "INVALID_STATUS", "Escolha um status válido para filtrar a agenda.");
  }

  const conditions = [];
  if (date) conditions.push(eq(appointments.appointmentDate, date));
  if (providerId && providerId !== "all") conditions.push(eq(appointments.providerId, providerId));
  if (status && status !== "all" && isAppointmentStatus(status)) conditions.push(eq(appointments.status, status));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(like(appointments.patientName, pattern), like(appointments.patientPhone, pattern))!);
  }

  try {
    const rows = await getDb()
      .select()
      .from(appointments)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(
        asc(appointments.appointmentDate),
        asc(appointments.providerId),
        asc(appointments.startTime),
        asc(appointments.createdAt),
      )
      .limit(200);

    return Response.json(
      { appointments: rows.map(presentAdminAppointment), count: rows.length, protected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await readJsonObject(request);
  } catch (error) {
    return jsonBodyError(error, "Envie os dados do agendamento em JSON.");
  }

  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonError(400, "AUTOMATION_REJECTED", "Não foi possível validar o formulário.");
  }

  const date = payload.date;
  const startTime = payload.startTime;
  const provider = resolveProvider(payload.providerId);
  const patientName = sanitizePatientName(payload.patientName);
  const patientPhone = sanitizePatientPhone(payload.patientPhone);

  if (!isSupportedDate(date)) {
    return jsonError(400, "INVALID_DATE", `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`);
  }

  const schedulingNow = new Date();
  if (isPastDate(date, schedulingNow)) {
    return jsonError(422, "PAST_DATE", "Não é possível criar um agendamento em uma data que já passou.");
  }
  if (!provider) return jsonError(400, "INVALID_PROVIDER", "Escolha um profissional válido para o atendimento.");
  if (!isValidStartTime(startTime)) {
    return jsonError(422, "INVALID_SLOT", "Escolha um horário cheio entre 08:00 e 17:00.");
  }
  if (!isSlotBookable(date, startTime, schedulingNow)) {
    return jsonError(
      422,
      "BOOKING_TOO_SOON",
      `O agendamento precisa ser feito com pelo menos ${BOOKING_MIN_LEAD_MINUTES} minutos de antecedência.`,
    );
  }
  if (!patientName) {
    return jsonError(400, "VALIDATION_ERROR", "Informe o nome do paciente com 2 a 80 caracteres.");
  }
  if (patientPhone === null) {
    return jsonError(400, "INVALID_PHONE", "Informe um telefone válido com 8 a 13 dígitos ou deixe o campo em branco.");
  }

  const rateLimitError = await enforceBookingRateLimit(request, patientPhone || "");
  if (rateLimitError) return rateLimitError;

  try {
    const holiday = await getHolidayForDate(date);
    if (isWeekend(date)) return jsonError(422, "WEEKEND", "A clínica não abre aos fins de semana. Escolha um dia útil.");
    if (holiday) return jsonError(422, "HOLIDAY", `Não há atendimento em ${holiday.localName}. Escolha outra data.`);

    if (patientPhone && await patientHasConflict({ patientPhone, date, startTime })) {
      return jsonError(409, "PATIENT_CONFLICT", "Este telefone já possui outra consulta ativa nesse mesmo horário.");
    }

    const now = schedulingNow.toISOString();
    const created = await getDb()
      .insert(appointments)
      .values({
        id: crypto.randomUUID(),
        appointmentDate: date,
        startTime,
        providerId: provider.id,
        patientName,
        patientPhone: patientPhone || null,
        status: "CONFIRMED",
        createdAt: now,
        updatedAt: now,
        cancelledAt: null,
        completedAt: null,
      })
      .onConflictDoNothing()
      .returning();

    if (created.length === 0) {
      return jsonError(409, "SLOT_TAKEN", `Esse horário com ${provider.name} acabou de ser reservado. Escolha outro.`);
    }

    return Response.json(
      { message: "Agendamento confirmado.", appointment: presentPublicConfirmation(created[0]) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HolidayServiceError) {
      return jsonError(503, "HOLIDAY_SERVICE_UNAVAILABLE", "Não foi possível verificar os feriados agora. Tente novamente em instantes.");
    }
    return databaseError(error);
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonObject(request);
  } catch (error) {
    return jsonBodyError(error, "Envie a atualização em JSON.");
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const action = payload.action;
  const status = payload.status;
  if (!id) return jsonError(400, "VALIDATION_ERROR", "Informe o agendamento que deseja atualizar.");

  try {
    const current = await getDb().select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (current.length === 0) return jsonError(404, "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");

    const currentStatus = normalizedStatus(current[0].status);

    if (action === "RESCHEDULE") {
      if (currentStatus !== "CONFIRMED") {
        return jsonError(409, "INVALID_TRANSITION", "Somente consultas confirmadas podem ser remarcadas.");
      }

      const date = payload.date;
      const startTime = payload.startTime;
      const provider = resolveProvider(payload.providerId);
      const schedulingNow = new Date();

      if (!isSupportedDate(date)) {
        return jsonError(400, "INVALID_DATE", `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`);
      }
      if (isPastDate(date, schedulingNow)) return jsonError(422, "PAST_DATE", "Não é possível remarcar para uma data que já passou.");
      if (!provider) return jsonError(400, "INVALID_PROVIDER", "Escolha um profissional válido para o novo horário.");
      if (!isValidStartTime(startTime)) return jsonError(422, "INVALID_SLOT", "Escolha um horário cheio entre 08:00 e 17:00.");
      if (!isSlotBookable(date, startTime, schedulingNow)) {
        return jsonError(
          422,
          "BOOKING_TOO_SOON",
          `A remarcação precisa respeitar pelo menos ${BOOKING_MIN_LEAD_MINUTES} minutos de antecedência.`,
        );
      }

      const holiday = await getHolidayForDate(date);
      if (isWeekend(date)) return jsonError(422, "WEEKEND", "A clínica não abre aos fins de semana. Escolha um dia útil.");
      if (holiday) return jsonError(422, "HOLIDAY", `Não há atendimento em ${holiday.localName}. Escolha outra data.`);

      if (await providerSlotTaken({ providerId: provider.id, date, startTime, excludeId: id })) {
        return jsonError(409, "SLOT_TAKEN", `Esse horário com ${provider.name} já está reservado. Escolha outro.`);
      }
      if (
        current[0].patientPhone &&
        await patientHasConflict({ patientPhone: current[0].patientPhone, date, startTime, excludeId: id })
      ) {
        return jsonError(409, "PATIENT_CONFLICT", "O paciente já possui outra consulta ativa nesse mesmo horário.");
      }

      const updated = await getDb()
        .update(appointments)
        .set({
          appointmentDate: date,
          startTime,
          providerId: provider.id,
          updatedAt: schedulingNow.toISOString(),
        })
        .where(eq(appointments.id, id))
        .returning();

      return Response.json(
        { message: "Agendamento remarcado com sucesso.", appointment: presentAdminAppointment(updated[0]) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (status !== "COMPLETED" && status !== "CONFIRMED") {
      return jsonError(400, "INVALID_STATUS", "A atualização permite marcar a consulta como concluída ou confirmada.");
    }
    if (currentStatus === "CANCELLED") {
      return jsonError(409, "INVALID_TRANSITION", "Uma consulta cancelada permanece no histórico e não pode ser reativada.");
    }
    if (currentStatus === "COMPLETED") {
      if (status === "COMPLETED") {
        return Response.json(
          { message: "Consulta já estava concluída.", appointment: presentAdminAppointment(current[0]) },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      return jsonError(409, "INVALID_TRANSITION", "Uma consulta concluída não pode voltar ao status confirmado.");
    }
    if (status === "CONFIRMED") {
      return Response.json(
        { message: "Consulta já está confirmada.", appointment: presentAdminAppointment(current[0]) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!isValidStartTime(current[0].startTime) || !hasSlotEnded(current[0].appointmentDate, current[0].startTime, new Date())) {
      return jsonError(409, "APPOINTMENT_NOT_FINISHED", "A consulta só pode ser concluída depois do término do horário reservado.");
    }

    const now = new Date().toISOString();
    const updated = await getDb()
      .update(appointments)
      .set({ status: "COMPLETED", updatedAt: now, completedAt: now })
      .where(eq(appointments.id, id))
      .returning();

    return Response.json(
      { message: "Consulta marcada como concluída.", appointment: presentAdminAppointment(updated[0]) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HolidayServiceError) {
      return jsonError(503, "HOLIDAY_SERVICE_UNAVAILABLE", "Não foi possível verificar os feriados agora. Tente novamente em instantes.");
    }
    return databaseError(error);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return jsonError(400, "VALIDATION_ERROR", "Informe o agendamento que deseja cancelar.");

  try {
    const current = await getDb().select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (current.length === 0) return jsonError(404, "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");

    const currentStatus = normalizedStatus(current[0].status);
    if (currentStatus === "CANCELLED") {
      return Response.json(
        { message: "Agendamento já estava cancelado.", appointment: presentAdminAppointment(current[0]) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (currentStatus === "COMPLETED") {
      return jsonError(409, "INVALID_TRANSITION", "Uma consulta concluída permanece no histórico e não pode ser cancelada.");
    }
    if (
      !isValidStartTime(current[0].startTime) ||
      isWithinCancellationWindow(current[0].appointmentDate, current[0].startTime, new Date())
    ) {
      return jsonError(
        409,
        "CANCELLATION_TOO_LATE",
        `Cancelamentos são permitidos até ${CANCELLATION_MIN_LEAD_MINUTES} minutos antes do horário marcado.`,
      );
    }

    const now = new Date().toISOString();
    const cancelled = await getDb()
      .update(appointments)
      .set({ status: "CANCELLED", updatedAt: now, cancelledAt: now, completedAt: null })
      .where(eq(appointments.id, id))
      .returning();

    return Response.json(
      { message: "Agendamento cancelado e mantido no histórico.", appointment: presentAdminAppointment(cancelled[0]) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}
