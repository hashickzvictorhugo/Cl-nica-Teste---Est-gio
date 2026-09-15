"use client";

import { useRouter } from "next/navigation";

import styles from "./admin.module.css";

export function AdminBackButton() {
  const router = useRouter();

  return (
    <button
      className={styles.back}
      onClick={() => router.push("/")}
      type="button"
    >
      ← Voltar ao agendamento público
    </button>
  );
}
