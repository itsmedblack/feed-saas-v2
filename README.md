# Feed SaaS V2 — deploy por painéis

Esta versão foi preparada para ser publicada sem terminal e sem configuração manual de bindings D1/KV.

## O que mudou na V2

- Cloudflare pode provisionar automaticamente o D1 (`DB`) durante o deploy.
- Cloudflare pode provisionar automaticamente o KV (`FEEDS`) durante o deploy.
- Não há IDs de D1/KV para preencher no projeto.
- As tabelas do banco são criadas automaticamente na primeira requisição ao Worker.
- O Cron de verificação horária já está declarado no projeto.
- O frontend não possui URL fixa do Worker.
- Na primeira abertura do frontend, basta colar a URL `workers.dev` fornecida pela Cloudflare e clicar em **Testar e conectar**.
- O frontend valida D1 + KV usando `/api/health` antes de liberar a interface.

---

# PARTE A — GitHub

1. Extraia o ZIP no computador.
2. Crie um repositório novo no GitHub, por exemplo `feed-saas-v2`.
3. Pode deixá-lo privado.
4. Dentro do repositório, use **Add file → Upload files**.
5. Envie o conteúdo extraído do projeto.
6. No GitHub devem aparecer as pastas `frontend`, `worker`, `database` e o arquivo `README.md`.

---

# PARTE B — Cloudflare Worker

1. Entre no painel da Cloudflare.
2. Abra **Workers & Pages**.
3. Clique em **Create** / **Create application**.
4. Escolha a opção de importar/conectar um repositório Git.
5. Conecte o GitHub e selecione o repositório `feed-saas-v2`.
6. Como o backend está na pasta `worker`, configure **Root directory** como `worker`.
7. Deixe a Cloudflare detectar o projeto.
8. Se a tela pedir explicitamente um comando de deploy, use o script de deploy detectado do projeto (`npm run deploy`). Normalmente a Cloudflare identifica isso automaticamente.
9. Publique o projeto.

Durante o deploy, a configuração `worker/wrangler.jsonc` declara:

- um banco D1 com binding `DB` sem ID;
- um KV com binding `FEEDS` sem ID;
- um Cron Trigger horário.

A Cloudflare deve criar e vincular os recursos automaticamente.

## Como conferir sem mexer em bindings

Depois do deploy:

1. Abra o Worker.
2. Copie a URL exibida, parecida com:
   `https://feed-saas-v2.seu-subdominio.workers.dev`
3. Abra essa URL no navegador.
4. Deve aparecer um JSON informando que a API está online.
5. Depois abra a mesma URL acrescentando `/api/health`.
6. O esperado é uma resposta contendo:
   - `ok: true`
   - `database: connected`
   - `storage: connected`

Se `/api/health` responder assim, não é necessário criar ou editar bindings manualmente.

---

# PARTE C — Netlify

A pasta `frontend` é um site estático e não precisa de build.

## Opção mais simples pelo painel

1. Entre na Netlify.
2. Vá em **Add new project**.
3. Escolha **Deploy manually**.
4. Arraste apenas a pasta `frontend`.
5. Aguarde a publicação.
6. Abra a URL `.netlify.app` criada.

Na primeira abertura aparecerá **Conectar backend**.

1. Cole a URL `workers.dev` que você copiou da Cloudflare.
2. Clique em **Testar e conectar**.
3. O sistema testa automaticamente D1 e KV.
4. Se tudo estiver correto, a tela de cadastro de lojas será liberada.
5. A URL fica armazenada no navegador; não é necessário editar arquivo.

---

# PRIMEIRO TESTE

1. Abra o site publicado na Netlify.
2. Conecte o backend.
3. Em **URL da loja**, informe um e-commerce.
4. Clique em **Analisar loja**.
5. Depois que a loja for criada, clique em **Atualizar agora**.
6. Ao concluir, o card exibirá a quantidade de produtos.
7. Clique no endereço XML ou em **Copiar XML**.

O feed público seguirá o formato:

`https://SEU-WORKER.workers.dev/feed/f_xxxxxxxxx.xml`

---

# NÃO FAZER NESTA VERSÃO

- Não criar D1 manualmente antes do deploy.
- Não criar KV manualmente antes do deploy.
- Não adicionar `DB` manualmente em Bindings.
- Não adicionar `FEEDS` manualmente em Bindings.
- Não executar SQL pelo Console do D1.
- Não editar a URL do Worker em arquivos do frontend.

Essas etapas foram removidas da V2 justamente para evitar conflito entre configurações do dashboard e configurações originadas do repositório Git.
