"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getAppointmentStatusLabel,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import { DEFAULT_PROVIDER_ID, PROVIDERS, type Provider } from "@/lib/providers";

type Slot = { startTime: string; endTime: string; available: boolean };
type Availability = {
  date: string;
  provider: Provider;
  timezone: string;
  weekday: string;
  isBusinessDay: boolean;
  blockedReason: "WEEKEND" | "HOLIDAY" | null;
  holiday: { localName: string } | null;
  slots: Slot[];
  availableSlots: Slot[];
  availableCount: number;
};
type Appointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  provider: Provider;
  patientName: string;
  patientPhone: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
};
type NextAvailability = {
  fromDate: string;
  date: string;
  weekday: string;
  timezone: string;
  provider: Provider;
  slot: { startTime: string; endTime: string };
};
type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};
type Toast = {
  type: "success" | "error" | "info";
  message: string;
};
type ConfirmAction = {
  kind: "cancel" | "complete";
  appointment: Appointment;
};

class ApiRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

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
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function whatsappUrl(appointment: Appointment) {
  const digits = appointment.patientPhone.replace(/\D/g, "");
  if (!digits) return "";
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const message = [
    `Olá, ${appointment.patientName}!`,
    `Seu agendamento com ${appointment.provider.name} (${appointment.provider.specialty}) está confirmado para ${formatDate(appointment.date)} às ${appointment.startTime}.`,
    "Se precisar falar com a clínica, responda por aqui.",
  ].join("\n\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data: unknown = await response.json();
  if (!response.ok) {
    const payload = data as ApiErrorPayload;
    throw new ApiRequestError(
      payload.error?.message ?? "Não foi possível concluir a solicitação.",
      response.status,
      payload.error?.code,
    );
  }
  return data as T;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function SchedulingApp() {
  const [providerId, setProviderId] = useState<string>(DEFAULT_PROVIDER_ID);
  const [date, setDate] = useState(today2026);
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<string, Availability>>({});
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [findingNext, setFindingNext] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    date: string;
    providerId: string;
    startTime: string;
  } | null>(null);

  const [adminSearch, setAdminSearch] = useState("");
  const [adminDate, setAdminDate] = useState("");
  const [adminProvider, setAdminProvider] = useState("all");
  const [adminStatus, setAdminStatus] = useState<AppointmentStatus | "all">("all");

  const modalPrimaryRef = useRef<HTMLButtonElement>(null);

  const selectedProvider = useMemo(
    () => PROVIDERS.find((provider) => provider.id === providerId) ?? PROVIDERS[0],
    [providerId],
  );
  const availability = useMemo(() => {
    const current = availabilityByProvider[providerId];
    return current?.date === date ? current : null;
  }, [availabilityByProvider, date, providerId]);

  const showToast = useCallback((type: Toast["type"], message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!confirmAction) return;
    modalPrimaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmAction(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmAction]);

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    try {
      const data = await json<{ appointments: Appointment[] }>("/appointments");
      setAppointments(data.appointments);
    } catch (error) {
      showToast("error", errorMessage(error, "Não foi possível carregar a agenda."));
    } finally {
      setAppointmentsLoading(false);
    }
  }, [showToast]);

  const loadDateAvailability = useCallback(async (selectedDate: string) => {
    setAvailabilityLoading(true);
    setFormError("");
    try {
      const responses = await Promise.all(
        PROVIDERS.map((provider) =>
          json<Availability>(
            `/available?date=${encodeURIComponent(selectedDate)}&providerId=${encodeURIComponent(provider.id)}`,
          ),
        ),
      );
      const nextMap: Record<string, Availability> = {};
      for (const response of responses) nextMap[response.provider.id] = response;
      setAvailabilityByProvider(nextMap);
    } catch (error) {
      setAvailabilityByProvider({});
      setFormError(errorMessage(error, "Erro ao consultar os horários."));
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadDateAvailability(date);
    });
    return () => {
      active = false;
    };
  }, [date, loadDateAvailability]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadAppointments();
    });
    return () => {
      active = false;
    };
  }, [loadAppointments]);

  useEffect(() => {
    if (!pendingSuggestion) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const suggestedAvailability = availabilityByProvider[pendingSuggestion.providerId];
      if (
        suggestedAvailability?.date === pendingSuggestion.date &&
        suggestedAvailability.slots.some(
          (item) => item.startTime === pendingSuggestion.startTime && item.available,
        )
      ) {
        setSlot(pendingSuggestion.startTime);
        setPendingSuggestion(null);
      }
    });
    return () => {
      active = false;
    };
  }, [availabilityByProvider, pendingSuggestion]);

  async function findNextAvailability() {
    setFindingNext(true);
    setFormError("");
    try {
      const next = await json<NextAvailability>(
        `/next-available?fromDate=${encodeURIComponent(date)}&providerId=all`,
      );
      setSlot("");
      setPendingSuggestion({
        date: next.date,
        providerId: next.provider.id,
        startTime: next.slot.startTime,
      });
      setProviderId(next.provider.id);
      setDate(next.date);
      showToast(
        "info",
        `Próximo horário: ${formatDate(next.date)} às ${next.slot.startTime} com ${next.provider.name}.`,
      );
    } catch (error) {
      const message = errorMessage(error, "Não foi possível buscar o próximo horário.");
      setFormError(message);
      showToast("error", message);
    } finally {
      setFindingNext(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!slot || name.trim().length < 2) return;
    setSaving(true);
    setFormError("");
    try {
      const created = await json<{ appointment: Appointment }>("/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime: slot,
          providerId,
          patientName: name,
          patientPhone: phone,
        }),
      });
      setName("");
      setPhone("");
      setSlot("");
      showToast(
        "success",
        `Consulta confirmada com ${created.appointment.provider.name}. Protocolo ${created.appointment.id.slice(0, 8).toUpperCase()}.`,
      );
      await Promise.all([loadDateAvailability(date), loadAppointments()]);
    } catch (error) {
      const message = errorMessage(error, "Erro ao confirmar o agendamento.");
      setFormError(message);
      showToast("error", message);
      await loadDateAvailability(date);
    } finally {
      setSaving(false);
    }
  }

  async function executeConfirmedAction() {
    if (!confirmAction) return;
    const { kind, appointment } = confirmAction;
    setActionId(appointment.id);
    try {
      if (kind === "cancel") {
        await json<{ appointment: Appointment }>(
          `/appointments?id=${encodeURIComponent(appointment.id)}`,
          { method: "DELETE" },
        );
        showToast("success", "Consulta cancelada. O horário voltou a ficar disponível.");
      } else {
        await json<{ appointment: Appointment }>("/appointments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: appointment.id, status: "COMPLETED" }),
        });
        showToast("success", "Consulta marcada como concluída.");
      }
      setConfirmAction(null);
      await Promise.all([loadDateAvailability(date), loadAppointments()]);
    } catch (error) {
      showToast("error", errorMessage(error, "Não foi possível atualizar a consulta."));
    } finally {
      setActionId("");
    }
  }

  const activeAppointments = useMemo(
    () => appointments.filter((item) => item.status === "CONFIRMED"),
    [appointments],
  );
  const completedAppointments = useMemo(
    () => appointments.filter((item) => item.status === "COMPLETED"),
    [appointments],
  );
  const cancelledAppointments = useMemo(
    () => appointments.filter((item) => item.status === "CANCELLED"),
    [appointments],
  );
  const selectedDateAppointments = useMemo(
    () => activeAppointments.filter(
      (item) => item.date === date && item.provider.id === providerId,
    ).length,
    [activeAppointments, date, providerId],
  );
  const selectedProviderAppointments = useMemo(
    () => activeAppointments.filter((item) => item.provider.id === providerId).length,
    [activeAppointments, providerId],
  );
  const availableSlots = availability?.availableCount ?? 0;

  const filteredAppointments = useMemo(() => {
    const query = adminSearch.trim().toLocaleLowerCase("pt-BR");
    return appointments.filter((item) => {
      if (adminDate && item.date !== adminDate) return false;
      if (adminProvider !== "all" && item.provider.id !== adminProvider) return false;
      if (adminStatus !== "all" && item.status !== adminStatus) return false;
      if (!query) return true;
      const haystack = [
        item.patientName,
        item.patientPhone,
        item.provider.name,
        item.provider.specialty,
      ].join(" ").toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [adminDate, adminProvider, adminSearch, adminStatus, appointments]);

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
          com agenda por profissional, busca inteligente, histórico e operação em tempo real.
        </p>

        <div className="hero-tags" aria-label="Destaques técnicos">
          <span>API real de feriados</span>
          <span>Agenda por profissional</span>
          <span>Próximo horário automático</span>
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
            <div><small>VALIDAÇÃO</small><strong>Regras em tempo real</strong><span>Médico, data, feriado e conflito</span></div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">OK</div>
            <div><small>RESULTADO</small><strong>Consulta confirmada</strong><span>Registro e histórico persistidos</span></div>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <form className="booking-card" onSubmit={submit}>
          <div className="card-kicker">AGENDAMENTO INTELIGENTE</div>

          <div className="smart-finder">
            <div>
              <small>ATALHO INTELIGENTE</small>
              <strong>Quer ser atendido o quanto antes?</strong>
              <span>O sistema procura automaticamente o primeiro médico e horário disponíveis a partir da data escolhida.</span>
            </div>
            <button
              className="smart-find-button"
              disabled={findingNext || availabilityLoading}
              onClick={() => void findNextAvailability()}
              type="button"
            >
              {findingNext ? "Procurando…" : "Encontrar próximo horário"}
            </button>
          </div>

          <div className="section-heading">
            <span>1</span>
            <div><h2>Escolha quem vai atender</h2><p>Cada profissional possui uma agenda independente.</p></div>
          </div>
          <div className="provider-grid" role="radiogroup" aria-label="Profissionais disponíveis">
            {PROVIDERS.map((provider) => {
              const selected = provider.id === providerId;
              const providerAvailability = availabilityByProvider[provider.id];
              const providerCount = providerAvailability?.date === date
                ? providerAvailability.availableCount
                : null;
              return (
                <button
                  aria-checked={selected}
                  className={selected ? "provider-card selected" : "provider-card"}
                  key={provider.id}
                  onClick={() => {
                    setProviderId(provider.id);
                    setSlot("");
                  }}
                  role="radio"
                  type="button"
                >
                  <span className="provider-avatar">{provider.initials}</span>
                  <span className="provider-copy">
                    <strong>{provider.name}</strong>
                    <span>{provider.specialty}</span>
                    <small>{provider.description}</small>
                    <em className={providerCount === 0 ? "provider-count unavailable" : "provider-count"}>
                      {availabilityLoading
                        ? "Consultando agenda…"
                        : providerCount === null
                          ? "Agenda indisponível"
                          : providerCount === 0
                            ? "Sem horários nesta data"
                            : `${providerCount} ${providerCount === 1 ? "horário livre" : "horários livres"}`}
                    </em>
                  </span>
                  <span className="provider-check" aria-hidden="true">✓</span>
                </button>
              );
            })}
          </div>

          <div className="divider" />
          <div className="section-heading">
            <span>2</span>
            <div><h2>Escolha a data</h2><p>Atendimento em dias úteis de 2026.</p></div>
          </div>
          <input
            aria-label="Data da consulta"
            className="date-input"
            type="date"
            min="2026-01-01"
            max="2026-12-31"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSlot("");
            }}
          />
          <div className="date-meta" aria-live="polite">
            <span className="meta-pill">{availability?.weekday ?? "Consultando data…"}</span>
            <span className="meta-pill">
              {availability?.timezone ?? "America/Sao_Paulo"} · Brasília
            </span>
            <span className={blocked ? "meta-pill blocked" : "meta-pill ok"}>{dayStatus}</span>
          </div>

          <div className="selected-provider-strip">
            <span className="provider-avatar">{selectedProvider.initials}</span>
            <div>
              <strong>{selectedProvider.name}</strong>
              <span>{selectedProvider.specialty} · agenda das 08h às 18h · {availableSlots} livres nesta data</span>
            </div>
          </div>

          <div className="divider" />
          <div className="section-heading">
            <span>3</span>
            <div><h2>Veja a disponibilidade</h2><p>Horários de uma hora, das 08h às 18h.</p></div>
          </div>

          {availabilityLoading ? (
            <div className="slot-skeleton-grid" aria-label="Carregando horários">
              {Array.from({ length: 10 }, (_, index) => <span className="skeleton slot-skeleton" key={index} />)}
            </div>
          ) : null}
          {!availabilityLoading && blocked ? (
            <div className="notice">
              {blocked === "WEEKEND"
                ? "A clínica não atende aos fins de semana. Use o atalho inteligente para encontrar o próximo dia disponível."
                : `Não há atendimento neste feriado${availability?.holiday?.localName ? `: ${availability.holiday.localName}` : ""}.`}
            </div>
          ) : null}
          {!availabilityLoading && availability?.isBusinessDay ? (
            <div className="slots">
              {availability.slots.map((item) => (
                <button
                  aria-pressed={slot === item.startTime}
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
            <span>4</span>
            <div><h2>Identifique o paciente</h2><p>Nome e contato para concluir o agendamento.</p></div>
          </div>
          <label className="field-label" htmlFor="patient-name">Nome do paciente</label>
          <input
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

          {formError ? <div className="error" role="alert">{formError}</div> : null}

          <button
            className="submit"
            disabled={!slot || name.trim().length < 2 || saving}
            type="submit"
          >
            {saving ? "Confirmando…" : `Confirmar com ${selectedProvider.name}`}
          </button>
        </form>

        <aside className="side-card" aria-label="Painel operacional da agenda">
          <div className="side-eyebrow">OPERAÇÃO EM TEMPO REAL</div>
          <div className="side-title">
            <div><h2>Painel da clínica</h2><p>Agenda, histórico e contato</p></div>
            <strong>{activeAppointments.length}</strong>
          </div>

          <div className="provider-summary">
            <small>PROFISSIONAL SELECIONADO</small>
            <strong>{selectedProvider.name}</strong>
            <span>{selectedProvider.specialty} · {selectedDateAppointments} consulta(s) nesta data</span>
          </div>

          <div className="metrics metrics-four" aria-label="Resumo da agenda">
            <div><strong>{activeAppointments.length}</strong><span>confirmadas</span></div>
            <div><strong>{completedAppointments.length}</strong><span>concluídas</span></div>
            <div><strong>{cancelledAppointments.length}</strong><span>canceladas</span></div>
            <div><strong>{selectedProviderAppointments}</strong><span>do médico</span></div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-title">
              <div><strong>Agenda operacional</strong><span>Filtre e gerencie os registros</span></div>
              <em>{filteredAppointments.length}</em>
            </div>

            <label className="filter-field filter-search" htmlFor="agenda-search">
              <span>Buscar paciente ou telefone</span>
              <input
                id="agenda-search"
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Nome, telefone ou profissional"
                type="search"
                value={adminSearch}
              />
            </label>

            <div className="filter-grid">
              <label className="filter-field" htmlFor="agenda-provider">
                <span>Profissional</span>
                <select id="agenda-provider" onChange={(event) => setAdminProvider(event.target.value)} value={adminProvider}>
                  <option value="all">Todos</option>
                  {PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </select>
              </label>
              <label className="filter-field" htmlFor="agenda-status">
                <span>Status</span>
                <select
                  id="agenda-status"
                  onChange={(event) => setAdminStatus(event.target.value as AppointmentStatus | "all")}
                  value={adminStatus}
                >
                  <option value="all">Todos</option>
                  <option value="CONFIRMED">Confirmados</option>
                  <option value="COMPLETED">Concluídos</option>
                  <option value="CANCELLED">Cancelados</option>
                </select>
              </label>
              <label className="filter-field filter-date" htmlFor="agenda-date">
                <span>Data</span>
                <input
                  id="agenda-date"
                  max="2026-12-31"
                  min="2026-01-01"
                  onChange={(event) => setAdminDate(event.target.value)}
                  type="date"
                  value={adminDate}
                />
              </label>
              <button
                className="clear-filters"
                onClick={() => {
                  setAdminSearch("");
                  setAdminDate("");
                  setAdminProvider("all");
                  setAdminStatus("all");
                }}
                type="button"
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {appointmentsLoading ? (
            <div className="appointment-skeletons" aria-label="Carregando agenda">
              {Array.from({ length: 3 }, (_, index) => <span className="skeleton appointment-skeleton" key={index} />)}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="empty">
              <strong>Nenhum registro encontrado</strong>
              <span>Ajuste os filtros ou faça um novo agendamento.</span>
            </div>
          ) : (
            <ol className="appointments operational-list">
              {filteredAppointments.map((item) => {
                const phoneLink = whatsappUrl(item);
                return (
                  <li className={`appointment-row status-${item.status.toLowerCase()}`} key={item.id}>
                    <div className="appointment-date">{item.date.slice(8, 10)}<small>{item.date.slice(5, 7)}/26</small></div>
                    <div className="appointment-info">
                      <div className="appointment-topline">
                        <strong>{item.startTime}–{item.endTime}</strong>
                        <span className={`status-badge status-${item.status.toLowerCase()}`}>
                          {getAppointmentStatusLabel(item.status)}
                        </span>
                      </div>
                      <span className="patient-name">{item.patientName}</span>
                      <small className="appointment-provider">{item.provider.name} · {item.provider.specialty}</small>
                      {item.patientPhone ? <small className="appointment-phone">{formatPhone(item.patientPhone)}</small> : null}
                      <div className="appointment-actions">
                        {phoneLink && item.status === "CONFIRMED" ? (
                          <a
                            className="action-button whatsapp-button"
                            href={phoneLink}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Abrir WhatsApp
                          </a>
                        ) : null}
                        {item.status === "CONFIRMED" ? (
                          <>
                            <button
                              className="action-button complete-button"
                              disabled={actionId === item.id}
                              onClick={() => setConfirmAction({ kind: "complete", appointment: item })}
                              type="button"
                            >
                              Concluir
                            </button>
                            <button
                              className="action-button cancel-button"
                              disabled={actionId === item.id}
                              onClick={() => setConfirmAction({ kind: "cancel", appointment: item })}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="system-card">
            <div><span className="status-dot" /><strong>Regras automatizadas</strong></div>
            <p>Feriados, fins de semana, agenda por profissional e conflitos são validados pelo backend.</p>
          </div>

          <div className="hours">
            <strong>Horário de atendimento</strong>
            <span>Segunda a sexta, 08h–18h</span>
            <span>10 horários por profissional · Horário de Brasília</span>
          </div>
        </aside>
      </section>

      <footer>
        <strong>Garde Agenda</strong>
        <span>Case técnico Full Stack · conceito demonstrativo inspirado no ecossistema Garde.</span>
        <small>Não é um produto oficial da Garde Inteligência Empresarial. Use apenas dados fictícios.</small>
      </footer>

      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          <span>{toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "i"}</span>
          <p>{toast.message}</p>
          <button aria-label="Fechar aviso" onClick={() => setToast(null)} type="button">×</button>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setConfirmAction(null);
        }}>
          <div aria-labelledby="confirm-title" aria-modal="true" className="confirm-modal" role="dialog">
            <div className={`modal-icon ${confirmAction.kind}`}>{confirmAction.kind === "cancel" ? "×" : "✓"}</div>
            <h2 id="confirm-title">
              {confirmAction.kind === "cancel" ? "Cancelar esta consulta?" : "Marcar como concluída?"}
            </h2>
            <p>
              {confirmAction.appointment.patientName} · {confirmAction.appointment.provider.name}<br />
              {formatDate(confirmAction.appointment.date)} às {confirmAction.appointment.startTime}
            </p>
            <span>
              {confirmAction.kind === "cancel"
                ? "O registro continuará no histórico, mas o horário será liberado para um novo agendamento."
                : "A consulta permanecerá no histórico com status de concluída."}
            </span>
            <div className="modal-actions">
              <button className="modal-secondary" onClick={() => setConfirmAction(null)} type="button">Voltar</button>
              <button
                className={confirmAction.kind === "cancel" ? "modal-primary danger" : "modal-primary"}
                disabled={actionId === confirmAction.appointment.id}
                onClick={() => void executeConfirmedAction()}
                ref={modalPrimaryRef}
                type="button"
              >
                {actionId === confirmAction.appointment.id
                  ? "Atualizando…"
                  : confirmAction.kind === "cancel"
                    ? "Confirmar cancelamento"
                    : "Confirmar conclusão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
