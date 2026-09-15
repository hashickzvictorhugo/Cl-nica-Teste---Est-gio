# Segurança — Garde Agenda

Este repositório é um case técnico demonstrativo, mas a arquitetura foi endurecida para separar claramente o que é público do que contém dados pessoais ou altera a operação da clínica.

> O ambiente demonstrativo não deve receber prontuário, diagnóstico, documentos, dados financeiros ou outros dados clínicos sensíveis.

## Modelo de acesso

### Área pública

Pode apenas:

- consultar disponibilidade por profissional;
- buscar o próximo horário livre;
- criar um novo agendamento.

`GET /appointments` sem escopo administrativo não entrega nomes, telefones ou histórico. A confirmação pública de um novo agendamento também retorna apenas o mínimo necessário: protocolo, data, horário, profissional e status.

### Área administrativa completa

`/admin` permite consultar nome/telefone, histórico e executar ações operacionais. A API aceita a credencial completa via:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

O `ADMIN_TOKEN` é um secret do Cloudflare Worker e nunca deve ser colocado no GitHub, no JavaScript público ou em arquivos `.env` versionados.

### Acesso de demonstração para avaliação

Uma segunda credencial opcional, `DEMO_ADMIN_TOKEN`, permite que um avaliador abra o mesmo painel sem receber acesso aos registros operacionais do D1.

Quando a credencial demo é usada:

- `GET /appointments?scope=admin` retorna somente um dataset estático e explicitamente fictício;
- nenhum registro real do banco é retornado;
- `PATCH` e `DELETE` são bloqueados no backend com `403 ADMIN_READ_ONLY`;
- concluir, cancelar e contato via WhatsApp ficam indisponíveis no painel;
- o frontend deixa visível que a sessão está em **modo demonstração — somente leitura**.

A separação é imposta no servidor. Desabilitar os botões no frontend é apenas uma camada adicional de UX, não o controle de autorização principal.

A credencial digitada no painel fica somente na memória do componente. Ela é descartada ao sair/recarregar a página, ao restaurar a página pelo histórico/bfcache e após 15 minutos de inatividade.

## Configuração do acesso administrativo

No Windows/PowerShell, para o administrador real:

```powershell
pnpm.cmd exec wrangler secret put ADMIN_TOKEN
```

Para habilitar o acesso demonstrativo somente leitura:

```powershell
pnpm.cmd exec wrangler secret put DEMO_ADMIN_TOKEN
```

Use credenciais longas, exclusivas e aleatórias, e mantenha `ADMIN_TOKEN` e `DEMO_ADMIN_TOKEN` diferentes. Em seguida, publique pelo fluxo de release, que também verifica as migrações do D1:

```powershell
pnpm.cmd run release
```

## Proteções implementadas

### Autenticação e autorização

- autenticação server-side para listagem protegida e ações administrativas;
- níveis separados de acesso `full` e `demo`;
- credencial demo isolada dos dados reais do D1;
- mutações administrativas aceitas apenas no nível `full`;
- falha fechada quando nenhuma credencial administrativa está configurada;
- comparação das credenciais por digest SHA-256 e comparação byte a byte;
- limitação de tentativas administrativas por origem;
- sessão administrativa somente em memória, com expiração por inatividade;
- `/admin` marcado como `noindex, nofollow`.

### Privacidade

- a área pública não lista registros de pacientes;
- o modo demo não lista registros operacionais reais;
- o dataset demo usa apenas nomes e telefones fictícios identificados como demonstração;
- respostas públicas de criação são minimizadas e não repetem nome/telefone;
- respostas administrativas e sensíveis usam `Cache-Control: no-store`;
- nenhum segredo é armazenado no código-fonte;
- arquivos `.env*`, estado local do Wrangler e artefatos de ferramentas ficam fora do Git.

### Antiabuso

- rate limiting no edge por endereço de origem;
- segundo limite por telefone quando o contato é informado;
- honeypot silencioso no formulário público;
- integração opcional com Cloudflare Turnstile, validada novamente no backend;
- limite real de 8 KiB para JSON, medido em bytes mesmo quando `Content-Length` está ausente ou incorreto.

O Turnstile só é ativado quando **as duas** variáveis abaixo estão configuradas no Worker:

```text
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

A chave pública é entregue ao frontend por `/security-config`; a chave secreta nunca é retornada ao navegador.

### Validação e integridade

- regras de negócio revalidadas no backend;
- datas e horários interpretados em `America/Sao_Paulo`;
- Drizzle ORM nas consultas ao D1;
- índice único parcial impede dois agendamentos ativos do mesmo profissional/data/horário;
- `CHECK` de horários e status no banco;
- triggers defensivas validam nome, telefone, profissional e ano também no D1;
- cancelamento lógico preserva histórico e libera o slot;
- estados concluído/cancelado não são reativados;
- horários passados e janela mínima de antecedência são rejeitados pelo servidor.

### Navegador e transporte

O projeto envia, entre outros:

- `Content-Security-Policy`;
- `Strict-Transport-Security` (HSTS);
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- `Cross-Origin-Opener-Policy`;
- `Cross-Origin-Resource-Policy`;
- `Origin-Agent-Cluster`;
- `Permissions-Policy` restritiva.

A CSP bloqueia objetos, frames externos não autorizados, handlers inline de script e restringe conexões/frames adicionais ao domínio necessário para o Turnstile. O projeto não usa `dangerouslySetInnerHTML` nem `eval`.

## Dependências e supply chain

- dependências críticas são fixadas em versões explícitas;
- o CI executa lint, TypeScript, testes, build e auditoria de vulnerabilidades de severidade alta;
- `pnpm-lock.yaml` deve ser versionado e o CI deve usar instalação congelada;
- atualizações automáticas de dependências são acompanhadas pelo Dependabot.

## Limites deliberados do case

Para uma clínica real, a autenticação por tokens compartilhados deveria ser substituída por identidade individual por funcionário, MFA, RBAC, rotação/revogação de sessão, trilha de auditoria imutável, política formal de retenção/eliminação de PII, observabilidade de segurança e gestão operacional de incidentes.

Esses limites são documentados para não confundir um case demonstrativo com um sistema clínico pronto para processamento de dados de saúde em produção.
