# Segurança — Garde Agenda

Este repositório é um case técnico demonstrativo, mas a arquitetura foi endurecida para separar claramente o que é público do que contém dados pessoais ou altera a operação da clínica.

> O ambiente demonstrativo deve usar apenas dados fictícios. O pré-atendimento não é prontuário, não faz diagnóstico ou classificação de risco e não deve receber dados reais de saúde, documentos, dados financeiros ou histórico clínico detalhado.

## Modelo de acesso

### Área pública

Pode apenas:

- preencher uma prévia curta de atendimento;
- consultar disponibilidade por profissional;
- buscar o próximo horário livre;
- criar um novo agendamento.

A prévia coleta nome, telefone/WhatsApp, motivo da consulta, tipo de consulta, duração opcional dos sintomas e observações opcionais. Esses campos existem somente para demonstrar organização de fluxo e não geram diagnóstico, triagem automática, classificação de risco nem recomendação médica.

`GET /appointments` sem escopo administrativo não entrega nomes, telefones, pré-atendimento ou histórico. A confirmação pública de um novo agendamento também retorna apenas o mínimo necessário: protocolo, data, horário, profissional e status.

### Área administrativa completa

`/admin` permite consultar nome/telefone, pré-atendimento, histórico e executar ações operacionais. A API aceita a credencial completa via:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

O `ADMIN_TOKEN` é um secret do Cloudflare Worker e nunca deve ser colocado no GitHub, no JavaScript público ou em arquivos `.env` versionados.

Para uma implantação clínica, o projeto também suporta uma segunda camada de identidade com Cloudflare Access. Quando `REQUIRE_CF_ACCESS_FOR_ADMIN=true`, o backend exige, além do `ADMIN_TOKEN`, um `Cf-Access-Jwt-Assertion` válido, verifica assinatura RS256 contra as chaves públicas do tenant, `iss`, `aud`, `exp`, `nbf` e opcionalmente uma allowlist de e-mails. Isso permite colocar SSO/MFA e identidade individual na frente do acesso administrativo sem confiar em um header de e-mail isolado.

Variáveis do modo clínico:

```text
REQUIRE_CF_ACCESS_FOR_ADMIN=true
CF_ACCESS_TEAM_DOMAIN=<equipe>.cloudflareaccess.com
CF_ACCESS_AUD=<audience da aplicação Access>
ADMIN_ALLOWED_EMAILS=profissional1@empresa.com,profissional2@empresa.com
```

A política do Cloudflare Access deve exigir MFA e restringir usuários/grupos autorizados. O modo demonstrativo não depende dessa camada para que avaliadores consigam usar a credencial demo somente leitura.

### Acesso de demonstração para avaliação

Uma segunda credencial opcional, `DEMO_ADMIN_TOKEN`, permite que um avaliador abra o mesmo painel sem receber acesso aos registros operacionais do D1.

Quando a credencial demo é usada:

- `GET /appointments?scope=admin` retorna somente um dataset estático e explicitamente fictício, inclusive nos campos de pré-atendimento;
- nenhum registro real do banco é retornado;
- `PATCH` e `DELETE` são bloqueados no backend com `403 ADMIN_READ_ONLY`;
- concluir, cancelar e contato via WhatsApp ficam indisponíveis no painel;
- o frontend deixa visível que a sessão está em **modo demonstração — somente leitura**.

A separação é imposta no servidor. Desabilitar os botões no frontend é apenas uma camada adicional de UX, não o controle de autorização principal.

A credencial digitada no painel fica somente na memória do componente. Ela é descartada ao sair/recarregar a página, ao restaurar a página pelo histórico/bfcache e após 15 minutos de inatividade.

