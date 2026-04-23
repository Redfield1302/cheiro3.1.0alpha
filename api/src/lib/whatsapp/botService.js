const { MessageSender, WhatsAppSessionStatus, OrderStatus } = require("@prisma/client");
const { prisma } = require("../prisma");
const { normalizePhoneForStorage } = require("../../core/contactUtils");
const { sendTextMessage } = require("./evolutionClient");

function normalizeInboundPhone(raw) {
  const cleaned = String(raw || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/\D/g, "");
  return normalizePhoneForStorage(cleaned);
}

function extractEvent(payload) {
  return String(payload?.event || payload?.type || payload?.eventType || "").trim();
}

function extractInstanceName(payload) {
  return (
    payload?.instance ||
    payload?.instanceName ||
    payload?.sender ||
    payload?.data?.instance ||
    payload?.data?.instanceName ||
    null
  );
}

function extractConnectionStatus(payload) {
  const value =
    payload?.data?.state ||
    payload?.data?.status ||
    payload?.status ||
    payload?.connection ||
    payload?.data?.connection ||
    null;

  const normalized = String(value || "").toLowerCase();
  if (!normalized) return null;
  if (["open", "connected", "online"].includes(normalized)) return WhatsAppSessionStatus.CONNECTED;
  if (["connecting", "pairing", "loading"].includes(normalized)) return WhatsAppSessionStatus.CONNECTING;
  if (["close", "closed", "disconnected", "offline"].includes(normalized)) return WhatsAppSessionStatus.DISCONNECTED;
  if (["qrcode", "qr", "scan_qr", "scanqr"].includes(normalized)) return WhatsAppSessionStatus.QR_REQUIRED;
  return null;
}

function extractQrCode(payload) {
  return (
    payload?.qrcode ||
    payload?.qr ||
    payload?.base64 ||
    payload?.data?.qrcode ||
    payload?.data?.qr ||
    payload?.data?.base64 ||
    null
  );
}

function extractIncomingMessages(payload) {
  const possible = [];
  if (Array.isArray(payload?.data?.messages)) possible.push(...payload.data.messages);
  if (Array.isArray(payload?.messages)) possible.push(...payload.messages);
  if (payload?.data?.message) possible.push(payload.data.message);
  if (payload?.message) possible.push(payload.message);

  const out = [];
  for (const msg of possible) {
    const fromMe = Boolean(msg?.key?.fromMe ?? msg?.fromMe);
    if (fromMe) continue;

    const rawPhone = msg?.key?.remoteJid || msg?.from || msg?.sender || msg?.participant || null;
    const fromPhone = normalizeInboundPhone(rawPhone);
    if (!fromPhone) continue;

    const text =
      msg?.message?.conversation ||
      msg?.message?.extendedTextMessage?.text ||
      msg?.message?.imageMessage?.caption ||
      msg?.text ||
      msg?.body ||
      "";

    const content = String(text || "").trim();
    if (!content) continue;

    const externalMessageId = String(msg?.key?.id || msg?.id || "").trim() || null;
    out.push({ fromPhone, content, externalMessageId, raw: msg });
  }

  return out;
}

async function getOrCreateConversation({ tenantId, fromPhone }) {
  const defaultName = `Cliente WhatsApp ${fromPhone.slice(-4)}`;

  const customer = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId, phone: fromPhone } },
    update: {},
    create: {
      tenantId,
      name: defaultName,
      phone: fromPhone
    }
  });

  const existing = await prisma.conversation.findFirst({
    where: { tenantId, customerId: customer.id },
    orderBy: { createdAt: "desc" }
  });

  if (existing) return { customer, conversation: existing };

  const conversation = await prisma.conversation.create({
    data: { tenantId, customerId: customer.id }
  });
  return { customer, conversation };
}

function menuMessage(menuUrl) {
  const urlLine = menuUrl ? `\nCardapio: ${menuUrl}` : "";
  return [
    "Ola! Sou o assistente da loja.",
    "Responda com uma opcao:",
    "1 - Ver cardapio",
    "2 - Consultar status do pedido",
    "3 - Falar com atendente",
    urlLine
  ]
    .join("\n")
    .trim();
}

