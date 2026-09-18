# Garde Agenda — Case Full Stack de Agendamento

[![CI](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml/badge.svg)](https://github.com/hashickzvictorhugo/Cl-nica-Teste---Est-gio/actions/workflows/ci.yml)

Case técnico Full Stack desenvolvido a partir de um problema real: reduzir o atendimento manual de uma clínica que recebe pedidos de horários pelo WhatsApp. A solução reúne uma prévia curta do atendimento, consulta disponibilidade, executa regras de negócio no backend, organiza agendas independentes por profissional, encontra o próximo horário livre, preserva histórico e persiste os dados em Cloudflare D1.

> **Observação:** “Garde Agenda” é um conceito demonstrativo inspirado no contexto do desafio. Não é um produto oficial da Garde Inteligência Empresarial. O ambiente demonstrativo deve usar apenas dados fictícios.

## Produção

**https://clinica-teste-agendamentos.hashickzvictorhugo.workers.dev**

Área administrativa: `/admin`.

O projeto suporta duas credenciais server-side:

- `ADMIN_TOKEN`: acesso operacional completo;
- `DEMO_ADMIN_TOKEN`: acesso de avaliação somente leitura, com dataset fictício isolado do D1 real.

Nenhuma credencial é versionada no repositório.

## Fluxo do produto

```text
Pré-atendimento
      ↓
Profissional
      ↓
Data
      ↓
Horário
      ↓
Confirmação
```

Antes de escolher a agenda, o usuário informa somente o necessário para organizar a solicitação:

- nome completo;
- telefone / WhatsApp;
- motivo da consulta;
- duração opcional do que está sentindo;
- primeira consulta ou retorno;
- observações adicionais opcionais.

A etapa é **organizacional**. O sistema não interpreta sintomas para diagnosticar, classificar risco ou recomendar tratamento. A interface informa que a prévia não substitui avaliação médica e orienta a procurar um serviço de urgência em situações graves ou emergenciais.

O case evita coletar CPF, RG, endereço, medicamentos ou histórico clínico detalhado.

## Principais diferenciais

- landing page responsiva com experiência de produto completa;
- pré-atendimento antes da escolha de agenda;
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
- pré-atendimento visível apenas em contexto administrativo autorizado;
- modo administrativo de demonstração somente leitura, sem acesso aos registros reais do D1;
- dataset demo isolado e explicitamente fictício para avaliadores;
- dados pessoais e pré-atendimento nunca são listados pela API pública;
- token administrativo mantido somente em memória, com expiração por inatividade;
- rate limiting por origem e por telefone no agendamento;
- rate limiting para tentativas administrativas inválidas;
- honeypot no formulário público;
- **Cloudflare Turnstile** como proteção anti-bot preferencial, com fallback restrito a requisições same-origin quando a rede/navegador não consegue carregar o desafio;
- payload JSON limitado a 8 KiB por tamanho real, não apenas por header;
- CSP, HSTS e demais security headers;
- D1 com índice único, `CHECK`s e triggers defensivas;
- dependências travadas por `pnpm-lock.yaml`;
- CI com lint, TypeScript, testes, build e auditoria de vulnerabilidades altas;
- CodeQL e Dependabot.

## Arquitetura de acesso

```text
Paciente / navegador público
        │
        ├── pré-atendimento local no fluxo
        ├── GET /available
        ├── GET /next-available
        └── POST /appointments
                │
                ├── valida payload + pré-atendimento
                ├── rate limit IP + telefone
                ├── Turnstile preferencial ou fallback same-origin com rate limit + honeypot
                ├── regras de data/horário/feriado/conflito
                └── Cloudflare D1

Administrador completo
        │
        └── /admin
              │
              └── Authorization: Bearer <ADMIN_TOKEN>
                    ├── GET /appointments?scope=admin → D1
                    ├── PATCH /appointments
                    └── DELETE /appointments?id=...

Avaliador / demonstração
        │
        └── /admin
              │
              └── Authorization: Bearer <DEMO_ADMIN_TOKEN>
                    ├── GET /appointments?scope=admin → dataset fictício isolado
                    ├── PATCH → 403 ADMIN_READ_ONLY
                    └── DELETE → 403 ADMIN_READ_ONLY
```

O frontend público não recebe a agenda operacional. Nome, telefone, motivo, observações e histórico completo só são apresentados após autenticação administrativa. O modo demo recebe somente registros sintéticos incluídos no código e não consulta PII operacional.

## Regras de negócio

### Agenda

- atendimento de segunda a sexta-feira;
- funcionamento das **08:00 às 18:00**;
- consultas de **1 hora**;
- horários de início permitidos: `08:00` até `17:00`;
- datas devem pertencer a 2026;
- datas passadas não aceitam novos agendamentos;
- no dia atual, slots dentro da antecedência mínima de 30 minutos ficam indisponíveis;
- a busca de próximo horário ignora fins de semana, feriados, conflitos e slots vencidos;
- cada profissional tem agenda independente;
- profissionais diferentes podem usar o mesmo horário;
- um profissional não pode ter dois agendamentos ativos no mesmo slot;
- o mesmo telefone não pode manter duas consultas ativas no mesmo horário;
- cancelamentos preservam histórico e liberam o slot;
- cancelamentos são permitidos até 60 minutos antes;
- uma consulta só pode ser concluída depois do fim do horário reservado;
- `COMPLETED` e `CANCELLED` são estados terminais;
- remarcação só ocorre a partir de `CONFIRMED` e revalida as regras.

### Pré-atendimento

- nome: 2–80 caracteres após normalização;
- telefone obrigatório: 8–13 dígitos após normalização;
- motivo da consulta: 5–300 caracteres;
- duração opcional: `TODAY`, `FEW_DAYS`, `WEEKS`, `MONTHS` ou `NOT_APPLICABLE`;
- tipo obrigatório: `FIRST_VISIT` ou `RETURN`;
- observações opcionais: até 500 caracteres;
- nenhuma classificação clínica é gerada a partir desses textos.

## Concorrência e integridade do banco

O frontend nunca é a autoridade final. O `POST` revalida as regras e o D1 possui índice único parcial:

```text
(provider_id, appointment_date, start_time)
WHERE status <> 'CANCELLED'
```

Assim, duas requisições concorrentes para o mesmo profissional/slot não criam duplicidade: apenas uma persiste e a outra recebe `409 SLOT_TAKEN`.

O banco mantém `CHECK`s e triggers defensivas para validar horário/status, nome, telefone, profissional, ano e os limites/enums do pré-atendimento.

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
  "visitReason": "Dor de cabeça há alguns dias",
  "symptomDuration": "FEW_DAYS",
  "visitType": "FIRST_VISIT",
  "patientNotes": "Exemplo fictício para demonstração.",
  "turnstileToken": "..."
}
```

`turnstileToken` é validado quando o desafio do Turnstile consegue carregar. Em redes que bloqueiam o domínio do desafio, o navegador pode usar o modo de compatibilidade: o backend exige origem same-origin e mantém rate limiting por origem/telefone, honeypot e todas as validações de negócio.

Uma criação válida retorna `201`, mas a resposta pública é minimizada e **não repete nome, telefone, motivo, duração, tipo ou observações**. Ela contém apenas protocolo/ID, data, horário, profissional, fuso e status.

### `GET /appointments`

A chamada pública retorna uma coleção vazia marcada como protegida. A listagem administrativa só é liberada após autenticação.

## Endpoints administrativos

A leitura administrativa exige uma das credenciais válidas:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

ou, para avaliação somente leitura:

```text
Authorization: Bearer <DEMO_ADMIN_TOKEN>
```

### `GET /appointments?scope=admin`

Com `ADMIN_TOKEN`, retorna até 200 registros operacionais, incluindo o pré-atendimento, e aceita filtros por data, profissional, status e busca textual.

Com `DEMO_ADMIN_TOKEN`, retorna somente registros fictícios isolados do D1. A resposta informa `access: "demo"` e o painel sinaliza o modo somente leitura.

### `PATCH /appointments`

Conclui ou remarca um registro. Remarcações revalidam antecedência, calendário, profissional e conflitos. **Exige `ADMIN_TOKEN`; a credencial demo recebe `403 ADMIN_READ_ONLY`.**

### `DELETE /appointments?id=<id>`

Executa cancelamento lógico e mantém o registro no histórico. **Exige `ADMIN_TOKEN`; a credencial demo recebe `403 ADMIN_READ_ONLY`.**

## Profissionais demonstrativos

| ID | Profissional | Especialidade |
| --- | --- | --- |
| `ana-martins` | Dra. Ana Martins | Clínica Geral |
| `lucas-ferreira` | Dr. Lucas Ferreira | Cardiologia |
| `camila-rocha` | Dra. Camila Rocha | Dermatologia |
| `beatriz-lima` | Dra. Beatriz Lima | Pediatria |

## Segurança e privacidade

As decisões e limites estão detalhados em [`SECURITY.md`](./SECURITY.md).

Resumo:

- secrets administrativos fora do código-fonte;
- autenticação e autorização server-side;
- separação entre acesso `full` e `demo`;
- demo sem leitura do D1 operacional e sem escrita;
- comparação de token baseada em digest;
- sessão administrativa apenas em memória e timeout por inatividade;
- rate limiting por origem + telefone;
- honeypot, Turnstile preferencial e fallback de compatibilidade restrito a same-origin;
- limite real de corpo JSON;
- queries via Drizzle ORM;
- minimização de PII e conteúdo de pré-atendimento nas respostas públicas;
- `Cache-Control: no-store` em respostas sensíveis;
- CSP, HSTS, frame protection, Permissions Policy, COOP/CORP e Referrer Policy restritiva;
- banco com controles adicionais de integridade;
- lockfile, auditoria, CodeQL e Dependabot.

## Stack

- **Frontend:** React 19 + TypeScript + Vinext/Vite
- **Backend:** Route Handlers REST sobre Cloudflare Workers
- **Banco:** Cloudflare D1 / SQLite + Drizzle ORM
- **API externa:** Nager.Date
- **Anti-bot:** Cloudflare Turnstile preferencial + fallback same-origin para redes restritivas
- **Testes:** Node.js Test Runner + SQLite em memória
- **Qualidade:** ESLint + TypeScript + GitHub Actions + CodeQL + pnpm audit
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

Fluxo recomendado para produção:

```bash
pnpm run release
```

No Windows/PowerShell:

```powershell
pnpm.cmd run release
```

Antes de publicar, o script inspeciona o schema remoto e aplica somente o que estiver ausente:

1. tabela base `appointments`;
2. `patient_phone`;
3. `provider_id` e agenda multi-profissional;
4. status/histórico;
5. triggers defensivas gerais (`0004_harden_appointments.sql`);
6. colunas e triggers do pré-atendimento (`0005_add_pre_attendance.sql`).

As quatro novas colunas são verificadas individualmente antes de qualquer `ALTER TABLE`, mantendo o upgrade idempotente. O modo demo não precisa de seed nem migration porque os registros de avaliação são sintéticos e ficam isolados do banco operacional.

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

CodeQL analisa o código e o Dependabot verifica semanalmente dependências npm e GitHub Actions.

## Escopo do case

Este projeto demonstra engenharia de produto, regras de agenda, segurança defensiva e operação básica. A prévia de atendimento é somente uma simulação de organização e não deve ser usada como prontuário ou ferramenta de decisão médica.

Uma clínica real ainda deveria usar identidade individual por funcionário, MFA, RBAC, auditoria imutável, controles específicos para dados de saúde, políticas de retenção/eliminação de PII, observabilidade, backup/restore e gestão de incidentes.
