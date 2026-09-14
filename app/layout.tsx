import type { Metadata } from "next";
import "./globals.css";
import "./provider.css";

export const metadata: Metadata = {
  title: "Garde Agenda | Agendamento inteligente",
  description: "Case técnico Full Stack com disponibilidade por profissional, regras de agenda e persistência em banco de dados.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
