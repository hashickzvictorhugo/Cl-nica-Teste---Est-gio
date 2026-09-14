"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  patientPhone: string;
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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
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
  const [phone, setPhone] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string>("");
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
        body: JSON.stringify({
          date,
          startTime: slot,
          patientName: name,
          patientPhone: phone,
        }),
      });
      setMessage(
        `Agendamento confirmado. Protocolo ${created.appointment.id.slice(0, 8).toUpperCase()}.`,
      );
      setName("");
      setPhone("");
      setSlot("");
      await Promise.all([loadAvailability(date), loadAppointments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao agendar.");
      await loadAvailability(date);
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppointment(appointment: Appointment) {
    const confirmed = window.confirm(
      `Cancelar a consulta de ${appointment.patientName} em ${appointment.date} às ${appointment.startTime}?`,
    );
    if (!confirmed) return;

    setCancellingId(appointment.id);
    setError("");
    setMessage("");
    try {
      await json<{ message: string }>(
        `/appointments?id=${encodeURIComponent(appointment.id)}`,
        { method: "DELETE" },
      );
      setMessage("Agendamento cancelado com sucesso.");
      await Promise.all([loadAvailability(date), loadAppointments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar agendamento.");
    } finally {
      setCancellingId("");
    }
  }

  const selectedDateAppointments = useMemo(
    () => appointments.filter((item) => item.date === date).length,
    [appointments, date],
  );
  const availableSlots = availability?.slots.filter((item) => item.available).length ?? 0;

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
        <div className="brand-lockup">
          <div className="brand-mark">G+</div>
          <div>
            <strong>Garde Agenda</strong>
            <span>Saúde · Automação · Full Stack</span>
          </div>
        </div>
        <div className="case-pill"><span /> Case técnico demonstrativo</div>
      </header>

      <section className="hero">
        <p className="eyebrow">PROBLEMA REAL · PROCESSO AUTOMATIZADO</p>
        <h1>
          Menos mensagens manuais.<br />
          <span>Mais consultas confirmadas.</span>
        </h1>
        <p className="hero-copy">
          Um fluxo digital para transformar pedidos de horário em agendamentos válidos,
          com disponibilidade em tempo real, regras de negócio e persistência de dados.
        </p>

        <div className="hero-tags" aria-label="Destaques técnicos">
          <span>API real de feriados</span>
          <span>Bloqueio de conflitos</span>
          <span>Cloudflare D1</span>
        </div>

        <div className="flow-panel" aria-label="Fluxo do agendamento">
          <div className="flow-step">
            <div className="flow-icon">WA</div>
            <div><small>ENTRADA</small><strong>Paciente pede horário</strong><span>WhatsApp ou web</span></div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">API</div>
            <div><small>VALIDAÇÃO</small><strong>Regras em tempo real</strong><span>Data, feriado e conflito</span></div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">OK</div>
            <div><small>RESULTADO</small><strong>Consulta confirmada</strong><span>Registro persistido</span></div>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <form className="booking-card" onSubmit={submit}>
          <div className="card-kicker">AGENDAMENTO INTELIGENTE</div>
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
              {availability?.timezone ?? "America/Sao_Paulo"} · Brasília
            </span>
            <span className={blocked ? "meta-pill blocked" : "meta-pill ok"}>{dayStatus}</span>
          </div>

          <div className="divider" />
          <div className="section-heading">
            <span>2</span>
            <div><h2>Veja a disponibilidade</h2><p>Consultas de uma hora, das 08h às 18h.</p></div>
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
            <div><h2>Identifique o paciente</h2><p>Nome e contato para concluir o agendamento.</p></div>
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

          <label className="field-label" htmlFor="patient-phone">Telefone / WhatsApp <span className="optional">opcional</span></label>
          <input
            aria-label="Telefone ou WhatsApp do paciente"
            autoComplete="tel"
            className="phone-input"
            id="patient-phone"
            inputMode="tel"
            maxLength={20}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Ex.: (18) 99999-9999"
            type="tel"
            value={phone}
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
          <div className="side-eyebrow">OPERAÇÃO EM TEMPO REAL</div>
          <div className="side-title">
            <div><h2>Agenda da clínica</h2><p>Visão resumida das consultas</p></div>
            <strong>{appointments.length}</strong>
          </div>

          <div className="metrics" aria-label="Resumo da agenda">
            <div><strong>{selectedDateAppointments}</strong><span>no dia</span></div>
            <div><strong>{availableSlots}</strong><span>livres</span></div>
            <div><strong>{appointments.length}</strong><span>no total</span></div>
          </div>

          {appointments.length === 0 ? (
            <div className="empty">
              <strong>Agenda livre</strong>
              <span>Nenhuma consulta confirmada ainda.</span>
            </div>
          ) : (
            <ol className="appointments">
              {appointments.map((item) => (
                <li key={item.id}>
                  <div className="appointment-date">{item.date.slice(8, 10)}<small>{item.date.slice(5, 7)}/26</small></div>
                  <div className="appointment-info">
                    <strong>{item.startTime}–{item.endTime}</strong>
                    <span>{item.patientName}</span>
                    {item.patientPhone ? <small>{formatPhone(item.patientPhone)}</small> : null}
                  </div>
                  <button
                    aria-label={`Cancelar consulta de ${item.patientName}`}
                    className="cancel-button"
                    disabled={cancellingId === item.id}
                    onClick={() => void cancelAppointment(item)}
                    type="button"
                  >
                    {cancellingId === item.id ? "..." : "Cancelar"}
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="system-card">
            <div><span className="status-dot" /><strong>Regras automatizadas</strong></div>
            <p>Feriados, fins de semana e horários ocupados são validados pelo backend.</p>
          </div>

          <div className="hours">
            <strong>Horário de atendimento</strong>
            <span>Segunda a sexta, 08h–18h</span>
            <span>Horário de Brasília</span>
          </div>
        </aside>
      </section>

      <footer>
        <strong>Garde Agenda</strong>
        <span>Case técnico Full Stack · conceito demonstrativo inspirado no ecossistema Garde.</span>
        <small>Não é um produto oficial da Garde Inteligência Empresarial.</small>
      </footer>
    </main>
  );
}
