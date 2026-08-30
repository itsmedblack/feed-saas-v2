# Feed SaaS V3.3

Atualização direta da V3. Acrescenta navegação para Painel, edição/exclusão de lojas e opção por loja para incluir no XML apenas produtos disponíveis. O padrão é **somente produtos disponíveis**.

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


## V3.2 — Google Merchant enriquecido
- `g:brand` com a marca real do produto; opcionalmente usa uma marca padrão configurada pela loja quando o produto não informa marca.
- `g:custom_label_0` recebe o nome configurado da loja/origem para facilitar segmentação e filtros.
- `g:product_type` recebe a categoria original encontrada na loja.
- `g:google_product_category` pode ser configurado como categoria padrão da loja.
- `g:additional_image_link` é emitido quando houver imagens adicionais armazenadas.
- Não inventa marca automaticamente: o fallback só é utilizado quando configurado pelo usuário.


## V3.3 — filtro de categorias por loja

- Detecta categorias dos produtos durante a varredura e salva também um `category_slug`.
- Em **Gerenciar → Editar loja → Google Merchant**, exibe as categorias identificadas com quantidade total e quantidade disponível.
- Permite selecionar uma ou várias categorias para o XML.
- Se nenhuma categoria for marcada, o comportamento permanece compatível: todas as categorias entram no feed.
- Se houver categorias marcadas, somente produtos cujo `category_slug` esteja entre as selecionadas entram no XML.
- Compatível com slugs como `cafe-torrado`, útil para lojas como a Unique Cafés.
- Para instalações existentes, as novas colunas são criadas automaticamente pelo `ensureSchema`.
- Após atualizar para esta versão, execute **Atualizar agora** uma vez em cada loja para popular os slugs das categorias antigas.
- API: `0.3.3`.


## V3.4 — WooCommerce robusto

Correção para lojas WooCommerce que são detectadas corretamente mas não expõem produtos de forma compatível com o sitemap usado pelo crawler.

Nova prioridade para WooCommerce:
1. WooCommerce Store API pública `/wp-json/wc/store/v1/products`
2. Paginação automática de até 100 produtos por página
3. Até 3.000 produtos por varredura nesta versão
4. Captura de ID, SKU, título, descrição, preço, preço promocional, moeda, estoque, imagens, categoria e marca quando disponível
5. Sitemap + JSON-LD/HTML continuam como fallback
6. No histórico/método de descoberta, scans via API aparecem como `woocommerce-store-api`

A Store API não exige Consumer Key/Secret e é destinada a dados públicos do catálogo.
