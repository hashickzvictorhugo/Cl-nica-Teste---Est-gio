import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { databaseError, jsonError } from "@/lib/api-response";
import {
  getHolidayForDate,
  HolidayServiceError,
} from "@/lib/holiday-service";
import { getProviderById, resolveProvider } from "@/lib/providers";
import {
  getEndTime,
  isSupportedDate,
  isValidStartTime,
  isWeekend,
  sanitizePatientName,
  sanitizePatientPhone,
  SCHEDULING_YEAR,
  TIMEZONE,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

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
    createdAt: row.createdAt,
  };
}

export async function GET() {
  try {
    const rows = await getDb()
      .select()
      .from(appointments)
      .orderBy(
        asc(appointments.appointmentDate),
        asc(appointments.providerId),
        asc(appointments.startTime),
        asc(appointments.createdAt),
      )
      .limit(100);

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

    const values = {
      id: crypto.randomUUID(),
      appointmentDate: date,
      startTime,
      providerId: provider.id,
      patientName,
      patientPhone: patientPhone || null,
      createdAt: new Date().toISOString(),
    };

    const created = await getDb()
      .insert(appointments)
      .values(values)
      .onConflictDoNothing({
        target: [
          appointments.providerId,
          appointments.appointmentDate,
          appointments.startTime,
        ],
      })
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

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return jsonError(400, "VALIDATION_ERROR", "Informe o agendamento que deseja cancelar.");
  }

  try {
    const removed = await getDb()
      .delete(appointments)
      .where(eq(appointments.id, id))
      .returning({ id: appointments.id });

    if (removed.length === 0) {
      return jsonError(404, "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado.");
    }

    return Response.json(
      { message: "Agendamento cancelado.", id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseError(error);
  }
}
