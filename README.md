# Clínica Teste — Agendamento Full Stack

[![CI](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml/badge.svg)](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml)

Sistema web de agendamento desenvolvido para o desafio técnico de Estágio Full Stack. O usuário escolhe uma data, consulta horários disponíveis e confirma uma consulta. O backend valida dias úteis e feriados nacionais de 2026, impede conflitos de horário e persiste os agendamentos em SQLite/Cloudflare D1.

## Requisitos do desafio

| Requisito | Implementação |
| --- | --- |
| Escolher uma data | Seletor de data no frontend |
| Exibir horários disponíveis | `GET /available?date=AAAA-MM-DD` |
| Criar agendamento | `POST /appointments` |
| Listar agendamentos | `GET /appointments` |
| Bloquear finais de semana | Validação no backend |
| Bloquear feriados | Nager.Date consumida exclusivamente no backend |
| Bloquear horários ocupados | Consulta de disponibilidade + índice único no banco |
| Horário 08:00–18:00 | 10 slots de 1 hora, com último início às 17:00 |
| Persistência | Cloudflare D1 / SQLite com Drizzle ORM |
| Dados de data e fuso | Dia da semana + `America/Sao_Paulo` retornados pela API e exibidos na interface |

## Stack

- **Frontend:** React 19 + TypeScript + Vinext/Vite
- **Backend:** Route Handlers REST
- **Banco:** Cloudflare D1 (SQLite) + Drizzle ORM
- **API externa:** [Nager.Date](https://date.nager.at/api/v3/PublicHolidays/2026/BR)
- **Testes:** Node.js Test Runner + SQLite em memória
- **Qualidade:** ESLint, TypeScript e GitHub Actions

## Arquitetura

```text
Frontend
  │
  ├── GET /available?date=2026-02-10
  ├── POST /appointments
  └── GET /appointments
          │
          ▼
Backend / regras de negócio
  ├── Nager.Date → feriados BR de 2026
  └── D1 / SQLite → agendamentos
```

O frontend nunca consulta a API de feriados diretamente. A validação é refeita no `POST`, evitando que um usuário contorne as regras pelo navegador.

## Regras de negócio

- atendimento de segunda a sexta-feira;
- funcionamento das **08:00 às 18:00**;
- consultas de **1 hora**;
- horários de início permitidos: `08:00` até `17:00`;
- feriados nacionais de 2026 e finais de semana são bloqueados;
- horários já ocupados não podem ser reservados novamente;
- o nome do paciente é normalizado e limitado a 2–80 caracteres;
- datas são tratadas como `AAAA-MM-DD`, evitando deslocamentos de dia por fuso horário;
- fuso de referência: `America/Sao_Paulo`.

### Concorrência

A disponibilidade exibida no frontend não é considerada garantia de reserva. No momento do `POST`, todas as regras são validadas novamente e o banco possui um índice único em `(appointment_date, start_time)`. Se duas requisições tentarem reservar o mesmo horário, apenas uma é persistida e a outra recebe `409 SLOT_TAKEN`.

### Indisponibilidade da API externa

A lista de feriados fica em cache por seis horas. Caso a Nager.Date esteja indisponível, o sistema **falha fechado**: retorna `503` e não cria um agendamento sem conseguir validar o dia.

## Endpoints

### `GET /available?date=2026-02-10`

Retorna a data, dia da semana, fuso horário, horário de funcionamento e todos os slots com seu estado de disponibilidade.

```json
{
  "date": "2026-02-10",
  "timezone": "America/Sao_Paulo",
  "weekday": "terça-feira",
  "isBusinessDay": true,
  "blockedReason": null,
  "holiday": null,
  "businessHours": {
    "opensAt": "08:00",
    "closesAt": "18:00",
    "durationMinutes": 60
  },
  "slots": [
    { "startTime": "08:00", "endTime": "09:00", "available": true }
  ]
}
```

Datas inválidas retornam `400`. Finais de semana e feriados retornam `200`, mas sem horários disponíveis. Falha na consulta de feriados retorna `503`.

### `POST /appointments`

```json
{
  "date": "2026-02-10",
  "startTime": "09:00",
  "patientName": "Maria Silva"
}
```

Uma reserva válida retorna `201`. Horário já reservado retorna `409`.

### `GET /appointments`

Retorna até 100 agendamentos, ordenados por data, horário e criação.

## Executando localmente

### Pré-requisitos

- Node.js **22.13+**
- pnpm **11.19+**

```bash
pnpm install
pnpm run build
pnpm run db:local:migrate
pnpm run dev
```

A aplicação fica disponível em `http://localhost:5173`.

## Validação

Para executar todas as verificações:

```bash
pnpm run check
```

O comando executa, em sequência:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

Os testes cobrem validação de datas, finais de semana, geração de slots, horários ocupados, normalização de nomes, resposta da API de feriados, cache e restrições de unicidade/horário do banco.

## Estrutura principal

```text
app/
  available/route.ts          # GET /available
  appointments/route.ts       # GET e POST /appointments
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
  holiday-service.test.ts
  scheduling.test.ts
```

## Decisões de escopo

O desafio solicita o fluxo mínimo de consulta e criação de agendamentos. Por isso, autenticação, edição e cancelamento de consultas não foram adicionados. A interface pede nomes fictícios para demonstração e não deve ser usada para armazenar dados reais de pacientes.
