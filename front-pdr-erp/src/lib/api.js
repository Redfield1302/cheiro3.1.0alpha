import { token, clearSession } from "./session";

async function req(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (options.body && !headers.get("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearSession();
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

export const login = (email, password) =>
  req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const register = (body) =>
  req("/api/auth/register", { method: "POST", body: JSON.stringify(body) });

export const getTenantMe = () => req("/api/tenant/me");
export const updateTenantMe = (body) => req("/api/tenant/me", { method: "PATCH", body: JSON.stringify(body) });

export const listInventory = () => req("/api/inventory/items");
export const createInventory = (body) => req("/api/inventory/items", { method: "POST", body: JSON.stringify(body) });
export const createInventoryMovement = (body) => req("/api/inventory/movements", { method: "POST", body: JSON.stringify(body) });
export const listInventoryMovements = (id) => req(`/api/inventory/items/${id}/movements`);

export const listPdvProducts = () => req("/api/pdv/products");
export const createCart = () => req("/api/pdv/cart", { method: "POST" });
export const getCart = (cartId) => req(`/api/pdv/cart/${cartId}`);
export const addItem = (cartId, productId, quantity = 1, pizza = null) =>
  req(`/api/pdv/cart/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify({ productId, quantity, ...(pizza ? { pizza } : {}) })
  });
export const removeItem = (cartId, itemId) => req(`/api/pdv/cart/${cartId}/items/${itemId}`, { method: "DELETE" });
export const checkout = (cartId, paymentMethod, extra = {}) =>
  req("/api/pdv/checkout", { method: "POST", body: JSON.stringify({ cartId, paymentMethod, ...extra }) });

export const cashStatus = () => req("/api/cash/status");
export const cashOpen = (openingAmount) => req("/api/cash/open", { method: "POST", body: JSON.stringify({ openingAmount }) });
export const cashClose = (closingAmount) => req("/api/cash/close", { method: "POST", body: JSON.stringify({ closingAmount }) });
export const createCashMovement = (body) => req("/api/cash/movements", { method: "POST", body: JSON.stringify(body) });
export const listCashMovements = () => req("/api/cash/movements");

export const listCategories = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const data = await req(`/api/categories${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : [];
};
export const createCategory = (body) => req("/api/categories", { method: "POST", body: JSON.stringify(body) });
export const updateCategory = (id, body) => req(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const listProducts = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const data = await req(`/api/products${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : [];
};
export const createProduct = (body) => req("/api/products", { method: "POST", body: JSON.stringify(body) });
export const updateProduct = (id, body) => req(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getPizzaConfig = (id) => req(`/api/products/${id}/pizza-config`);
export const savePizzaConfig = (id, body) => req(`/api/products/${id}/pizza-config`, { method: "PUT", body: JSON.stringify(body) });
export const getProductRecipe = (id) => req(`/api/products/${id}/recipe`);
export const saveProductRecipe = (id, body) => req(`/api/products/${id}/recipe`, { method: "PUT", body: JSON.stringify(body) });

export const listConversations = () => req("/api/conversations");
export const getConversation = (id) => req(`/api/conversations/${id}`);
export const sendConversationMessage = (id, body) => req(`/api/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(body) });

export const listOrdersSimple = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req(`/api/orders${qs ? `?${qs}` : ""}`);
};
export const getOrdersDashboard = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req(`/api/orders/dashboard${qs ? `?${qs}` : ""}`);
};

export const listKitchenOrders = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req(`/api/kitchen/orders${qs ? `?${qs}` : ""}`);
};

export const updateKitchenOrderStatus = (id, toStatus, reason = "kitchen_ui") =>
  req(`/api/kitchen/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ toStatus, reason })
  });

async function reqDelivery(path, tokenValue, options = {}) {
  const headers = new Headers(options.headers || {});
  if (tokenValue) headers.set("Authorization", `Bearer ${tokenValue}`);
  if (options.body && !headers.get("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

export const deliveryLogin = (email, password, tenantSlug = "") =>
  reqDelivery("/api/delivery/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ email, password, tenantSlug })
  });

export const listDeliveryOrders = (tokenValue) =>
  reqDelivery("/api/delivery/orders", tokenValue);

export const claimDeliveryOrder = (tokenValue, orderId) =>
  reqDelivery(`/api/delivery/orders/${orderId}/claim`, tokenValue, { method: "PATCH" });

export const updateDeliveryOrderStatus = (tokenValue, orderId, toStatus) =>
  reqDelivery(`/api/delivery/orders/${orderId}/status`, tokenValue, {
    method: "PATCH",
    body: JSON.stringify({ toStatus })
  });

export const listDeliveryAgents = () => req("/api/delivery/agents");
export const createDeliveryAgent = (body) =>
  req("/api/delivery/agents", { method: "POST", body: JSON.stringify(body) });
export const updateDeliveryAgent = (id, body) =>
  req(`/api/delivery/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const getWhatsappSession = () => req("/api/whatsapp/session");
export const getWhatsappQr = () => req("/api/whatsapp/session/qr");
export const saveWhatsappSessionConfig = (body) =>
  req("/api/whatsapp/session/config", { method: "POST", body: JSON.stringify(body) });
export const connectWhatsappSession = () => req("/api/whatsapp/session/connect", { method: "POST" });
export const disconnectWhatsappSession = () => req("/api/whatsapp/session/disconnect", { method: "POST" });
export const sendWhatsappTest = (body) =>
  req("/api/whatsapp/notify/test", { method: "POST", body: JSON.stringify(body) });
