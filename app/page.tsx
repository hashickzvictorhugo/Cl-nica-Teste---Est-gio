import { SchedulingApp } from "@/app/components/SchedulingApp";
import { PROVIDERS } from "@/lib/providers";

import styles from "./marketing.module.css";

const services = [
  {
    icon: "01",
    title: "Agenda em tempo real",
    text: "Disponibilidade individual por profissional, com bloqueio de conflitos no backend.",
  },
  {
    icon: "02",
    title: "Próximo horário inteligente",
    text: "O sistema procura automaticamente a primeira combinação livre de data, médico e horário.",
  },
  {
    icon: "03",
    title: "Contato pelo WhatsApp",
    text: "O telefone do paciente fica associado ao agendamento e pode abrir uma confirmação pronta no WhatsApp.",
  },
  {
    icon: "04",
    title: "Histórico operacional",
    text: "Consultas confirmadas, concluídas e canceladas continuam registradas para acompanhamento.",
  },
];

const faqs = [
  [
    "Como o sistema evita dois pacientes no mesmo horário?",
    "A API revalida o horário antes de salvar e o banco possui uma restrição única por profissional, data e horário.",
  ],
  [
    "Finais de semana e feriados são bloqueados?",
    "Sim. Finais de semana são validados pelo backend e os feriados nacionais de 2026 são consultados pela API Nager.Date.",
  ],
  [
    "Cada médico possui uma agenda própria?",
    "Sim. O mesmo horário pode estar ocupado para um profissional e continuar disponível para outro.",
  ],
  [
    "O cancelamento apaga o agendamento?",
    "Não. O registro passa para o status cancelado, preservando o histórico e liberando novamente o horário.",
  ],
  [
    "Existe integração real com WhatsApp?",
    "A demonstração gera um link do WhatsApp com mensagem pronta. Ela não se apresenta como uma automação oficial da plataforma.",
  ],
  [
    "Esse é um produto oficial da Garde?",
    "Não. Garde Agenda é um conceito demonstrativo desenvolvido para o case técnico, inspirado no contexto do desafio.",
  ],
] as const;

