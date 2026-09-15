"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { getAppointmentStatusLabel, type AppointmentStatus } from "@/lib/appointment-status";
import { PROVIDERS, type Provider } from "@/lib/providers";

import styles from "./admin.module.css";

type Appointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  provider: Provider;
  patientName: string;
  patientPhone: string;
  status: AppointmentStatus;
};

type ApiPayload = {
  appointments?: Appointment[];
  error?: { message?: string };
};

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
  if (!response.ok) throw new Error(data.error?.message ?? "Não foi possível abrir a área administrativa.");
  return data.appointments ?? [];
}

export function AdminDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");

  async function unlock(candidate: string) {
    setLoading(true);
    setError("");
    try {
      const rows = await requestAppointments(candidate);
      setAppointments(rows);
      setToken(candidate);
      setTokenInput("");
      sessionStorage.setItem("garde-admin-token", candidate);
    } catch (err) {
      setAppointments([]);
      setToken("");
      sessionStorage.removeItem("garde-admin-token");
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("garde-admin-token");
    if (!saved) return;
    const timer = window.setTimeout(() => {
      void unlock(saved);
    }, 0);
    return () => window.clearTimeout(timer);
    // A restauração só deve ocorrer uma vez ao abrir a área administrativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setAppointments(await requestAppointments(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  async function updateAppointment(item: Appointment, kind: "complete" | "cancel") {
    if (!token) return;
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
      if (!response.ok) throw new Error(data.error?.message ?? "Não foi possível atualizar a consulta.");
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
      return [item.patientName, item.patientPhone, item.provider.name, item.provider.specialty]
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
        <p>Os dados de pacientes e as ações operacionais exigem a credencial administrativa configurada no servidor.</p>
        <form onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (tokenInput.trim()) void unlock(tokenInput.trim());
        }}>
          <label htmlFor="admin-token">
            Credencial administrativa
            <input
              id="admin-token"
              autoComplete="current-password"
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="ADMIN_TOKEN"
              type="password"
              value={tokenInput}
            />
          </label>
          <button className={styles.primary} disabled={loading || !tokenInput.trim()} type="submit">
            {loading ? "Validando…" : "Entrar no painel"}
          </button>
          {error ? <div className={styles.message}>{error}</div> : null}
        </form>
        <div className={styles.notice}>A credencial fica somente nesta aba do navegador, em sessionStorage, e nunca é gravada no código-fonte.</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div>
          <h2>Operação da clínica</h2>
          <p>Dados pessoais e ações administrativas protegidos por autenticação no backend.</p>
        </div>
        <button className={styles.ghost} onClick={() => {
          sessionStorage.removeItem("garde-admin-token");
          setToken("");
          setAppointments([]);
        }} type="button">Sair</button>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}><strong>{confirmed}</strong><span>confirmadas</span></div>
        <div className={styles.metric}><strong>{completed}</strong><span>concluídas</span></div>
        <div className={styles.metric}><strong>{cancelled}</strong><span>canceladas</span></div>
        <div className={styles.metric}><strong>{appointments.length}</strong><span>registros</span></div>
      </div>

      <div className={styles.filters}>
        <label>Buscar<input onChange={(event) => setSearch(event.target.value)} placeholder="Paciente, telefone ou profissional" type="search" value={search} /></label>
        <label>Data<input max="2026-12-31" min="2026-01-01" onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
        <label>Profissional<select onChange={(event) => setProvider(event.target.value)} value={provider}><option value="all">Todos</option>{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Status<select onChange={(event) => setStatus(event.target.value as AppointmentStatus | "all")} value={status}><option value="all">Todos</option><option value="CONFIRMED">Confirmados</option><option value="COMPLETED">Concluídos</option><option value="CANCELLED">Cancelados</option></select></label>
      </div>

      {error ? <div className={styles.message}>{error}</div> : null}
      {loading ? <div className={styles.loading}>Atualizando agenda…</div> : null}

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
                </div>
                <div className={styles.actions}>
                  {phoneLink && item.status === "CONFIRMED" ? <a href={phoneLink} rel="noreferrer" target="_blank">WhatsApp</a> : null}
                  {item.status === "CONFIRMED" ? <button className={styles.success} onClick={() => void updateAppointment(item, "complete")} type="button">Concluir</button> : null}
                  {item.status === "CONFIRMED" ? <button className={styles.danger} onClick={() => void updateAppointment(item, "cancel")} type="button">Cancelar</button> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
