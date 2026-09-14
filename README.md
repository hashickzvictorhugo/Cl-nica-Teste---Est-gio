# Garde Agenda — Case Full Stack de Agendamento

[![CI](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml/badge.svg)](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml)

Case técnico Full Stack desenvolvido a partir de um problema real: reduzir o atendimento manual de uma clínica que recebe pedidos de horários pelo WhatsApp. A solução consulta disponibilidade, aplica regras de negócio no backend, organiza agendas independentes por profissional, encontra automaticamente o próximo horário livre, mantém histórico de atendimento e persiste os dados em Cloudflare D1.

> **Observação:** “Garde Agenda” é um conceito demonstrativo inspirado no contexto do desafio. Não é um produto oficial da Garde Inteligência Empresarial.

## Produção

**https://clinica-teste-agendamentos.hashickzvictorhugo.workers.dev**

## Diferenciais implementados

Além dos requisitos mínimos do desafio, o projeto inclui:

- agenda **independente por profissional**;
- quatro profissionais fictícios com especialidades diferentes;
- disponibilidade exibida individualmente em cada card de profissional;
- busca de **próximo horário disponível** entre médicos, datas e horários;
- o mesmo horário pode ser usado por profissionais diferentes;
- bloqueio de conflito apenas quando **profissional + data + horário** coincidem;
- telefone/WhatsApp opcional do paciente;
- botão para abrir o WhatsApp com uma mensagem de confirmação pronta — sem simular integração automática com a plataforma;
- status `CONFIRMED`, `COMPLETED` e `CANCELLED`;
- cancelamento lógico: o registro continua no histórico e o horário é liberado para nova reserva;
- painel operacional com busca e filtros por data, profissional e status;
- métricas de consultas confirmadas, concluídas e canceladas;
- modal próprio de confirmação, toasts, skeletons e mensagens de erro específicas;
- navegação e foco acessíveis, além de suporte a `prefers-reduced-motion`;
- layout responsivo para desktop, tablet e celular;
- deploy em Cloudflare Workers + D1;
- CI com lint, TypeScript, testes e build.

## Requisitos do desafio

| Requisito | Implementação |
| --- | --- |
| Escolher uma data | Seletor de data no frontend |
| Exibir horários disponíveis | `GET /available?date=AAAA-MM-DD&providerId=...` |
| Criar agendamento | `POST /appointments` |
| Listar agendamentos | `GET /appointments` |
| Bloquear finais de semana | Validação no backend |
| Bloquear feriados | Nager.Date consumida exclusivamente no backend |
| Bloquear horários ocupados | Consulta de disponibilidade + índice único parcial no banco |
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

## Fluxo principal

