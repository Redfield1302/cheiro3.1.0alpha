# Documentacao da API

Base URL (dev): `http://localhost:3000`

## Auth

- `POST /api/auth/login`
- `POST /api/auth/register`
  - cria tenant + usuario ADMIN
  - retorna `menuLinks` com link do cardapio contendo id do estabelecimento
- Header nas rotas protegidas:
  - `Authorization: Bearer <token>`

## Health

- `GET /health`

## Tenant

- `GET /api/tenant/me`
  - inclui `checkoutSettings`:
    - `pixKey`
    - `deliveryFee`
    - `cardFeePercent`
  - inclui `homeSettings`:
    - `deliveryEta`
    - `minimumOrder`
    - `paymentMethods`
- `PATCH /api/tenant/me`
  - atualiza dados do tenant, horarios, checkout settings e home settings do cardapio digital.

## Cardapio (publico)

- `GET /api/menu/:slug`
- `GET /api/menu/:slug/categories`
- `GET /api/menu/:slug/products`
- `GET /api/menu/:slug/products/:id`
- `POST /api/menu/:slug/orders`
  - suporta:
    - `items[]` com pizza/modifiers
    - `customerName`, `customerPhone`, `customerAddress`, `customerReference`
    - `paymentMethod`
    - `deliveryFee`, `cardFeeAmount`
- `GET /api/menu/orders/:id`

## PDV (protegido)

- `GET /api/pdv/products`
- `POST /api/pdv/cart`
- `GET /api/pdv/cart/:cartId`
- `POST /api/pdv/cart/:cartId/items`
- `DELETE /api/pdv/cart/:cartId/items/:itemId`
- `POST /api/pdv/checkout`
  - suporta:
    - dados do cliente
    - `deliveryFee`, `cardFeeAmount`
    - `mode`, `comanda`

## Produtos e ficha tecnica

- `GET/POST/PATCH /api/products`
- `GET/PUT /api/products/:id/pizza-config`
- `GET/PUT /api/products/:id/recipe`

## Estoque

- `GET /api/inventory/items`
- `POST /api/inventory/items`
- `POST /api/inventory/movements`
- `GET /api/inventory/items/:id/movements`

## Cozinha

- `GET /api/kitchen/orders`
- `PATCH /api/kitchen/orders/:id/status`

## Entregas (modulo separado)

- `POST /api/delivery/auth/login`
  - login exclusivo de entregador
  - suporta `tenantSlug` para resolver entregadores com mesmo email em tenants diferentes
- `GET /api/delivery/orders`
  - lista apenas pedidos `READY` (disponiveis) e `DISPATCHED` do proprio entregador
- `PATCH /api/delivery/orders/:id/claim`
  - assume pedido `READY` e muda para `DISPATCHED`
- `PATCH /api/delivery/orders/:id/status`
  - entregue/cancelado pelo entregador
- `POST /api/delivery/agents`
  - cria entregador para o tenant (ADMIN/MANAGER)
- `GET /api/delivery/agents`
  - lista motoboys do tenant
- `PATCH /api/delivery/agents/:id`
  - atualiza credenciais e dados do motoboy

## Pedidos e dashboard

- `GET /api/orders`
- `GET /api/orders/dashboard`

## Tratamento de erro

- Padrao de resposta:
  - `{ "error": "mensagem" }`
- Falha de banco (`P1001`) retorna `503` nas rotas principais.
