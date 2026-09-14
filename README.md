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

```text
Navegador
  ├─ GET /available?date=2026-02-10
  ├─ POST /appointments
  └─ GET /appointments
          │
          ▼
Backend / regras de agenda
  ├─ Nager.Date (feriados BR de 2026)
  └─ D1 / SQLite (agendamentos)
```

O índice único `(appointment_date, start_time)` é a proteção definitiva contra duas reservas concorrentes para o mesmo horário. A lista de feriados fica em cache no processo por seis horas; se a verificação externa falhar, o sistema falha fechado e não cria uma reserva sem validar o dia.

## Como executar

Pré-requisitos: Node.js 22.13 ou superior e pnpm 11.

```bash
pnpm install
pnpm run build
pnpm run db:local:migrate
pnpm run dev
```

Acesse `http://localhost:5173`. A migração local é idempotente e pode ser executada novamente com segurança.

Para validar todo o projeto:

```bash
pnpm run check
```

Também é possível executar as etapas separadamente:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Endpoints REST

### `GET /available?date=2026-02-10`

Retorna dados da data, fuso, horário de funcionamento e todos os intervalos com o estado de disponibilidade.

### `POST /appointments`

Cria uma reserva válida após revalidar as regras no backend. Conflitos de horário retornam `409`.

### `GET /appointments`

Retorna até 100 agendamentos ordenados por data, horário e criação.

## Regras e decisões

- O ano aceito é 2026, pois a API obrigatória do enunciado é `https://date.nager.at/api/v3/PublicHolidays/2026/BR`.
- `17:00` é o último início possível; a consulta termina às `18:00`.
- Datas são validadas como `AAAA-MM-DD` sem conversões que possam deslocar o dia por fuso horário.
- O fuso exibido e retornado é `America/Sao_Paulo`.
- Todos os feriados devolvidos pelo endpoint obrigatório são bloqueados.
- Não há autenticação ou cancelamento, porque não fazem parte do escopo mínimo solicitado.

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
