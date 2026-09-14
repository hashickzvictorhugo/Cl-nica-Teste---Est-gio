# Clínica Teste - agendamento full stack

Aplicação web para consultar horários e criar agendamentos de uma clínica. O projeto implementa o fluxo completo do teste técnico: o frontend consulta o backend, o backend verifica os feriados brasileiros na Nager.Date, valida as regras de negócio e persiste a reserva em SQLite/D1.

## Funcionalidades

- consulta de disponibilidade por data;
- dez horários de uma hora, das 08:00 às 17:00, com fechamento às 18:00;
- bloqueio de sábados, domingos, feriados e horários ocupados;
- confirmação com nome do paciente e protocolo;
- lista persistida de agendamentos;
- mensagens específicas para feriado, fim de semana, agenda cheia, conflito e indisponibilidade externa;
- interface responsiva e acessível em português;
- WebMCP para consultar horários e criar agendamentos pela mesma jornada da interface.

## Stack e arquitetura

- **Frontend:** React 19, TypeScript, Vinext e Tailwind CSS.
- **Backend:** Route Handlers REST executados em Cloudflare Workers.
- **Banco:** Cloudflare D1 (SQLite) com Drizzle ORM.
- **API externa:** Nager.Date, consumida exclusivamente pelo backend.
- **Testes:** runner nativo do Node.js e SQLite em memória.

## Como executar

Pré-requisitos: Node.js 22.13 ou superior e pnpm 11.

```bash
pnpm install
pnpm run build
pnpm run db:local:migrate
pnpm run dev
```

Acesse `http://localhost:5173`.

Para validar todo o projeto:

```bash
pnpm run check
```

## Endpoints REST

- `GET /available?date=2026-02-10`
- `POST /appointments`
- `GET /appointments`

## Regras principais

- atendimento de segunda a sexta;
- dez horários de uma hora, com início entre 08:00 e 17:00;
- bloqueio de feriados nacionais de 2026;
- prevenção de reservas concorrentes para o mesmo horário;
- fuso `America/Sao_Paulo`;
- respostas de erro padronizadas no backend.

## Estrutura principal

```text
app/
  available/route.ts
  appointments/route.ts
  components/SchedulingApp.tsx
db/
  index.ts
  schema.ts
drizzle/
  0000_quick_leopardon.sql
lib/
  api-response.ts
  holiday-service.ts
  scheduling.ts
tests/
  database-schema.test.ts
  scheduling.test.ts
```
