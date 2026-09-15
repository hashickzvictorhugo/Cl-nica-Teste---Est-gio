import type { Metadata } from "next";
import "./globals.css";
import "./provider.css";
import "./security-ui.css";

const title = "Garde Agenda | Agendamento inteligente";
const description = "Case técnico Full Stack com agenda multi-profissional, regras de negócio no backend, Cloudflare D1 e área administrativa protegida.";

export const metadata: Metadata = {
  metadataBase: new URL("https://clinica-teste-agendamentos.hashickzvictorhugo.workers.dev"),
  title,
  description,
  applicationName: "Garde Agenda",
  creator: "Victor Durães",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title,
    description,
    siteName: "Garde Agenda",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#content">Pular para o conteúdo</a>
        <div id="content">{children}</div>
      </body>
    </html>
  );
}
