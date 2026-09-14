import { and, asc, eq, like, or } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import {
  isAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import { databaseError, jsonError } from "@/lib/api-response";
import {
  getHolidayForDate,
  HolidayServiceError,
} from "@/lib/holiday-service";
import { getProviderById, resolveProvider } from "@/lib/providers";
import {
  getEndTime,
  hasSlotStarted,
  isPastDate,
  isSupportedDate,
  isValidStartTime,
  isWeekend,
  sanitizePatientName,
  sanitizePatientPhone,
  SCHEDULING_YEAR,
  TIMEZONE,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

function normalizedStatus(value: string): AppointmentStatus {
  return isAppointmentStatus(value) ? value : "CONFIRMED";
}

function presentAppointment(row: typeof appointments.$inferSelect) {
  const provider = getProviderById(row.providerId);
  return {
    id: row.id,
    date: row.appointmentDate,
    startTime: row.startTime,
    endTime: isValidStartTime(row.startTime)
      ? getEndTime(row.startTime)
      : row.startTime,
    timezone: TIMEZONE,
    provider: provider ?? {
      id: row.providerId,
      name: "Profissional",
      specialty: "Atendimento",
      initials: "PR",
      description: "",
    },
    patientName: row.patientName,
    patientPhone: row.patientPhone ?? "",
    status: normalizedStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const providerId = url.searchParams.get("providerId")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const search = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";

  if (date && !isSupportedDate(date)) {
    return jsonError(
      400,
      "INVALID_DATE",
      `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`,
    );
  }

  if (providerId && providerId !== "all" && !getProviderById(providerId)) {
    return jsonError(
      400,
      "INVALID_PROVIDER",
      "Escolha um profissional válido para filtrar a agenda.",
    );
  }

  if (status && status !== "all" && !isAppointmentStatus(status)) {
    return jsonError(
      400,
      "INVALID_STATUS",
      "Escolha um status válido para filtrar a agenda.",
    );
  }

  const conditions = [];
  if (date) conditions.push(eq(appointments.appointmentDate, date));
  if (providerId && providerId !== "all") {
    conditions.push(eq(appointments.providerId, providerId));
  }
  if (status && status !== "all" && isAppointmentStatus(status)) {
    conditions.push(eq(appointments.status, status));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(appointments.patientName, pattern),
        like(appointments.patientPhone, pattern),
      )!,
    );
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
      {
        appointments: rows.map(presentAppointment),
        count: rows.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Expected a JSON object");
    }
    payload = body as Record<string, unknown>;
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Envie os dados do agendamento em JSON.",
    );
  }

  const date = payload.date;
  const startTime = payload.startTime;
  const provider = resolveProvider(payload.providerId);
  const patientName = sanitizePatientName(payload.patientName);
  const patientPhone = sanitizePatientPhone(payload.patientPhone);

  if (!isSupportedDate(date)) {
    return jsonError(
      400,
      "INVALID_DATE",
      `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`,
    );
  }

  const schedulingNow = new Date();
  if (isPastDate(date, schedulingNow)) {
    return jsonError(
      422,
      "PAST_DATE",
      "Não é possível criar um agendamento em uma data que já passou.",
    );
  }

  if (!provider) {
    return jsonError(
      400,
      "INVALID_PROVIDER",
      "Escolha um profissional válido para o atendimento.",
    );
  }

  if (!isValidStartTime(startTime)) {
    return jsonError(
      422,
      "INVALID_SLOT",
      "Escolha um horário cheio entre 08:00 e 17:00.",
    );
  }

  if (hasSlotStarted(date, startTime, schedulingNow)) {
    return jsonError(
      422,
      "PAST_SLOT",
      "Esse horário já começou ou passou. Escolha um horário futuro.",
    );
  }

  if (!patientName) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Informe o nome do paciente com 2 a 80 caracteres.",
    );
  }

  if (patientPhone === null) {
    return jsonError(
      400,
      "INVALID_PHONE",
      "Informe um telefone válido com 8 a 13 dígitos ou deixe o campo em branco.",
    );
  }

  try {
    const holiday = await getHolidayForDate(date);

    if (isWeekend(date)) {
      return jsonError(
        422,
        "WEEKEND",
        "A clínica não abre aos fins de semana. Escolha um dia útil.",
      );
    }

    if (holiday) {
      return jsonError(
        422,
        "HOLIDAY",
        `Não há atendimento em ${holiday.localName}. Escolha outra data.`,
      );
    }

    const now = schedulingNow.toISOString();
    const values = {
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
    };

    const created = await getDb()
      .insert(appointments)
      .values(values)
      .onConflictDoNothing()
      .returning();

    if (created.length === 0) {
      return jsonError(
        409,
        "SLOT_TAKEN",
        `Esse horário com ${provider.name} acabou de ser reservado. Escolha outro.`,
      );
    }

    return Response.json(
      {
        message: "Agendamento confirmado.",
        appointment: presentAppointment(created[0]),
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof HolidayServiceError) {
      return jsonError(
        503,
        "HOLIDAY_SERVICE_UNAVAILABLE",
        "Não foi possível verificar os feriados agora. Tente novamente em instantes.",
      );
    }
    return databaseError(error);
  }
}

export async function PATCH(request: Request) {
  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Expected a JSON object");
    }
    payload = body as Record<string, unknown>;
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Envie a atualização em JSON.");
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const status = payload.status;

  if (!id) {
    return jsonError(400, "VALIDATION_ERROR", "Informe o agendamento que deseja atualizar.");
  }

  if (status !== "COMPLETED" && status !== "CONFIRMED") {
    return jsonError(
      400,
      "INVALID_STATUS",
      "A atualização permite marcar a consulta como concluída ou confirmada.",
    );
  }

  try {
    const current = await getDb()
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (current.length === 0) {
      return jsonError(404, "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");
    }

    if (normalizedStatus(current[0].status) === "CANCELLED") {
      return jsonError(
        409,
        "INVALID_TRANSITION",
        "Uma consulta cancelada permanece no histórico e não pode ser reativada.",
      );
    }

    const now = new Date().toISOString();
    const updated = await getDb()
      .update(appointments)
      .set({
        status,
        updatedAt: now,
        completedAt: status === "COMPLETED" ? now : null,
      })
      .where(eq(appointments.id, id))
      .returning();

    return Response.json(
      {
        message: status === "COMPLETED"
          ? "Consulta marcada como concluída."
          : "Consulta marcada como confirmada.",
        appointment: presentAppointment(updated[0]),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return jsonError(400, "VALIDATION_ERROR", "Informe o agendamento que deseja cancelar.");
  }

  try {
    const current = await getDb()
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (current.length === 0) {
      return jsonError(404, "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");
    }

    if (normalizedStatus(current[0].status) === "CANCELLED") {
      return Response.json(
        { message: "Agendamento já estava cancelado.", appointment: presentAppointment(current[0]) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const now = new Date().toISOString();
    const cancelled = await getDb()
      .update(appointments)
      .set({
        status: "CANCELLED",
        updatedAt: now,
        cancelledAt: now,
        completedAt: null,
      })
      .where(eq(appointments.id, id))
      .returning();

    return Response.json(
      {
        message: "Agendamento cancelado e mantido no histórico.",
        appointment: presentAppointment(cancelled[0]),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}