export default function Home() {
  return (
    <div className={styles.site}>
      <div className={styles.utilityBar}>
        <div className={styles.container}>
          <span>Atendimento digital · Segunda a sexta · 08h às 18h</span>
          <span>Case técnico Full Stack · Horário de Brasília</span>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.container}>
          <a className={styles.brand} href="#inicio" aria-label="Garde Agenda - início">
            <span className={styles.brandMark}>G+</span>
            <span>
              <strong>Garde Agenda</strong>
              <small>Saúde · Automação · Full Stack</small>
            </span>
          </a>

          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#solucao">Solução</a>
            <a href="#especialidades">Especialidades</a>
            <a href="#profissionais">Profissionais</a>
            <a href="#agendamento">Agendamento</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>

          <a className={styles.headerCta} href="#agendamento">Agendar agora</a>
        </div>
      </header>

      <section className={styles.hero} id="inicio">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>OPERAÇÃO CLÍNICA, SEM ATRITO</span>
            <h1>
              Agendamento inteligente para transformar mensagens em
              <span> consultas confirmadas.</span>
            </h1>
            <p>
              Uma experiência completa de agenda para clínicas: profissionais, disponibilidade,
              feriados, conflitos, histórico, WhatsApp e busca automática pelo próximo horário.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#agendamento">Agendar uma consulta</a>
              <a className={styles.secondaryButton} href="#solucao">Conhecer a solução</a>
            </div>
            <div className={styles.heroTrust}>
              <span><strong>4</strong> profissionais</span>
              <span><strong>40</strong> horários por dia</span>
              <span><strong>100%</strong> regras no backend</span>
            </div>
          </div>

          <div className={styles.heroVisual} aria-label="Prévia visual do sistema">
            <div className={styles.visualGlow} />
            <div className={styles.dashboardCard}>
              <div className={styles.dashboardTop}>
                <div>
                  <small>AGENDA DE HOJE</small>
                  <strong>Operação em tempo real</strong>
                </div>
                <span className={styles.onlineBadge}>● online</span>
              </div>
              <div className={styles.dashboardMetrics}>
                <div><strong>08</strong><span>confirmadas</span></div>
                <div><strong>17</strong><span>livres</span></div>
                <div><strong>03</strong><span>concluídas</span></div>
              </div>
              <div className={styles.timeline}>
                <div className={styles.timelineRow}><span>09:00</span><i /><strong>Dra. Ana Martins</strong><em>Confirmado</em></div>
                <div className={styles.timelineRow}><span>10:00</span><i /><strong>Dr. Lucas Ferreira</strong><em>Confirmado</em></div>
                <div className={styles.timelineRow}><span>11:00</span><i /><strong>Dra. Camila Rocha</strong><em>Disponível</em></div>
              </div>
            </div>
            <div className={`${styles.floatingCard} ${styles.floatingTop}`}>
              <span>PRÓXIMO HORÁRIO</span>
              <strong>Hoje · 14:00</strong>
              <small>Dra. Beatriz Lima · Pediatria</small>
            </div>
            <div className={`${styles.floatingCard} ${styles.floatingBottom}`}>
              <span>AUTOMAÇÃO</span>
              <strong>Conflitos bloqueados</strong>
              <small>D1 + validação no backend</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.proofStrip} aria-label="Destaques técnicos">
        <div className={styles.container}>
          <span>Cloudflare Workers</span>
          <span>Cloudflare D1</span>
          <span>React + TypeScript</span>
          <span>Nager.Date API</span>
          <span>CI automatizado</span>
        </div>
      </section>

      <section className={styles.section} id="solucao">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionEyebrow}>UMA SOLUÇÃO MAIS COMPLETA</span>
            <h2>Da primeira mensagem ao acompanhamento da consulta.</h2>
            <p>
              A experiência foi desenhada para ir além de um formulário: ela organiza o fluxo
              operacional da clínica e reduz decisões manuais repetitivas.
            </p>
          </div>

          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.title}>
                <span>{service.icon}</span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.softSection}`} id="especialidades">
        <div className={styles.container}>
          <div className={styles.splitHeading}>
            <div>
              <span className={styles.sectionEyebrow}>ESPECIALIDADES</span>
              <h2>Escolha o atendimento ideal.</h2>
            </div>
            <p>Cada especialidade possui agenda independente, disponibilidade e histórico próprios.</p>
          </div>

          <div className={styles.specialtyGrid}>
            {PROVIDERS.map((provider, index) => (
              <article className={styles.specialtyCard} key={provider.id}>
                <div className={styles.specialtyIcon}>{provider.initials}</div>
                <span>0{index + 1}</span>
                <h3>{provider.specialty}</h3>
                <p>{provider.description}</p>
                <a href="#agendamento">Ver horários →</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="profissionais">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionEyebrow}>EQUIPE DEMONSTRATIVA</span>
            <h2>Profissionais com agendas realmente independentes.</h2>
            <p>Os nomes são fictícios e existem apenas para demonstrar a lógica multi-profissional do projeto.</p>
          </div>

          <div className={styles.doctorGrid}>
            {PROVIDERS.map((provider) => (
              <article className={styles.doctorCard} key={provider.id}>
                <div className={styles.doctorPortrait}>
                  <span>{provider.initials}</span>
                  <div className={styles.portraitRing} />
                </div>
                <div className={styles.doctorInfo}>
                  <span>{provider.specialty}</span>
                  <h3>{provider.name}</h3>
                  <p>{provider.description}</p>
                  <a href="#agendamento">Agendar com este profissional</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.bookingSection} ${styles.appHost}`} id="agendamento">
        <div className={styles.container}>
          <div className={styles.bookingHeading}>
            <div>
              <span className={styles.sectionEyebrow}>AGENDAMENTO ONLINE</span>
              <h2>Escolha profissional, data e horário em poucos passos.</h2>
            </div>
            <p>
              O painel abaixo é funcional: consulta o backend, verifica feriados, lê o D1 e impede conflitos reais.
            </p>
          </div>
          <SchedulingApp />
        </div>
      </section>

      <section className={`${styles.section} ${styles.darkSection}`}>
        <div className={styles.container}>
          <div className={styles.darkGrid}>
            <div>
              <span className={styles.darkEyebrow}>COMO FUNCIONA</span>
              <h2>Um fluxo simples para o paciente. Regras fortes por trás.</h2>
              <p>
                A interface mantém o processo leve enquanto o backend cuida da validação de datas,
                disponibilidade, concorrência e persistência.
              </p>
            </div>
            <div className={styles.steps}>
              <article><span>01</span><div><strong>Escolha</strong><p>Profissional, especialidade e data desejada.</p></div></article>
              <article><span>02</span><div><strong>Validação</strong><p>Feriados, fins de semana e conflitos são checados.</p></div></article>
              <article><span>03</span><div><strong>Confirmação</strong><p>O agendamento é persistido e entra no painel operacional.</p></div></article>
              <article><span>04</span><div><strong>Acompanhamento</strong><p>WhatsApp, status, cancelamento e conclusão ficam disponíveis.</p></div></article>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="duvidas">
        <div className={styles.container}>
          <div className={styles.faqGrid}>
            <div className={styles.faqIntro}>
              <span className={styles.sectionEyebrow}>DÚVIDAS FREQUENTES</span>
              <h2>O que existe de verdade nesta demonstração?</h2>
              <p>
                Nada aqui depende de uma tela fake: as regras principais são executadas pela API e pelo banco.
              </p>
              <a className={styles.primaryButton} href="#agendamento">Testar agendamento</a>
            </div>
            <div className={styles.faqList}>
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}<span>+</span></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.container}>
          <div>
            <span>CASE TÉCNICO · GARDE AGENDA</span>
            <h2>Menos operação manual. Mais clareza para quem agenda e para quem atende.</h2>
          </div>
          <a href="#agendamento">Abrir agenda</a>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerBrand}>
            <span className={styles.brandMark}>G+</span>
            <div><strong>Garde Agenda</strong><small>Case demonstrativo Full Stack</small></div>
          </div>
          <p>
            Conceito demonstrativo inspirado no contexto do desafio. Não é um produto oficial da Garde Inteligência Empresarial.
          </p>
          <div className={styles.footerLinks}>
            <a href="#inicio">Início</a>
            <a href="#solucao">Solução</a>
            <a href="#agendamento">Agendamento</a>
            <a href="#duvidas">Dúvidas</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