function mapOrderStatusLabel(status) {
  const map = {
    [OrderStatus.OPEN]: "Aberto",
    [OrderStatus.CONFIRMED]: "Confirmado",
    [OrderStatus.PREPARING]: "Em preparo",
    [OrderStatus.READY]: "Pronto",
    [OrderStatus.DISPATCHED]: "Saiu para entrega",
    [OrderStatus.DELIVERED]: "Entregue",
    [OrderStatus.CANCELED]: "Cancelado"
  };
  return map[status] || status;
}

async function resolveBotReply({ tenant, text }) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  const menuUrl = process.env.MENU_BASE_URL ? `${String(process.env.MENU_BASE_URL).replace(/\/$/, "")}/t/${tenant.slug}` : "";

  if (!input) return null;

  if (["1", "menu", "cardapio", "catálogo", "catalogo", "oi", "ola", "olá"].includes(lower)) {
    return menuMessage(menuUrl);
  }

  if (["3", "humano", "atendente", "suporte"].includes(lower)) {
    return "Perfeito. Encaminhei seu atendimento para nossa equipe humana.";
  }

  if (lower.startsWith("2") || lower.startsWith("status")) {
    const code = (input.match(/(?:status\s*)?([a-z0-9-]{4,})/i) || [])[1] || "";
    if (!code) {
      return "Para consultar, envie: status CODIGO_DO_PEDIDO (ex.: status 1234).";
    }

    const order = await prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { displayId: code },
          { id: { startsWith: code.toLowerCase() } },
          { id: { startsWith: code } }
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    if (!order) return "Nao encontrei pedido com esse codigo. Confira e tente novamente.";

    const display = order.displayId || order.id.slice(0, 8);
    return `Pedido ${display}: ${mapOrderStatusLabel(order.status)}.`;
  }

  return menuMessage(menuUrl);
}

function extractProviderMessageId(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    payload?.key?.id ||
    payload?.messageId ||
    payload?.id ||
    payload?.data?.key?.id ||
    payload?.data?.messageId ||
    null
  );
}

async function sendWhatsAppText({
  tenantId,
  phone,
  text,
  category = "GENERAL",
  orderId = null,
  customerId = null,
  requireConnected = true,
  requireBotEnabled = false,
  requireNotificationsEnabled = false
}) {
  const toPhone = normalizePhoneForStorage(phone);
  if (!toPhone) return { ok: false, reason: "INVALID_PHONE" };

  const instance = await prisma.whatsAppInstance.findUnique({ where: { tenantId } });
  if (!instance) return { ok: false, reason: "INSTANCE_NOT_CONFIGURED" };
  if (requireConnected && instance.status !== WhatsAppSessionStatus.CONNECTED) return { ok: false, reason: "INSTANCE_NOT_CONNECTED" };
  if (requireBotEnabled && !instance.botEnabled) return { ok: false, reason: "BOT_DISABLED" };
  if (requireNotificationsEnabled && !instance.notificationsEnabled) return { ok: false, reason: "NOTIFICATIONS_DISABLED" };

  const log = await prisma.whatsAppOutboundLog.create({
    data: {
      tenantId,
      instanceId: instance.id,
      orderId,
      customerId,
      toPhone,
      message: text,
      category,
      status: "PENDING"
    }
  });

  try {
    const sent = await sendTextMessage(instance, { phone: toPhone, text });
    const providerMessageId = extractProviderMessageId(sent?.result || sent);

    await prisma.whatsAppOutboundLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        providerMessageId: providerMessageId || null,
        payload: sent
      }
    });

    return { ok: true, logId: log.id };
  } catch (error) {
    await prisma.whatsAppOutboundLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        error: String(error?.message || "Falha ao enviar mensagem"),
        payload: error?.payload || null
      }
    });

    return { ok: false, reason: "SEND_FAILED", error: error?.message || "Falha no envio" };
  }
}

