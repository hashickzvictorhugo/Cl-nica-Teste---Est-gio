# Garde Agenda — Case Full Stack de Agendamento

[![CI](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml/badge.svg)](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml)

Case técnico Full Stack desenvolvido a partir de um problema real: reduzir o atendimento manual de uma clínica que recebe pedidos de horários pelo WhatsApp. A solução consulta disponibilidade, executa regras de negócio no backend, organiza agendas independentes por profissional, encontra o próximo horário livre, preserva histórico e persiste os dados em Cloudflare D1.

> **Observação:** “Garde Agenda” é um conceito demonstrativo inspirado no contexto do desafio. Não é um produto oficial da Garde Inteligência Empresarial. O ambiente demonstrativo deve usar apenas dados fictícios.

## Produção

**https://clinica-teste-agendamentos.hashickzvictorhugo.workers.dev**

A área administrativa fica separada em `/admin` e exige uma credencial configurada como secret no Cloudflare Worker.

## Principais diferenciais

- landing page responsiva com experiência de produto completa;
- quatro profissionais fictícios com agendas independentes;
- consulta de disponibilidade por data e profissional;
- busca automática de **próximo horário disponível**;
- fuso de referência `America/Sao_Paulo` em frontend e backend;
- atualização automática da data quando a página atravessa a meia-noite;
- bloqueio de datas passadas e horários vencidos;
- antecedência mínima de **30 minutos** para novos agendamentos/remarcações;
- fins de semana e feriados nacionais de 2026 bloqueados no backend;
- conflito de `profissional + data + horário` protegido também pelo banco;
- bloqueio de duas consultas simultâneas para o mesmo telefone;
- estados `CONFIRMED`, `COMPLETED` e `CANCELLED`;
- cancelamento lógico com antecedência mínima de **60 minutos**;
- conclusão somente após o término real do horário;
- remarcação no mesmo registro;
- área administrativa separada e autenticada;
- dados pessoais nunca são listados pela API pública;
- token administrativo mantido somente em memória, com expiração por inatividade;
- rate limiting por origem e por telefone no agendamento;
- rate limiting para tentativas administrativas inválidas;
- honeypot no formulário público;
- integração opcional com **Cloudflare Turnstile**, validada no backend;
- payload JSON limitado a 8 KiB por tamanho real, não apenas por header;
- CSP, HSTS e demais security headers;
- D1 com índice único, `CHECK`s e triggers defensivas;
- dependências travadas por `pnpm-lock.yaml`;
- CI com lint, TypeScript, testes, build e auditoria de vulnerabilidades altas;
- Dependabot para dependências npm e GitHub Actions.

## Arquitetura de acesso

```text
Paciente / navegador público
        │
        ├── GET /available
        ├── GET /next-available
        └── POST /appointments
                │
                ├── valida payload
                ├── rate limit IP + telefone
                ├── Turnstile (quando configurado)
                ├── regras de data/horário/feriado/conflito
                └── Cloudflare D1

Administrador
        │
        └── /admin
              │
              └── Authorization: Bearer <ADMIN_TOKEN>
                    ├── GET /appointments?scope=admin
                    ├── PATCH /appointments
                    └── DELETE /appointments?id=...
```

O frontend público não recebe a agenda operacional. Nome, telefone e histórico completo só são apresentados após autenticação administrativa validada pelo backend.

## Regras de negócio

- atendimento de segunda a sexta-feira;
- funcionamento das **08:00 às 18:00**;
- consultas de **1 hora**;
- horários de início permitidos: `08:00` até `17:00`;
- datas devem pertencer a 2026;
- datas passadas não aceitam novos agendamentos;
- no dia atual, slots dentro da antecedência mínima de 30 minutos ficam indisponíveis;
- o frontend diferencia horário ocupado, horário encerrado e bloqueio de calendário;
- a busca de próximo horário ignora fins de semana, feriados, conflitos e slots vencidos;
- cada profissional tem agenda independente;
- profissionais diferentes podem usar o mesmo horário;
- um profissional não pode ter dois agendamentos ativos no mesmo slot;
- quando há telefone, o mesmo paciente não pode manter duas consultas ativas no mesmo horário;
- cancelamentos preservam histórico e liberam o slot;
- cancelamentos são permitidos até 60 minutos antes;
- uma consulta só pode ser concluída depois do fim do horário reservado;
- `COMPLETED` e `CANCELLED` são estados terminais;
- remarcação só ocorre a partir de `CONFIRMED` e revalida todas as regras;
- nome: 2–80 caracteres após normalização;
- telefone opcional: 8–13 dígitos após normalização;
- fuso: `America/Sao_Paulo`.

## Concorrência e integridade do banco

O frontend nunca é a autoridade final. O `POST` revalida as regras e o D1 possui índice único parcial:

```text
(provider_id, appointment_date, start_time)
WHERE status <> 'CANCELLED'
```

Assim, duas requisições concorrentes para o mesmo profissional/slot não criam duplicidade: apenas uma persiste e a outra recebe `409 SLOT_TAKEN`.

O banco também mantém `CHECK`s de horário/status e triggers defensivas para validar:

- nome do paciente;
- formato do telefone;
- IDs de profissionais permitidos;
- ano da data do agendamento.

Isso reduz a dependência exclusiva da camada de aplicação para preservar integridade.

## API externa de feriados

Os feriados nacionais são obtidos da Nager.Date exclusivamente pelo backend:

`https://date.nager.at/api/v3/PublicHolidays/2026/BR`

A resposta fica em cache por seis horas. Se a API externa não puder ser validada, o sistema falha fechado com `503` em vez de criar um agendamento em uma data cuja regra de feriado não pôde ser confirmada.

