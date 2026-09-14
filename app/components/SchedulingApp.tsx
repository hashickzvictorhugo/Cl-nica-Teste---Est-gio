"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Slot = { startTime: string; endTime: string; available: boolean };
type Availability = {
  date: string;
  timezone: string;
  weekday: string;
  isBusinessDay: boolean;
  blockedReason: "WEEKEND" | "HOLIDAY" | null;
  holiday: { localName: string } | null;
  slots: Slot[];
};
type Appointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  patientName: string;
};
type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

function today2026() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const value = `${get("year")}-${get("month")}-${get("day")}`;
  return value.startsWith("2026-") ? value : "2026-02-10";
}

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data: unknown = await response.json();
  if (!response.ok) {
    const payload = data as ApiErrorPayload;
    throw new Error(payload.error?.message ?? "Não foi possível concluir a solicitação.");
  }
  return data as T;
}

export function SchedulingApp() {
  const [date, setDate] = useState(today2026);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<string>("");
  const [name, setName] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const loadAppointments = useCallback(async () => {
    const data = await json<{ appointments: Appointment[] }>("/appointments");
    setAppointments(data.appointments);
  }, []);

  const loadAvailability = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError("");
    setSlot("");
    try {
      const data = await json<Availability>(
        `/available?date=${encodeURIComponent(selectedDate)}`,
      );
      setAvailability(data);
    } catch (err) {
      setAvailability(null);
      setError(err instanceof Error ? err.message : "Erro ao consultar horários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadAvailability(date);
      void loadAppointments().catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, [date, loadAppointments, loadAvailability]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!slot || name.trim().length < 2) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const created = await json<{ appointment: Appointment }>("/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime: slot, patientName: name }),
      });
      setMessage(
        `Agendamento confirmado. Protocolo ${created.appointment.id.slice(0, 8).toUpperCase()}.`,
      );
      setName("");
      setSlot("");
      await Promise.all([loadAvailability(date), loadAppointments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao agendar.");
      await loadAvailability(date);
    } finally {
      setSaving(false);
    }
  }

  const blocked = availability?.blockedReason;
  const dayStatus = !availability
    ? "Consultando"
    : blocked === "WEEKEND"
      ? "Fim de semana"
      : blocked === "HOLIDAY"
        ? "Feriado"
        : "Dia útil";

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-mark">CT</div>
        <div>
          <strong>Clínica Teste</strong>
          <span>Agendamento online</span>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">AGENDA ONLINE</p>
        <h1>Encontre um horário para cuidar de você.</h1>
        <p>
          Consulte a disponibilidade em tempo real e confirme uma consulta em poucos passos.
        </p>
      </section>

      <section className="content-grid">
        <form className="booking-card" onSubmit={submit}>
          <div className="section-heading">
            <span>1</span>
            <div><h2>Escolha a data</h2><p>Atendimento em dias úteis de 2026.</p></div>
          </div>
          <input
            aria-label="Data da consulta"
            className="date-input"
            type="date"
            min="2026-01-01"
            max="2026-12-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="date-meta" aria-live="polite">
            <span className="meta-pill">{availability?.weekday ?? "Consultando data…"}</span>
            <span className="meta-pill">
              {availability?.timezone ?? "America/Sao_Paulo"} · Horário de Brasília
            </span>
            <span className={blocked ? "meta-pill blocked" : "meta-pill ok"}>{dayStatus}</span>
          </div>

          <div className="divider" />
          <div className="section-heading">
            <span>2</span>
            <div><h2>Escolha o horário</h2><p>Consultas de uma hora, das 08h às 18h.</p></div>
          </div>

          {loading ? <p className="status">Consultando agenda…</p> : null}
          {!loading && blocked ? (
            <div className="notice">
              {blocked === "WEEKEND"
                ? "A clínica não atende aos fins de semana."
                : `Não há atendimento neste feriado${availability?.holiday?.localName ? `: ${availability.holiday.localName}` : ""}.`}
            </div>
          ) : null}
          {!loading && availability?.isBusinessDay ? (
            <div className="slots">
              {availability.slots.map((item) => (
                <button
                  className={slot === item.startTime ? "slot selected" : "slot"}
                  disabled={!item.available}
                  key={item.startTime}
                  onClick={() => setSlot(item.startTime)}
                  type="button"
                >
                  <strong>{item.startTime}</strong>
                  <small>{item.available ? "Disponível" : "Ocupado"}</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className="divider" />
          <div className="section-heading">
            <span>3</span>
            <div><h2>Confirme seus dados</h2><p>Use um nome fictício para testar o projeto.</p></div>
          </div>
          <label className="field-label" htmlFor="patient-name">Nome do paciente</label>
          <input
            aria-label="Nome do paciente"
            autoComplete="name"
            className="name-input"
            id="patient-name"
            maxLength={80}
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Maria Silva"
            required
            value={name}
          />

          {error ? <div className="error" role="alert">{error}</div> : null}
          {message ? <div className="success" role="status">{message}</div> : null}

          <button
            className="submit"
            disabled={!slot || name.trim().length < 2 || saving}
            type="submit"
          >
            {saving ? "Confirmando…" : "Confirmar agendamento"}
          </button>
        </form>

        <aside className="side-card">
          <div className="side-title">
            <div><h2>Na agenda</h2><p>Consultas confirmadas</p></div>
            <strong>{appointments.length}</strong>
          </div>
          {appointments.length === 0 ? (
            <div className="empty">Nenhuma consulta marcada ainda.</div>
          ) : (
            <ol className="appointments">
              {appointments.map((item) => (
                <li key={item.id}>
                  <div className="appointment-date">{item.date.slice(8, 10)}<small>{item.date.slice(5, 7)}/26</small></div>
                  <div><strong>{item.startTime}–{item.endTime}</strong><span>{item.patientName}</span></div>
                </li>
              ))}
            </ol>
          )}
          <div className="hours">
            <strong>Horário de atendimento</strong>
            <span>Segunda a sexta, 08h–18h</span>
            <span>Horário de Brasília</span>
          </div>
        </aside>
      </section>

      <footer>Clínica Teste · Projeto demonstrativo de agendamento full stack</footer>
    </main>
  );
}
