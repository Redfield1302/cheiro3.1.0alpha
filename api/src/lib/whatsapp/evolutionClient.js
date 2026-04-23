function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function buildHeaders(instance) {
  const headers = {
    "Content-Type": "application/json"
  };

  const apiKey = String(instance?.apiKey || "").trim();
  if (apiKey) {
    headers.apikey = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function interpolatePath(template, instanceName) {
  return String(template || "")
    .replaceAll("{instanceName}", instanceName)
    .replaceAll(":instanceName", instanceName);
}

async function requestEvolution(instance, { method = "GET", path = "/", body = null }) {
  const baseUrl = normalizeBaseUrl(instance?.apiBaseUrl);
  if (!baseUrl) {
    const err = new Error("apiBaseUrl da instancia WhatsApp nao configurada");
    err.code = "WA_CONFIG_ERROR";
    throw err;
  }

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const opts = {
    method,
    headers: buildHeaders(instance)
  };

  if (body != null) opts.body = JSON.stringify(body);

  const response = await fetch(url, opts);
  const contentType = String(response.headers.get("content-type") || "");
  const isJson = contentType.includes("application/json");
  const parsed = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => "");

  if (!response.ok) {
    const raw = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    const err = new Error(`Evolution API ${response.status}: ${raw}`);
    err.code = "WA_PROVIDER_ERROR";
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }

  return parsed;
}

async function tryRequestPaths(instance, { method, paths, bodyFactory }) {
  let lastError = null;

  for (const path of paths) {
    try {
      const payload = typeof bodyFactory === "function" ? bodyFactory(path) : null;
      const result = await requestEvolution(instance, { method, path, body: payload });
      return { path, result };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Falha na chamada da Evolution API");
}

async function createOrConnectInstance(instance, { webhookUrl }) {
  const instanceName = instance.instanceName;
  const createTemplate = process.env.EVOLUTION_CREATE_PATH || "/instance/create";
  const connectTemplate = process.env.EVOLUTION_CONNECT_PATH || "/instance/connect/{instanceName}";

  await tryRequestPaths(instance, {
    method: "POST",
    paths: [
      interpolatePath(createTemplate, instanceName),
      "/instance/create",
      "/instance/init"
    ],
    bodyFactory: () => ({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: webhookUrl
        ? {
            url: webhookUrl,
            byEvents: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
          }
        : undefined
    })
  }).catch(() => null);

  return tryRequestPaths(instance, {
    method: "GET",
    paths: [
      interpolatePath(connectTemplate, instanceName),
      `/instance/connect/${instanceName}`,
      `/instance/qrcode/${instanceName}`
    ]
  });
}

async function disconnectInstance(instance) {
  const instanceName = instance.instanceName;
  const disconnectTemplate = process.env.EVOLUTION_DISCONNECT_PATH || "/instance/logout/{instanceName}";

  return tryRequestPaths(instance, {
    method: "DELETE",
    paths: [
      interpolatePath(disconnectTemplate, instanceName),
      `/instance/logout/${instanceName}`,
      `/instance/disconnect/${instanceName}`
    ]
  });
}

function normalizePhoneForProvider(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits;
}

async function sendTextMessage(instance, { phone, text }) {
  const instanceName = instance.instanceName;
  const sendTemplate = process.env.EVOLUTION_SEND_TEXT_PATH || "/message/sendText/{instanceName}";
  const number = normalizePhoneForProvider(phone);
  if (!number) throw new Error("Telefone invalido para envio WhatsApp");

  return tryRequestPaths(instance, {
    method: "POST",
    paths: [
      interpolatePath(sendTemplate, instanceName),
      `/message/sendText/${instanceName}`,
      `/message/text/${instanceName}`
    ],
    bodyFactory: () => ({
      number,
      text: String(text || "")
    })
  });
}

module.exports = {
  createOrConnectInstance,
  disconnectInstance,
  sendTextMessage
};