Se `ADMIN_TOKEN` e `DEMO_ADMIN_TOKEN` forem iguais, o backend considera a configuração insegura e bloqueia todo acesso administrativo com erro de configuração. Não existe fallback para acesso completo.

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
- configuração com tokens full/demo iguais falha fechada;
- falha fechada quando nenhuma credencial administrativa está configurada;
- comparação das credenciais por digest SHA-256 e comparação byte a byte;
- rate limiting administrativo dedicado por origem;
- sessão administrativa somente em memória, com expiração por inatividade;
- `/admin` marcado como `noindex, nofollow`, `noarchive` e `Cache-Control: no-store`;
- suporte opcional a identidade individual, SSO/MFA e allowlist via Cloudflare Access JWT validado criptograficamente.

### Privacidade

- a área pública não lista registros de pacientes;
- nome, telefone, motivo, duração, tipo de consulta e observações não aparecem na confirmação pública;
- o modo demo não lista registros operacionais reais;
- o dataset demo usa apenas nomes, telefones e textos de pré-atendimento fictícios identificados como demonstração;
- respostas públicas de criação são minimizadas e não repetem PII nem conteúdo da prévia;
- respostas administrativas e sensíveis usam `Cache-Control: no-store`;
- o formulário pede apenas os campos necessários ao fluxo demonstrativo e evita CPF, RG, endereço, medicamentos e histórico clínico detalhado;
- nenhum segredo é armazenado no código-fonte;
- arquivos `.env*`, estado local do Wrangler e artefatos de ferramentas ficam fora do Git.

### Antiabuso

- limite dedicado de criação por endereço de origem;
- segundo limite por telefone normalizado;
- limites próprios para consultas públicas de disponibilidade e para a área administrativa;
- honeypot silencioso no formulário público;
- Cloudflare Turnstile validado novamente no backend quando o desafio está disponível;
- com as chaves do Turnstile configuradas, se o desafio não carregar por bloqueio de rede/navegador, existe um fallback de compatibilidade aceito apenas quando `Origin` corresponde à própria aplicação e `Sec-Fetch-Site` é `same-origin`;
- o fallback não substitui o Turnstile como prova de humanidade: ele depende das camadas restantes de antiabuso (rate limit por origem/telefone, honeypot e validações server-side) para priorizar compatibilidade em redes institucionais;
- a ausência das chaves do Turnstile continua fail-closed; o fallback existe apenas para indisponibilidade do desafio no navegador;
- tokens Turnstile presentes continuam sendo validados normalmente e uma validação explícita que falha não cai silenciosamente para o fallback;
- a resposta válida do Turnstile é vinculada ao hostname da requisição e à action `book_appointment`;
- limite real de 8 KiB para JSON aplicado durante a leitura incremental do stream, sem depender de `Content-Length`;
- mutações com `Origin` incompatível ou `Sec-Fetch-Site: cross-site` são rejeitadas.

Para usar o Turnstile como proteção principal, configure as duas variáveis abaixo no Worker:

