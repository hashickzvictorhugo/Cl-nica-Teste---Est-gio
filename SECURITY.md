# Segurança — Garde Agenda

Este projeto é um case técnico demonstrativo. Mesmo assim, as rotas que expõem dados pessoais ou alteram o histórico da clínica são protegidas no backend.

## Modelo de acesso

A área pública pode:

- consultar disponibilidade;
- buscar o próximo horário livre;
- criar um novo agendamento.

A área administrativa pode:

- listar nome e telefone dos pacientes;
- consultar o histórico completo;
- concluir consultas;
- cancelar consultas;
- remarcar consultas pela API.

Essas operações exigem um token administrativo enviado no header HTTP:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

O segredo nunca deve ser gravado no GitHub, no código-fonte ou em arquivos públicos.

## Configurando o segredo no Cloudflare Workers

Execute na pasta do projeto:

```bash
pnpm exec wrangler secret put ADMIN_TOKEN
```

No Windows/PowerShell:

```powershell
pnpm.cmd exec wrangler secret put ADMIN_TOKEN
```

O Wrangler solicitará o valor do segredo de forma interativa. Use uma credencial longa e aleatória.

Depois publique novamente:

```powershell
pnpm.cmd run deploy
```

## Painel administrativo

Após configurar o segredo, abra:

```text
/admin
```

A credencial digitada no painel é mantida apenas em `sessionStorage`, portanto fica limitada àquela aba/sessão do navegador. Ela não é salva no código-fonte.

## Proteções implementadas

- autenticação server-side para dados pessoais e ações administrativas;
- falha fechada quando `ADMIN_TOKEN` não está configurado;
- comparação da credencial por digest SHA-256 antes da comparação byte a byte;
- listagem pública de `/appointments` não retorna registros de pacientes;
- `PATCH` e `DELETE` de agendamentos exigem autenticação;
- limite básico de tamanho para payloads JSON de escrita;
- validação de regras de negócio no backend;
- queries construídas com Drizzle ORM;
- índice único no banco para impedir conflito ativo de profissional + data + horário;
- `Cache-Control: no-store` em respostas sensíveis;
- Content Security Policy (CSP);
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy` restritiva;
- `Permissions-Policy` bloqueando câmera, microfone, geolocalização, pagamento e USB;
- políticas cross-origin para reduzir isolamento indevido entre contextos.

## Limites deste case

Para uma clínica real com dados pessoais de pacientes, ainda seria recomendável adicionar autenticação por usuário individual, MFA, papéis/permissões, trilha de auditoria, política formal de retenção de dados, monitoramento de incidentes, rate limiting no edge e proteção anti-bot (por exemplo Cloudflare Turnstile/WAF).

O projeto demonstrativo não deve receber prontuário médico ou outros dados clínicos sensíveis.