```text
Paciente
   │
   ├── escolhe profissional + data
   │        │
   │        └── GET /available
   │             ├── valida data e dia útil
   │             ├── consulta feriados Nager.Date
   │             └── consulta conflitos ativos do profissional no D1
   │
   ├── ou usa “Encontrar próximo horário”
   │        │
   │        └── GET /next-available
   │             └── procura a primeira combinação livre de data + horário + profissional
   │
   ▼
Seleciona horário e informa paciente
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
- o mesmo profissional não pode ter dois agendamentos ativos na mesma data e horário;
- agendamentos cancelados continuam no histórico, mas deixam de bloquear o horário;
- consultas concluídas continuam contando como ocupação daquele registro;
- nome do paciente: 2–80 caracteres após normalização;
- telefone/WhatsApp opcional: 8–13 dígitos após normalização;
- datas usam `AAAA-MM-DD`;
- fuso de referência: `America/Sao_Paulo`.

### Concorrência

A disponibilidade mostrada pelo frontend não é garantia de reserva. O `POST` valida novamente as regras e o banco possui um índice único parcial em:

```text
(provider_id, appointment_date, start_time)
WHERE status <> 'CANCELLED'
```

Se duas requisições tentarem reservar o mesmo profissional no mesmo horário, apenas uma é persistida e a outra recebe `409 SLOT_TAKEN`. Um registro cancelado deixa de participar do índice e libera o slot sem apagar o histórico.

### API externa indisponível

A lista de feriados fica em cache por seis horas. Se a Nager.Date não puder ser consultada, o sistema falha fechado com `503` e não cria nem sugere um agendamento sem validar a data.

## Endpoints

### `GET /available?date=2026-02-10&providerId=ana-martins`

Retorna a agenda de um profissional, o dia da semana, fuso, feriado e os dez slots com disponibilidade. `providerId` é opcional por compatibilidade; quando omitido, o primeiro profissional é usado.

### `GET /next-available?fromDate=2026-02-10&providerId=all`

Procura o primeiro horário livre a partir da data informada. Com `providerId=all`, considera toda a equipe; também aceita um ID específico de profissional.

Exemplo:

```json
{
  "fromDate": "2026-02-10",
  "date": "2026-02-10",
  "weekday": "terça-feira",
  "timezone": "America/Sao_Paulo",
  "provider": {
    "id": "lucas-ferreira",
    "name": "Dr. Lucas Ferreira",
    "specialty": "Cardiologia"
  },
  "slot": {
    "startTime": "08:00",
    "endTime": "09:00"
  }
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

Retorna até 200 registros com profissional, paciente, data, horário, telefone e status. Suporta filtros opcionais:

```text
?date=2026-02-10
&providerId=ana-martins
&status=CONFIRMED
&q=Maria
```

### `PATCH /appointments`

Permite marcar uma consulta ativa como concluída ou restaurar de concluída para confirmada:

```json
{
  "id": "appointment-id",
  "status": "COMPLETED"
}
```

Consultas canceladas são terminais no histórico e não podem ser reativadas.

### `DELETE /appointments?id=<id>`

Faz **cancelamento lógico**. O registro recebe `CANCELLED`, continua visível no histórico e o slot volta a ficar disponível.

## Profissionais do ambiente demonstrativo

Os nomes abaixo são fictícios e existem apenas para demonstrar agendas independentes:

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

## Deploy seguro

O comando de release inspeciona o schema remoto antes de publicar e aplica **somente as migrações ainda ausentes**:

```bash
pnpm run release
```

A rotina verifica, nesta ordem:

1. tabela base `appointments`;
2. campo `patient_phone`;
3. agenda por `provider_id`;
4. histórico/status de agendamento.

Isso evita reaplicar migrações de uso único em uma base que já foi atualizada.

Os comandos individuais continuam disponíveis para manutenção:

```bash
pnpm run db:remote:add-phone
pnpm run db:remote:add-provider
pnpm run db:remote:add-status
```

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

Os testes validam datas, finais de semana, slots, normalização de dados, serviço de feriados, cache, agenda por profissional, concorrência, liberação de slots cancelados, restrições de status e busca do próximo horário.

## Estrutura principal

```text
app/
  available/route.ts
  next-available/route.ts
  appointments/route.ts
  components/SchedulingApp.tsx
  globals.css
  provider.css

db/
  index.ts
  schema.ts

drizzle/
  bootstrap.sql
  0000_quick_leopardon.sql
  0001_add_patient_phone.sql
  0002_add_provider_schedule.sql
  0003_add_appointment_status.sql

lib/
  api-response.ts
  appointment-status.ts
  holiday-service.ts
  next-availability.ts
  providers.ts
  scheduling.ts

scripts/
  migrate-production.mjs

tests/
  database-schema.test.ts
  holiday-service.test.ts
  next-availability.test.ts
  scheduling.test.ts
```

## Privacidade

É um projeto demonstrativo. Os profissionais são fictícios e a interface orienta o uso de dados fictícios. Não deve ser usada como sistema clínico real nem para armazenar dados reais de pacientes.