async function handleIncomingMessages({ tenantId, payload }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, reason: "TENANT_NOT_FOUND" };

  const incoming = extractIncomingMessages(payload);
  if (!incoming.length) return { ok: true, consumed: 0 };

  let consumed = 0;

  for (const msg of incoming) {
    if (msg.externalMessageId) {
      const exists = await prisma.whatsAppWebhookEvent.findUnique({
        where: {
          tenantId_externalMessageId: {
            tenantId,
            externalMessageId: msg.externalMessageId
          }
        }
      });
      if (exists) continue;
    }

    const { customer, conversation } = await getOrCreateConversation({
      tenantId,
      fromPhone: msg.fromPhone
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: MessageSender.CUSTOMER,
        content: msg.content,
        meta: {
          channel: "WHATSAPP",
          fromPhone: msg.fromPhone,
          externalMessageId: msg.externalMessageId
        }
      }
    });

    await prisma.whatsAppWebhookEvent.create({
      data: {
        tenantId,
        eventType: extractEvent(payload) || "MESSAGE",
        externalMessageId: msg.externalMessageId,
        fromPhone: msg.fromPhone,
        payload: msg.raw
      }
    }).catch(() => null);

    const botReply = await resolveBotReply({ tenant, text: msg.content });
    if (botReply) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: MessageSender.BOT,
          content: botReply,
          meta: {
            channel: "WHATSAPP",
            toPhone: msg.fromPhone
          }
        }
      });

      await sendWhatsAppText({
        tenantId,
        phone: msg.fromPhone,
        text: botReply,
        category: "BOT_REPLY",
        customerId: customer.id,
        requireConnected: true,
        requireBotEnabled: true
      });
    }

    consumed += 1;
  }

  return { ok: true, consumed };
}

async function processWebhookPayload({ tenantId, payload }) {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { tenantId } });
  if (!instance) return { ok: false, reason: "INSTANCE_NOT_CONFIGURED" };

  const event = extractEvent(payload);
  const connectionStatus = extractConnectionStatus(payload);
  const qrCode = extractQrCode(payload);

  if (connectionStatus || qrCode) {
    const data = {
      updatedAt: new Date()
    };
    if (connectionStatus) {
      data.status = connectionStatus;
      if (connectionStatus === WhatsAppSessionStatus.CONNECTED) {
        data.connectedAt = new Date();
        data.disconnectedAt = null;
        data.lastError = null;
        data.qrCodeBase64 = null;
      }
      if (connectionStatus === WhatsAppSessionStatus.DISCONNECTED) {
        data.disconnectedAt = new Date();
      }
      if (connectionStatus === WhatsAppSessionStatus.ERROR) {
        data.lastError = String(payload?.data?.error || payload?.error || "Erro de conexao");
      }
    }
    if (qrCode) {
      data.qrCodeBase64 = String(qrCode);
      if (!data.status) data.status = WhatsAppSessionStatus.QR_REQUIRED;
    }

    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data
    });
  }

  const handled = await handleIncomingMessages({ tenantId, payload });
  return { ok: true, event, ...handled };
}

function buildOrderStatusMessage(order) {
  const code = order.displayId || order.id.slice(0, 8);
  const statusLabel = mapOrderStatusLabel(order.status);
  return `Atualizacao do pedido ${code}: ${statusLabel}.`;
}

async function notifyCustomerOrderStatus({ orderId }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      tenant: true
    }
  });

  if (!order || !order.customer?.phone) return { ok: false, reason: "NO_CUSTOMER_PHONE" };

  const text = buildOrderStatusMessage(order);
  return sendWhatsAppText({
    tenantId: order.tenantId,
    phone: order.customer.phone,
    text,
    category: "ORDER_STATUS",
    orderId: order.id,
    customerId: order.customerId,
    requireConnected: true,
    requireNotificationsEnabled: true
  });
}

module.exports = {
  extractInstanceName,
  extractQrCode,
  processWebhookPayload,
  notifyCustomerOrderStatus,
  sendWhatsAppText
};
