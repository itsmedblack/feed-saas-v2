# Feed SaaS V3 — atualização direta

Esta versão foi criada para atualizar o projeto V2 já publicado, preservando o mesmo Worker, D1, KV e frontend Netlify.

## Novidades

- Tela de produtos por loja
- Busca por nome, SKU ou ID
- Filtros de estoque e problemas de catálogo
- Feed Health com score e diagnósticos
- Agendamento: manual, horário, diário, semanal, quinzenal e mensal
- Horário preferencial em horário de Brasília
- Histórico das últimas 20 varreduras
- Resumo de novos, atualizados e erros no card da loja
- Primeira varredura automática após cadastrar uma nova loja
- Proteção contra cadastro duplicado da mesma loja
- API v0.3.0

## Publicação sem código

### GitHub
Substitua os arquivos do repositório atual pelos arquivos desta V3. Não crie outro D1 nem outro KV.

### Cloudflare
O projeto continua com root directory `worker`. O Git integration fará um novo deploy e reutilizará os bindings `DB` e `FEEDS` existentes porque o nome do Worker continua `feed-saas-v2` no `wrangler.jsonc`.

Após o deploy, teste `/api/health`. O campo `version` deve retornar `0.3.0`.

### Netlify
Aponte para o mesmo repositório/pasta `frontend`. O deploy automático atualizará a interface. A URL do backend já salva no navegador continua válida.
