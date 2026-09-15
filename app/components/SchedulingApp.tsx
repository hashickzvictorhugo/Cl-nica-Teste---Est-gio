"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TurnstileWidget } from "@/app/components/TurnstileWidget";
import type { SymptomDuration, VisitType } from "@/lib/pre-attendance";
import { DEFAULT_PROVIDER_ID, PROVIDERS, type Provider } from "@/lib/providers";

type SlotUnavailableReason = "BLOCKED" | "OCCUPIED" | "TOO_SOON" | null;
type Slot = {
  startTime: string;
  endTime: string;
  available: boolean;
  unavailableReason?: SlotUnavailableReason;
};
type Availability = {
  date: string;
  provider: Provider;
  timezone: string;
  weekday: string;
  isBusinessDay: boolean;
  blockedReason: "WEEKEND" | "HOLIDAY" | null;
  holiday: { localName: string } | null;
  bookingPolicy?: { minimumLeadMinutes: number };
  slots: Slot[];
  availableSlots: Slot[];
  availableCount: number;
};
type CreatedAppointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  provider: Provider;
  status: "CONFIRMED";
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
  return value.startsWith("2026-") ? value : "2026-12-31";
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function slotLabel(slot: Slot) {
  if (slot.available) return "Disponível";
  if (slot.unavailableReason === "OCCUPIED") return "Ocupado";
  if (slot.unavailableReason === "TOO_SOON") return "Horário encerrado";
  return "Indisponível";
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
  const [minimumDate, setMinimumDate] = useState(today2026);
  const [date, setDate] = useState(today2026);
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<string, Availability>>({});
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [visitReason, setVisitReason] = useState("");
  const [symptomDuration, setSymptomDuration] = useState<SymptomDuration | "">("");
  const [visitType, setVisitType] = useState<VisitType | "">("");
  const [patientNotes, setPatientNotes] = useState("");
  const [preAttendanceComplete, setPreAttendanceComplete] = useState(false);
  const [preAttendanceError, setPreAttendanceError] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [findingNext, setFindingNext] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    date: string;
    providerId: string;
    startTime: string;
  } | null>(null);

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
    const syncCalendarDate = () => {
      const current = today2026();
      setMinimumDate(current);
      setDate((selected) => {
        if (selected >= current) return selected;
        setSlot("");
        return current;
      });
    };
    syncCalendarDate();
    const timer = window.setInterval(syncCalendarDate, 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  function continuePreAttendance() {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    const phoneDigits = phone.replace(/\D/g, "");
    const normalizedReason = visitReason.trim().replace(/\s+/g, " ");
    const normalizedNotes = patientNotes.trim().replace(/\s+/g, " ");

    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setPreAttendanceError("Informe o nome completo com 2 a 80 caracteres.");
      return;
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 13) {
      setPreAttendanceError("Informe um telefone / WhatsApp válido com 8 a 13 dígitos.");
      return;
    }
    if (normalizedReason.length < 5 || normalizedReason.length > 300) {
      setPreAttendanceError("Descreva o motivo da consulta com 5 a 300 caracteres.");
      return;
    }
    if (!visitType) {
      setPreAttendanceError("Informe se esta é a primeira consulta ou um retorno.");
      return;
    }
    if (normalizedNotes.length > 500) {
      setPreAttendanceError("As observações adicionais devem ter no máximo 500 caracteres.");
      return;
    }

    setName(normalizedName);
    setVisitReason(normalizedReason);
    setPatientNotes(normalizedNotes);
    setPreAttendanceError("");
    setPreAttendanceComplete(true);
    showToast("info", "Pré-atendimento salvo. Agora escolha profissional, data e horário.");
  }

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
    if (!preAttendanceComplete || !slot || name.trim().length < 2) return;
    setSaving(true);
    setFormError("");
    try {
      const created = await json<{ appointment: CreatedAppointment }>("/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime: slot,
          providerId,
          patientName: name,
          patientPhone: phone,
          visitReason,
          symptomDuration,
          visitType,
          patientNotes,
          website,
          turnstileToken,
        }),
      });
      setName("");
      setPhone("");
      setVisitReason("");
      setSymptomDuration("");
      setVisitType("");
      setPatientNotes("");
      setPreAttendanceComplete(false);
      setPreAttendanceError("");
      setWebsite("");
      setSlot("");
      showToast(
        "success",
        `Consulta confirmada com ${created.appointment.provider.name}. Protocolo ${created.appointment.id.slice(0, 8).toUpperCase()}.`,
      );
      await loadDateAvailability(date);
    } catch (error) {
      const message = errorMessage(error, "Erro ao confirmar o agendamento.");
      setFormError(message);
      showToast("error", message);
      await loadDateAvailability(date);
    } finally {
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
      setSaving(false);
    }
  }

  const availableSlots = availability?.availableCount ?? 0;
  const blocked = availability?.blockedReason;
  const dayStatus = !availability
    ? "Consultando"
    : blocked === "WEEKEND"
      ? "Fim de semana"
      : blocked === "HOLIDAY"
        ? "Feriado"
        : "Dia útil";
  const minimumLead = availability?.bookingPolicy?.minimumLeadMinutes ?? 30;

  return (
    <main className="page-shell" aria-label="Agendamento público">
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
          com agenda por profissional, busca inteligente e regras executadas no backend.
        </p>
      </section>

      <section className="content-grid">
        <form className="booking-card" onSubmit={submit}>
          <div className="card-kicker">AGENDAMENTO INTELIGENTE</div>

          {!preAttendanceComplete ? (
            <section className="pre-attendance" aria-labelledby="pre-attendance-title">
              <div className="section-heading pre-attendance-heading">
                <span>1</span>
                <div>
                  <h2 id="pre-attendance-title">Pré-atendimento</h2>
                  <p>Conte brevemente o que motivou a consulta antes de escolher o horário.</p>
                </div>
              </div>

              <div className="pre-attendance-grid">
                <label className="pre-attendance-field" htmlFor="patient-name">
                  <span>Nome completo</span>
                  <input
                    autoComplete="name"
                    id="patient-name"
                    maxLength={80}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex.: Maria Silva"
                    required
                    value={name}
                  />
                </label>

                <label className="pre-attendance-field" htmlFor="patient-phone">
                  <span>Telefone / WhatsApp</span>
                  <input
                    autoComplete="tel"
                    id="patient-phone"
                    inputMode="tel"
                    maxLength={20}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Ex.: (18) 99999-9999"
                    required
                    type="tel"
                    value={phone}
                  />
                </label>

                <label className="pre-attendance-field full" htmlFor="visit-reason">
                  <span>Motivo da consulta / o que está sentindo</span>
                  <textarea
                    id="visit-reason"
                    maxLength={300}
                    minLength={5}
                    onChange={(event) => setVisitReason(event.target.value)}
                    placeholder="Ex.: Estou com dor de cabeça há alguns dias e gostaria de uma avaliação."
                    required
                    rows={4}
                    value={visitReason}
                  />
                  <small>{visitReason.length}/300</small>
                </label>

                <label className="pre-attendance-field" htmlFor="symptom-duration">
                  <span>Há quanto tempo?</span>
                  <select
                    id="symptom-duration"
                    onChange={(event) => setSymptomDuration(event.target.value as SymptomDuration | "")}
                    value={symptomDuration}
                  >
                    <option value="">Prefiro não informar / não sei</option>
                    <option value="TODAY">Hoje</option>
                    <option value="FEW_DAYS">Alguns dias</option>
                    <option value="WEEKS">Algumas semanas</option>
                    <option value="MONTHS">Alguns meses</option>
                    <option value="NOT_APPLICABLE">Não se aplica</option>
                  </select>
                </label>

                <label className="pre-attendance-field" htmlFor="visit-type">
                  <span>Tipo de consulta</span>
                  <select
                    id="visit-type"
                    onChange={(event) => setVisitType(event.target.value as VisitType | "")}
                    required
                    value={visitType}
                  >
                    <option value="">Selecione</option>
                    <option value="FIRST_VISIT">Primeira consulta</option>
                    <option value="RETURN">Retorno</option>
                  </select>
                </label>

                <label className="pre-attendance-field full" htmlFor="patient-notes">
                  <span>Observações adicionais <em>opcional</em></span>
                  <textarea
                    id="patient-notes"
                    maxLength={500}
                    onChange={(event) => setPatientNotes(event.target.value)}
                    placeholder="Algo que ajude a equipe a organizar seu atendimento. Evite inserir informações desnecessárias."
                    rows={3}
                    value={patientNotes}
                  />
                  <small>{patientNotes.length}/500</small>
                </label>
              </div>

              <div className="pre-attendance-notices">
                <p>
                  <strong>Informação importante.</strong> As informações acima servem apenas para organizar o atendimento e não substituem avaliação médica.
                </p>
                <p className="urgent">
                  <strong>Emergência.</strong> Em caso de sintomas graves, emergência ou risco imediato à saúde, procure um serviço de urgência.
                </p>
              </div>

              {preAttendanceError ? <div className="error" role="alert">{preAttendanceError}</div> : null}

              <button className="pre-attendance-continue" onClick={continuePreAttendance} type="button">
                Continuar para escolher o horário
              </button>
            </section>
          ) : (
            <>
              <div className="pre-attendance-summary" role="status">
                <div>
                  <small>PRÉ-ATENDIMENTO PREENCHIDO</small>
                  <strong>{name}</strong>
                  <span>{visitType === "RETURN" ? "Retorno" : "Primeira consulta"} · dados salvos apenas para este agendamento</span>
                </div>
                <button onClick={() => setPreAttendanceComplete(false)} type="button">Editar dados</button>
              </div>

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
                <span>2</span>
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
                <span>3</span>
                <div><h2>Escolha a data</h2><p>Atendimento em dias úteis de 2026.</p></div>
              </div>
              <input
                aria-label="Data da consulta"
                className="date-input"
                type="date"
                min={minimumDate}
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
                <span>4</span>
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
                      aria-label={`${item.startTime} - ${slotLabel(item)}`}
                      aria-pressed={slot === item.startTime}
                      className={slot === item.startTime ? "slot selected" : "slot"}
                      disabled={!item.available}
                      key={item.startTime}
                      onClick={() => setSlot(item.startTime)}
                      type="button"
                    >
                      <strong>{item.startTime}</strong>
                      <small>{slotLabel(item)}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="divider" />
              <div className="section-heading">
                <span>5</span>
                <div><h2>Revise e confirme</h2><p>Se precisar alterar seus dados, volte ao pré-atendimento antes de confirmar.</p></div>
              </div>

              <div className="booking-review">
                <div><small>Paciente</small><strong>{name}</strong></div>
                <div><small>Contato</small><strong>{phone}</strong></div>
                <div><small>Profissional</small><strong>{selectedProvider.name}</strong></div>
                <div><small>Horário</small><strong>{slot ? `${formatDate(date)} · ${slot}` : "Selecione um horário"}</strong></div>
              </div>

              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="company-website">Website</label>
                <input
                  autoComplete="off"
                  id="company-website"
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  type="text"
                  value={website}
                />
              </div>

              <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />

              {formError ? <div className="error" role="alert">{formError}</div> : null}

              <button
                className="submit"
                disabled={!slot || saving}
                type="submit"
              >
                {saving ? "Confirmando…" : `Confirmar com ${selectedProvider.name}`}
              </button>
            </>
          )}
        </form>

        <aside className="side-card" aria-label="Resumo e regras do agendamento">
          <div className="side-eyebrow">SEU AGENDAMENTO</div>
          <div className="side-title">
            <div><h2>{preAttendanceComplete ? "Resumo da escolha" : "Antes de escolher"}</h2><p>{preAttendanceComplete ? "Somente disponibilidade pública" : "Preencha a prévia do atendimento"}</p></div>
            <strong>{preAttendanceComplete ? availableSlots : "1"}</strong>
          </div>

          {preAttendanceComplete ? (
            <div className="provider-summary">
              <small>PROFISSIONAL SELECIONADO</small>
              <strong>{selectedProvider.name}</strong>
              <span>{selectedProvider.specialty} · {formatDate(date)}</span>
            </div>
          ) : (
            <div className="provider-summary">
              <small>ETAPA ATUAL</small>
              <strong>Pré-atendimento</strong>
              <span>Uma prévia curta para organizar o atendimento.</span>
            </div>
          )}

          <div className="metrics metrics-four" aria-label="Políticas do agendamento">
            <div><strong>{preAttendanceComplete ? availableSlots : "—"}</strong><span>horários livres</span></div>
            <div><strong>{minimumLead}m</strong><span>antecedência</span></div>
            <div><strong>1h</strong><span>duração</span></div>
            <div><strong>SP</strong><span>fuso horário</span></div>
          </div>

          <div className="system-card">
            <div><span className="status-dot" /><strong>Privacidade por padrão</strong></div>
            <p>A área pública nunca lista nomes, telefones, motivo da consulta ou histórico de outros pacientes. A operação fica em uma área administrativa separada e autenticada.</p>
          </div>

          <div className="system-card">
            <div><span className="status-dot" /><strong>Sem diagnóstico automático</strong></div>
            <p>A prévia serve somente para organizar o atendimento. O sistema não diagnostica, classifica risco nem recomenda tratamento.</p>
          </div>

          <div className="system-card">
            <div><span className="status-dot" /><strong>Regras automatizadas</strong></div>
            <p>Feriados, fins de semana, horários vencidos, antecedência mínima e conflitos são validados pelo backend antes de gravar no banco.</p>
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
    </main>
  );
}
