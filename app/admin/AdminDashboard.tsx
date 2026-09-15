"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { AdminAccessLevel } from "@/lib/admin-access";
import { getAppointmentStatusLabel, type AppointmentStatus } from "@/lib/appointment-status";
import { symptomDurationLabel, visitTypeLabel } from "@/lib/pre-attendance";
import { PROVIDERS, type Provider } from "@/lib/providers";

import styles from "./admin.module.css";

const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;

type Appointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  provider: Provider;
  patientName: string;
  patientPhone: string;
  visitReason: string;
  symptomDuration: string;
  visitType: string;
  patientNotes: string;
  status: AppointmentStatus;
};

type ApiPayload = {
  appointments?: Appointment[];
  access?: AdminAccessLevel;
  demo?: boolean;
  error?: { message?: string };
};

class AdminRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminRequestError";
    this.status = status;
  }
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

function whatsappUrl(item: Appointment) {
  const digits = item.patientPhone.replace(/\D/g, "");
  if (!digits) return "";
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const message = `Olá, ${item.patientName}! Seu agendamento com ${item.provider.name} está confirmado para ${item.date.split("-").reverse().join("/")} às ${item.startTime}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

async function requestAppointments(token: string) {
  const response = await fetch("/appointments?scope=admin", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await response.json()) as ApiPayload;
  if (!response.ok) {
    throw new AdminRequestError(
      data.error?.message ?? "Não foi possível abrir a área administrativa.",
      response.status,
    );
  }
  return {
    appointments: data.appointments ?? [],
    access: data.access ?? "full",
  };
}

export function AdminDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [access, setAccess] = useState<AdminAccessLevel | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");

  const readOnly = access === "demo";

  const lock = useCallback((message = "") => {
    setToken("");
    setAccess(null);
    setAppointments([]);
    setTokenInput("");
    setLoading(false);
    setError(message);
  }, []);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) lock();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [lock]);

  useEffect(() => {
    if (!token) return;
    let timer = window.setTimeout(
      () => lock("Sessão encerrada após 15 minutos de inatividade."),
      ADMIN_IDLE_TIMEOUT_MS,
    );
    const renew = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => lock("Sessão encerrada após 15 minutos de inatividade."),
        ADMIN_IDLE_TIMEOUT_MS,
      );
    };
    window.addEventListener("pointerdown", renew, { passive: true });
    window.addEventListener("keydown", renew);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", renew);
      window.removeEventListener("keydown", renew);
    };
  }, [lock, token]);

  async function unlock(candidate: string) {
    setLoading(true);
    setError("");
    try {
      const result = await requestAppointments(candidate);
      setAppointments(result.appointments);
      setAccess(result.access);
      setToken(candidate);
      setTokenInput("");
    } catch (err) {
      lock(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const result = await requestAppointments(token);
      setAppointments(result.appointments);
      setAccess(result.access);
    } catch (err) {
      if (err instanceof AdminRequestError && (err.status === 401 || err.status === 429)) {
        lock(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  async function updateAppointment(item: Appointment, kind: "complete" | "cancel") {
    if (!token) return;
    if (readOnly) {
      setError("O modo demonstração é somente leitura. Nenhum registro pode ser alterado com esta credencial.");
      return;
    }

    const confirmed = window.confirm(
      kind === "cancel"
        ? `Cancelar a consulta de ${item.patientName}?`
        : `Marcar a consulta de ${item.patientName} como concluída?`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        kind === "cancel" ? `/appointments?id=${encodeURIComponent(item.id)}` : "/appointments",
        {
          method: kind === "cancel" ? "DELETE" : "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(kind === "complete" ? { "Content-Type": "application/json" } : {}),
          },
          ...(kind === "complete"
            ? { body: JSON.stringify({ id: item.id, status: "COMPLETED" }) }
            : {}),
        },
      );
      const data = (await response.json()) as ApiPayload;
      if (!response.ok) {
        if (response.status === 401 || response.status === 429) {
          lock(data.error?.message ?? "Sessão administrativa encerrada.");
          return;
        }
        throw new Error(data.error?.message ?? "Não foi possível atualizar a consulta.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a consulta.");
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return appointments.filter((item) => {
      if (date && item.date !== date) return false;
      if (provider !== "all" && item.provider.id !== provider) return false;
      if (status !== "all" && item.status !== status) return false;
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
  }, [appointments, date, provider, search, status]);

  const confirmed = appointments.filter((item) => item.status === "CONFIRMED").length;
  const completed = appointments.filter((item) => item.status === "COMPLETED").length;
  const cancelled = appointments.filter((item) => item.status === "CANCELLED").length;

  if (!token) {
    return (
      <div className={`${styles.card} ${styles.login}`}>
        <h2>Área protegida</h2>
        <p>Os dados de pacientes e as ações operacionais exigem uma credencial válida. Avaliadores podem usar uma credencial de demonstração somente leitura.</p>
        <form onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (tokenInput.trim()) void unlock(tokenInput.trim());
        }}>
          <label htmlFor="admin-token">
            Credencial administrativa ou de demonstração
            <input
              id="admin-token"
              autoComplete="current-password"
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="Credencial de acesso"
              type="password"
              value={tokenInput}
            />
          </label>
          <button className={styles.primary} disabled={loading || !tokenInput.trim()} type="submit">
            {loading ? "Validando…" : "Entrar no painel"}
          </button>
          {error ? <div className={styles.message} role="alert">{error}</div> : null}
        </form>
        <div className={styles.notice}>A credencial fica somente na memória da página. A sessão é encerrada ao recarregar, voltar pelo histórico ou após 15 minutos de inatividade.</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div>
          <h2>Operação da clínica</h2>
          <p>Dados pessoais, pré-atendimento e ações administrativas protegidos por autenticação no backend.</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.ghost} disabled={loading} onClick={() => void refresh()} type="button">Atualizar</button>
          <button className={styles.ghost} onClick={() => lock()} type="button">Sair</button>
        </div>
      </div>

      {readOnly ? (
        <div className={styles.notice} role="status">
          <strong>Modo demonstração — somente leitura.</strong> Os registros e dados de pré-atendimento exibidos são fictícios e isolados do banco operacional. Concluir, cancelar e contatar pacientes ficam bloqueados pelo frontend e pela API.
        </div>
      ) : null}

      <div className={styles.metrics} aria-label="Resumo da agenda">
        <div className={styles.metric}><strong>{confirmed}</strong><span>confirmadas</span></div>
        <div className={styles.metric}><strong>{completed}</strong><span>concluídas</span></div>
        <div className={styles.metric}><strong>{cancelled}</strong><span>canceladas</span></div>
        <div className={styles.metric}><strong>{appointments.length}</strong><span>registros</span></div>
      </div>

      <div className={styles.filters}>
        <label>Buscar<input onChange={(event) => setSearch(event.target.value)} placeholder="Paciente, telefone, motivo ou profissional" type="search" value={search} /></label>
        <label>Data<input max="2026-12-31" min="2026-01-01" onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
        <label>Profissional<select onChange={(event) => setProvider(event.target.value)} value={provider}><option value="all">Todos</option>{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Status<select onChange={(event) => setStatus(event.target.value as AppointmentStatus | "all")} value={status}><option value="all">Todos</option><option value="CONFIRMED">Confirmados</option><option value="COMPLETED">Concluídos</option><option value="CANCELLED">Cancelados</option></select></label>
      </div>

      {error ? <div className={styles.message} role="alert">{error}</div> : null}
      {loading ? <div className={styles.loading} role="status">Atualizando agenda…</div> : null}

      {!loading && filtered.length === 0 ? (
        <div className={styles.empty}>Nenhum registro encontrado.</div>
      ) : (
        <ol className={styles.list}>
          {filtered.map((item) => {
            const phoneLink = whatsappUrl(item);
            return (
              <li className={styles.row} key={item.id}>
                <div className={styles.time}><strong>{item.startTime}</strong><span>{item.date.split("-").reverse().join("/")}</span></div>
                <div className={styles.patient}>
                  <strong>{item.patientName}</strong>
                  <span>{item.provider.name} · {item.provider.specialty}</span>
                  {item.patientPhone ? <span>{formatPhone(item.patientPhone)}</span> : null}
                  <span className={`${styles.badge} ${item.status === "CONFIRMED" ? styles.confirmed : item.status === "COMPLETED" ? styles.completed : styles.cancelled}`}>{getAppointmentStatusLabel(item.status)}</span>
                  <details className={styles.preAttendance}>
                    <summary>Pré-atendimento</summary>
                    <div className={styles.preAttendanceBody}>
                      <div className={styles.preAttendanceMeta}>
                        <span><strong>Tipo</strong>{visitTypeLabel(item.visitType)}</span>
                        <span><strong>Duração</strong>{symptomDurationLabel(item.symptomDuration)}</span>
                      </div>
                      <p><strong>Motivo</strong>{item.visitReason || "Registro anterior à implantação do pré-atendimento."}</p>
                      {item.patientNotes ? <p><strong>Observações</strong>{item.patientNotes}</p> : null}
                    </div>
                  </details>
                </div>
                <div className={styles.actions}>
                  {phoneLink && item.status === "CONFIRMED" && !readOnly ? <a href={phoneLink} rel="noreferrer" target="_blank">WhatsApp</a> : null}
                  {item.status === "CONFIRMED" ? <button className={styles.success} disabled={readOnly} onClick={() => void updateAppointment(item, "complete")} title={readOnly ? "Indisponível no modo demonstração" : undefined} type="button">Concluir</button> : null}
                  {item.status === "CONFIRMED" ? <button className={styles.danger} disabled={readOnly} onClick={() => void updateAppointment(item, "cancel")} title={readOnly ? "Indisponível no modo demonstração" : undefined} type="button">Cancelar</button> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
