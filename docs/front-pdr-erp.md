# Front-PDR-ERP (Backoffice/PDV/Cozinha)

App: `front-pdr-erp`

## Rotas principais

- `/login`
- `/delivery/login`
- `/delivery/board`
- `/dashboard`
- `/pdv`
- `/cash`
- `/inventory`
- `/products`
- `/categories`
- `/orders`
- `/kitchen`
- `/conversations`
- `/settings/tenant`

## Funcionalidades recentes

- PDV com montagem de pizza, checkout, impressao e envio para cozinha.
- Faturamento com taxas de checkout:
  - taxa de entrega
  - taxa de cartao (credito/debito)
  - exibicao de chave PIX no modal.
- Cozinha com:
  - cards por status
  - detalhes (itens/modifiers/obs)
  - atalho WhatsApp e Google Maps
  - som e auto-impressao opcionais para novos pedidos.
- Configuracao do estabelecimento com:
  - logo (URL ou arquivo local)
  - chave PIX
  - taxa de entrega
  - taxa de cartao
  - credenciais do motoboy (criar/editar email e senha)
  - horarios de funcionamento.
- Produtos com upload de imagem local (alem de URL).
- Modulo de entregas separado:
  - login dedicado (entregador)
  - sem acesso ao PDV/ERP
  - kanban simples com colunas READY e DISPATCHED
  - acao de assumir entrega e marcar como entregue.

## Sessao

- LocalStorage: `cg_session_v3`
- Estrutura: token + user + tenant
- Entregas: `cg_delivery_session_v1`

## API principal usada

- Auth: `POST /api/auth/login`
- Tenant: `GET/PATCH /api/tenant/me`
- PDV: `/api/pdv/*`
- Cozinha: `/api/kitchen/*`
- Entregas: `/api/delivery/*`
- Produtos/Categorias: `/api/products/*`, `/api/categories/*`
- Estoque: `/api/inventory/*`
- Caixa: `/api/cash/*`
- Pedidos: `/api/orders/*`
- Atendimento: `/api/conversations/*`
