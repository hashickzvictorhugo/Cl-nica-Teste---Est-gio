# Garde Agenda — Case Full Stack de Agendamento

[![CI](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml/badge.svg)](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml)

Case técnico Full Stack desenvolvido a partir de um problema real: reduzir o atendimento manual de uma clínica que recebe pedidos de horários pelo WhatsApp. A solução consulta disponibilidade, aplica regras de negócio no backend, permite escolher o profissional, cria/cancela agendamentos e persiste os dados em Cloudflare D1.

> **Observação:** “Garde Agenda” é um conceito demonstrativo inspirado no contexto do desafio. Não é um produto oficial da Garde Inteligência Empresarial.

## Produção

**https://clinica-teste-agendamentos.hashickzvictorhugo.workers.dev**

## Diferenciais implementados

Além dos requisitos mínimos do desafio, o projeto inclui:

- agenda **independente por profissional**;
- quatro profissionais fictícios com especialidades diferentes;
- o mesmo horário pode ser usado por profissionais diferentes;
- bloqueio de conflito apenas quando **profissional + data + horário** coincidem;
- telefone/WhatsApp opcional do paciente;
- cancelamento de consultas;
- painel com métricas da agenda selecionada;
- identidade visual de produto/case técnico;
- deploy em Cloudflare Workers + D1;
- CI com lint, TypeScript, testes e build.

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
| Dados de data e fuso | Dia da semana + `America/Sao_Paulo` retornados pela API |

## Stack

- **Frontend:** React 19 + TypeScript + Vinext/Vite
- **Backend:** Route Handlers REST
- **Banco:** Cloudflare D1 (SQLite) + Drizzle ORM
- **API externa:** [Nager.Date](https://date.nager.at/api/v3/PublicHolidays/2026/BR)
- **Testes:** Node.js Test Runner + SQLite em memória
- **Qualidade:** ESLint, TypeScript e GitHub Actions
- **Deploy:** Cloudflare Workers

## Fluxo

```text
Paciente
   │
   ▼
Escolhe profissional + data
   │
   ▼
GET /available?date=...&providerId=...
   │
   ├── valida ano / dia útil
   ├── consulta feriados Nager.Date
   └── consulta conflitos do profissional no D1
   │
   ▼
Seleciona horário
   │
   ▼
POST /appointments
   │
   ├── revalida todas as regras
   └── persiste no D1
   │
   ▼
Agendamento confirmado
```

## Regras de negócio

- atendimento de segunda a sexta-feira;
- funcionamento das **08:00 às 18:00**;
- consultas de **1 hora**;
- horários de início permitidos: `08:00` até `17:00`;
- feriados nacionais de 2026 e finais de semana são bloqueados;
- cada profissional possui agenda independente;
- o mesmo horário pode existir simultaneamente para profissionais diferentes;
- o mesmo profissional não pode ter dois pacientes na mesma data e horário;
- nome do paciente: 2–80 caracteres após normalização;
- telefone/WhatsApp opcional: 8–13 dígitos após normalização;
- datas usam `AAAA-MM-DD`;
- fuso de referência: `America/Sao_Paulo`.

### Concorrência

A disponibilidade mostrada pelo frontend não é garantia de reserva. O `POST` valida novamente as regras e o banco possui índice único em:

```text
(provider_id, appointment_date, start_time)
```

Se duas requisições tentarem reservar o mesmo profissional no mesmo horário, apenas uma é persistida e a outra recebe `409 SLOT_TAKEN`.

### API externa indisponível

A lista de feriados fica em cache por seis horas. Se a Nager.Date não puder ser consultada, o sistema falha fechado com `503` e não cria o agendamento sem validar a data.

## Endpoints

### `GET /available?date=2026-02-10&providerId=ana-martins`

`providerId` é opcional por compatibilidade; quando omitido, o primeiro profissional é usado.

Exemplo de resposta:

```json
{
  "date": "2026-02-10",
  "provider": {
    "id": "ana-martins",
    "name": "Dra. Ana Martins",
    "specialty": "Clínica Geral"
  },
  "timezone": "America/Sao_Paulo",
  "weekday": "terça-feira",
  "isBusinessDay": true,
  "blockedReason": null,
  "slots": [
    { "startTime": "08:00", "endTime": "09:00", "available": true }
  ]
}
```

### `POST /appointments`

```json
{
  "date": "2026-02-10",
  "startTime": "09:00",
  "providerId": "ana-martins",
  "patientName": "Maria Silva",
  "patientPhone": "18999999999"
}
```

Reserva válida retorna `201`. Conflito do mesmo profissional retorna `409`.

### `GET /appointments`

Retorna até 100 agendamentos, incluindo profissional, paciente, data, horário e telefone opcional.

### `DELETE /appointments?id=<id>`

Cancela um agendamento. Retorna `404` se o identificador não existir.

## Profissionais do ambiente demonstrativo

Os nomes abaixo são fictícios e existem apenas para demonstrar a agenda independente:

| ID | Profissional | Especialidade |
| --- | --- | --- |
| `ana-martins` | Dra. Ana Martins | Clínica Geral |
| `lucas-ferreira` | Dr. Lucas Ferreira | Cardiologia |
| `camila-rocha` | Dra. Camila Rocha | Dermatologia |
| `beatriz-lima` | Dra. Beatriz Lima | Pediatria |

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

A aplicação fica em `http://localhost:5173`.

## Deploy

Deploy comum, depois que todas as migrações já foram aplicadas:

```bash
pnpm run deploy
```

Para a base de produção que já possui o campo de telefone e ainda não possui agenda por profissional, execute **uma única vez**:

```bash
pnpm run release:providers
```

Esse comando faz o build, migra os agendamentos existentes para o profissional padrão e publica a nova versão logo em seguida.

## Validação

```bash
pnpm run check
```

Executa:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

Os testes validam datas, finais de semana, slots, normalização de dados, serviço de feriados, cache, restrição de horários e concorrência por profissional.

## Estrutura principal

```text
app/
  available/route.ts
  appointments/route.ts
  components/SchedulingApp.tsx
  globals.css
  provider.css

db/
  index.ts
  schema.ts

drizzle/
  0000_quick_leopardon.sql
  0001_add_patient_phone.sql
  0002_add_provider_schedule.sql

lib/
  api-response.ts
  holiday-service.ts
  providers.ts
  scheduling.ts

tests/
  database-schema.test.ts
  holiday-service.test.ts
  scheduling.test.ts
```

## Privacidade

É um projeto demonstrativo. Os dados de profissionais são fictícios e a interface não deve ser usada para armazenar dados reais de pacientes.