## Endpoints públicos

### `GET /available?date=2026-09-15&providerId=ana-martins`

Retorna somente informações de disponibilidade: profissional, dia da semana, fuso, feriado, política de antecedência e slots. Não retorna pacientes.

### `GET /next-available?fromDate=2026-09-15&providerId=all`

Procura a primeira combinação futura válida de profissional + data + horário.

### `POST /appointments`

Exemplo:

```json
{
  "date": "2026-09-15",
  "startTime": "09:00",
  "providerId": "ana-martins",
  "patientName": "Maria Silva",
  "patientPhone": "18999999999",
  "turnstileToken": "..."
}
```

`turnstileToken` só é obrigatório quando as chaves do Turnstile estiverem configuradas no Worker.

Uma criação válida retorna `201`, mas a resposta pública é minimizada e **não repete nome ou telefone**. Ela contém apenas protocolo/ID, data, horário, profissional, fuso e status.

### `GET /appointments`

A chamada pública retorna uma coleção vazia marcada como protegida. A listagem de pacientes só é liberada no escopo administrativo autenticado.

## Endpoints administrativos

As rotas abaixo exigem:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

### `GET /appointments?scope=admin`

Retorna até 200 registros e aceita filtros opcionais por data, profissional, status e busca textual.

### `PATCH /appointments`

Conclui ou remarca um registro. Remarcações revalidam antecedência, calendário, profissional e conflitos.

### `DELETE /appointments?id=<id>`

Executa cancelamento lógico e mantém o registro no histórico.

## Profissionais demonstrativos

| ID | Profissional | Especialidade |
| --- | --- | --- |
| `ana-martins` | Dra. Ana Martins | Clínica Geral |
| `lucas-ferreira` | Dr. Lucas Ferreira | Cardiologia |
| `camila-rocha` | Dra. Camila Rocha | Dermatologia |
| `beatriz-lima` | Dra. Beatriz Lima | Pediatria |

## Segurança

As decisões e limites estão detalhados em [`SECURITY.md`](./SECURITY.md).

Resumo das proteções atuais:

- secret administrativo fora do código-fonte;
- autenticação e autorização executadas no backend;
- falha fechada se o secret não existir;
- comparação de token baseada em digest;
- sessão administrativa apenas em memória e timeout por inatividade;
- rate limiting por IP + telefone;
- rate limiting de tentativas administrativas;
- honeypot público;
- Turnstile opcional com verificação server-side;
- limite real de corpo JSON;
- queries via Drizzle ORM;
- minimização de PII nas respostas públicas;
- `Cache-Control: no-store` em respostas sensíveis;
- CSP, HSTS, frame protection, Permissions Policy, COOP/CORP e Referrer Policy restritiva;
- banco com controles adicionais de integridade;
- lockfile versionado e auditoria de dependências no CI.

### Configurando o admin

```powershell
pnpm.cmd exec wrangler secret put ADMIN_TOKEN
```

A credencial nunca deve ser enviada para o GitHub.

### Ativando o Cloudflare Turnstile

Crie um widget Turnstile para o domínio/hostname da aplicação e configure **as duas** variáveis no Worker:

```text
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

`TURNSTILE_SITE_KEY` é pública e pode ser configurada como variável do Worker. `TURNSTILE_SECRET_KEY` deve ser configurada como secret. A funcionalidade só é ativada quando ambas estiverem presentes; sem elas, o restante do sistema continua funcionando normalmente.

## Stack

- **Frontend:** React 19 + TypeScript + Vinext/Vite
- **Backend:** Route Handlers REST sobre Cloudflare Workers
- **Banco:** Cloudflare D1 / SQLite + Drizzle ORM
- **API externa:** Nager.Date
- **Anti-bot:** Cloudflare Turnstile opcional
- **Testes:** Node.js Test Runner + SQLite em memória
- **Qualidade:** ESLint + TypeScript + GitHub Actions + pnpm audit
- **Deploy:** Cloudflare Workers

## Executando localmente

Pré-requisitos:

- Node.js **22.13+**
- pnpm **11.19+**

```bash
pnpm install --frozen-lockfile
pnpm run db:local:migrate
pnpm run dev
```

Aplicação local: `http://localhost:5173`.

Para validar tudo:

```bash
pnpm run check
pnpm run audit
```

## Deploy e migração segura

O fluxo recomendado para produção é:

```bash
pnpm run release
```

No Windows/PowerShell:

```powershell
pnpm.cmd run release
```

Antes de publicar, o script inspeciona o schema remoto e aplica apenas o que estiver ausente:

1. tabela base `appointments`;
2. `patient_phone`;
3. `provider_id` e agenda multi-profissional;
4. status/histórico;
5. triggers defensivas de integridade (`0004_harden_appointments.sql`).

O fluxo é idempotente e evita reaplicar migrações de uso único já instaladas.

## CI e supply chain

O workflow de CI:

1. usa GitHub Actions fixadas por SHA;
2. restaura cache do pnpm;
3. instala com `--frozen-lockfile`;
4. executa lint;
5. executa TypeScript;
6. executa testes;
7. executa build;
8. falha em vulnerabilidades de dependências de severidade alta ou crítica.

O Dependabot verifica semanalmente dependências npm e GitHub Actions.

## Escopo do case

Este projeto demonstra engenharia de produto, regras de agenda, segurança defensiva e operação básica. Uma clínica real ainda deveria usar identidade individual por funcionário, MFA, RBAC, auditoria imutável, políticas de retenção/eliminação de PII, gestão de incidentes e controles organizacionais adequados ao tratamento de dados de saúde.
