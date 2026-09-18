"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TURNSTILE_ACTION } from "@/lib/security-constants";

type SecurityConfig = {
  turnstile?: {
    enabled?: boolean;
    siteKey?: string;
  };
};

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action?: string;
    theme?: "light" | "dark" | "auto";
    callback(token: string): void;
    "expired-callback"?(): void;
    "error-callback"?(): void;
  }): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-garde-turnstile]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.gardeTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function TurnstileWidget({
  onToken,
  resetKey,
}: {
  onToken(token: string): void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [siteKey, setSiteKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let active = true;
    void fetch("/security-config", { cache: "no-store" })
      .then((response) => response.json() as Promise<SecurityConfig>)
      .then((config) => {
        if (!active) return;
        const configured = Boolean(config.turnstile?.enabled && config.turnstile.siteKey);
        setEnabled(configured);
        setSiteKey(configured ? config.turnstile?.siteKey ?? "" : "");
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const renderWidget = useCallback(async () => {
    if (!enabled || !siteKey || !containerRef.current) return;
    setStatus("loading");
    try {
      await loadScript();
      if (!window.turnstile || !containerRef.current) throw new Error("Turnstile unavailable");
      containerRef.current.replaceChildren();
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: TURNSTILE_ACTION,
        theme: "light",
        callback: (token) => {
          onToken(token);
          setStatus("ready");
        },
        "expired-callback": () => {
          onToken("");
          setStatus("loading");
        },
        "error-callback": () => {
          onToken("");
          setStatus("error");
        },
      });
    } catch {
      onToken("");
      setStatus("error");
    }
  }, [enabled, onToken, siteKey]);

  useEffect(() => {
    void renderWidget();
  }, [renderWidget, resetKey]);

  if (!enabled) {
    return (
      <div className="security-check" role="alert">
        <div>
          <strong>Verificação de segurança indisponível</strong>
          <span>O agendamento permanece bloqueado até a proteção anti-bot estar configurada.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="security-check" aria-live="polite">
      <div>
        <strong>Verificação anti-bot</strong>
        <span>Proteção Cloudflare Turnstile antes de confirmar o agendamento.</span>
      </div>
      <div ref={containerRef} />
      {status === "error" ? (
        <small>
          O Turnstile foi bloqueado ou não carregou nesta rede. Você ainda pode confirmar:
          o servidor aplicará as proteções alternativas de compatibilidade.
        </small>
      ) : null}
    </div>
  );
}
