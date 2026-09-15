"use client";

import styles from "./admin.module.css";

export function AdminBackButton() {
  return (
    <button
      className={styles.back}
      onClick={() => window.location.assign("/")}
      type="button"
    >
      ← Voltar ao agendamento público
    </button>
  );
}
