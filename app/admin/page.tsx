import Link from "next/link";

import { AdminDashboard } from "./AdminDashboard";
import styles from "./admin.module.css";

export const metadata = {
  title: "Admin | Garde Agenda",
  description: "Área administrativa protegida da agenda demonstrativa.",
};

export default function AdminPage() {
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <span className={styles.mark}>G+</span>
          <div>
            <strong>Garde Agenda Admin</strong>
            <small>Área operacional protegida</small>
          </div>
        </div>
        <Link className={styles.back} href="/">← Voltar ao agendamento público</Link>
      </header>

      <div className={styles.shell}>
        <section className={styles.hero}>
          <span>ACESSO RESTRITO</span>
          <h1>Painel da clínica.</h1>
          <p>
            Informações de pacientes e ações administrativas não ficam disponíveis na área pública.
            O backend valida a credencial antes de listar, concluir, cancelar ou remarcar consultas.
          </p>
        </section>
        <AdminDashboard />
      </div>
    </main>
  );
}