```text
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

A chave pública é entregue ao frontend por `/security-config`; a chave secreta nunca é retornada ao navegador.

### Validação, concorrência e integridade

- regras de negócio revalidadas no backend;
- pré-atendimento validado novamente no backend, sem confiar no formulário do navegador;
- telefone obrigatório no novo fluxo e normalizado antes da persistência;
- motivo limitado a 5–300 caracteres, observações a 500 caracteres e enums fechados para tipo/duração;
- datas e horários interpretados em `America/Sao_Paulo`;
- Drizzle ORM nas consultas ao D1;
- índice único parcial impede dois agendamentos ativos do mesmo profissional/data/horário;
- outro índice único parcial impede o mesmo telefone de manter duas consultas ativas no mesmo horário, mesmo com profissionais diferentes;
- `CHECK` de horários e status no banco;
- triggers defensivas validam nome, telefone, profissional, ano e os campos de pré-atendimento também no D1;
- cancelamento lógico preserva histórico e libera o slot;
- estados concluído/cancelado não são reativados;
- horários passados e janela mínima de antecedência são rejeitados pelo servidor;
- remarcação, conclusão e cancelamento usam atualização condicional por estado para impedir lost updates em operações concorrentes;
- conflitos detectados pela constraint do banco são convertidos em resposta de conflito, sem expor parâmetros internos;
- alterações operacionais relevantes geram trilha de auditoria append-only, com proteção contra `UPDATE` e `DELETE` no próprio banco;
- a trilha mínima é gerada por trigger do D1, inclusive para alterações fora da rota normal; quando Cloudflare Access está habilitado, a identidade individual permanece disponível nos logs do Access e deve ser integrada à observabilidade/SIEM operacional.

### Navegador e transporte

O projeto envia, entre outros:

- `Content-Security-Policy`;
- `Strict-Transport-Security` (HSTS);
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `X-Permitted-Cross-Domain-Policies: none`;
- `Referrer-Policy: no-referrer`;
- `Cross-Origin-Opener-Policy`;
- `Cross-Origin-Resource-Policy`;
- `Origin-Agent-Cluster`;
- `Permissions-Policy` restritiva.

A CSP bloqueia objetos, frames externos não autorizados, handlers inline de script e restringe conexões/frames adicionais ao domínio necessário para o Turnstile. O projeto não usa `dangerouslySetInnerHTML` nem `eval`.

A diretiva `unsafe-inline` ainda é necessária em `script-src` para o bootstrap/hidratação do stack Next/Vinext atual. Isso é tratado como risco residual documentado; remover a diretiva sem suporte confiável a nonce/hash pode quebrar a aplicação e não é feito apenas para melhorar uma pontuação de auditoria.

## Dependências e supply chain

- dependências críticas são fixadas em versões explícitas;
- o CI executa lint, TypeScript, testes e build antes da auditoria de dependências;
- vulnerabilidades de severidade **moderada ou superior** bloqueiam o CI quando estão na árvore de dependências de produção;
- vulnerabilidades de severidade **alta ou crítica** bloqueiam o CI em toda a árvore, inclusive ferramentas de desenvolvimento;
- `pnpm-lock.yaml` é versionado e o CI usa instalação congelada;
- GitHub Actions usadas pelo pipeline são fixadas por SHA;
- CodeQL roda em push, pull request e agenda semanal com queries `security-extended`;
- atualizações automáticas de npm e GitHub Actions são acompanhadas pelo Dependabot.

Existe um advisory moderado conhecido (`GHSA-67mh-4wv8-2f99`) em uma versão antiga de `esbuild` trazida transitivamente por `drizzle-kit` via `@esbuild-kit/esm-loader`. O pacote afetado é uma ferramenta de desenvolvimento usada para geração de migrações e não integra o bundle implantado no Worker. O risco descrito pelo advisory depende do servidor de desenvolvimento do `esbuild`; esse caminho não é exposto pelo Garde Agenda. A exceção permanece documentada e deve ser removida assim que a cadeia upstream abandonar a dependência vulnerável. Essa justificativa não reduz o gate de dependências de produção nem o gate de severidade alta da árvore completa.

## Controles operacionais recomendados para uso clínico real

O código oferece as fundações técnicas, mas uma operação de saúde precisa também de controles fora do repositório. Antes de aceitar dados reais de pacientes:

1. habilitar Cloudflare Access para `/admin` com MFA obrigatório e grupos/allowlist por funcionário;
2. ativar proteção da branch `main`/ruleset exigindo CI e CodeQL antes de merge;
3. definir política formal de retenção e eliminação de PII, base legal LGPD e procedimento de atendimento aos direitos do titular;
4. integrar logs do Cloudflare Access/Workers a observabilidade/SIEM com alertas e retenção adequada;
5. documentar resposta a incidentes, rotação/revogação de credenciais e processo de offboarding;
6. manter backups, testes de restauração e revisão periódica das permissões;
7. realizar pentest externo antes de classificar o sistema como pronto para dados clínicos reais.

Esses itens não devem ser simulados em código quando dependem de governança, identidade corporativa ou operação humana. A documentação os mantém explícitos para não confundir um case tecnicamente endurecido com uma certificação de segurança ou conformidade.
