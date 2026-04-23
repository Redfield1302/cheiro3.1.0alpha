const express = require("express");
const { WhatsAppSessionStatus } = require("@prisma/client");
const { auth } = require("../middlewares/auth");
const { prisma } = require("../../lib/prisma");
const { createOrConnectInstance, disconnectInstance } = require("../../lib/whatsapp/evolutionClient");
const {
  extractInstanceName,
  extractQrCode,
  processWebhookPayload,
  sendWhatsAppText
} = require("../../lib/whatsapp/botService");

const router = express.Router();

function hasWhatsAppPrismaDelegates() {
  return Boolean(
    prisma?.whatsAppInstance &&
    prisma?.whatsAppWebhookEvent &&
    prisma?.whatsAppOutboundLog
  );
}

router.use((req, res, next) => {
  if (!hasWhatsAppPrismaDelegates()) {
    return res.status(503).json({
      error: "Prisma Client desatualizado para modulo WhatsApp. Execute: prisma generate (e migrate deploy/dev)."
    });
  }
  return next();
});

function canManageWhatsApp(user) {
  const role = String(user?.role || "").toUpperCase();
  return ["ADMIN", "MANAGER"].includes(role);
}

function sanitizeInstanceName(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function buildWebhookUrl(tenantId) {
  const base = String(process.env.WHATSAPP_WEBHOOK_BASE_URL || process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/api/whatsapp/webhook/${tenantId}`;
}

router.get("/session", auth, async (req, res) => {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { tenantId: req.user.tenantId },
    select: {
      id: true,
      provider: true,
      instanceName: true,
      apiBaseUrl: true,
      status: true,
      phoneNumber: true,
      connectedAt: true,
      disconnectedAt: true,
      lastError: true,
      botEnabled: true,
      notificationsEnabled: true,
      updatedAt: true
    }
  });

  return res.json(instance || null);
});

router.get("/session/qr", auth, async (req, res) => {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { tenantId: req.user.tenantId },
    select: { status: true, qrCodeBase64: true, updatedAt: true }
  });

  if (!instance) return res.status(404).json({ error: "Instancia WhatsApp nao configurada" });
  return res.json(instance);
});

router.post("/session/config", auth, async (req, res) => {
  if (!canManageWhatsApp(req.user)) return res.status(403).json({ error: "Sem permissao" });

  const {
    apiBaseUrl,
    apiKey,
    instanceName,
    webhookSecret,
    botEnabled,
    notificationsEnabled
  } = req.body || {};

  if (!apiBaseUrl || !apiKey) {
    return res.status(400).json({ error: "apiBaseUrl e apiKey sao obrigatorios" });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });

  const defaultName = sanitizeInstanceName(`tenant-${tenant.slug || tenant.id.slice(0, 8)}`);
  const finalInstanceName = sanitizeInstanceName(instanceName || defaultName);
  if (!finalInstanceName) return res.status(400).json({ error: "instanceName invalido" });

  const saved = await prisma.whatsAppInstance.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      provider: "EVOLUTION_API",
      instanceName: finalInstanceName,
      apiBaseUrl: String(apiBaseUrl).trim(),
      apiKey: String(apiKey).trim(),
      webhookSecret: webhookSecret ? String(webhookSecret).trim() : null,
      botEnabled: botEnabled !== undefined ? Boolean(botEnabled) : true,
      notificationsEnabled: notificationsEnabled !== undefined ? Boolean(notificationsEnabled) : true,
      status: WhatsAppSessionStatus.DISCONNECTED
    },
    update: {
      instanceName: finalInstanceName,
      apiBaseUrl: String(apiBaseUrl).trim(),
      apiKey: String(apiKey).trim(),
      webhookSecret: webhookSecret !== undefined ? (webhookSecret ? String(webhookSecret).trim() : null) : undefined,
      botEnabled: botEnabled !== undefined ? Boolean(botEnabled) : undefined,
      notificationsEnabled: notificationsEnabled !== undefined ? Boolean(notificationsEnabled) : undefined
    }
  });

  return res.json({
    id: saved.id,
    provider: saved.provider,
    instanceName: saved.instanceName,
    apiBaseUrl: saved.apiBaseUrl,
    status: saved.status,
    botEnabled: saved.botEnabled,
    notificationsEnabled: saved.notificationsEnabled,
    updatedAt: saved.updatedAt
  });
});

router.post("/session/connect", auth, async (req, res) => {
  if (!canManageWhatsApp(req.user)) return res.status(403).json({ error: "Sem permissao" });

  const instance = await prisma.whatsAppInstance.findUnique({ where: { tenantId: req.user.tenantId } });
  if (!instance) return res.status(404).json({ error: "Configure a instancia WhatsApp antes de conectar" });

  await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: { status: WhatsAppSessionStatus.CONNECTING, lastError: null }
  });

  try {
    const webhookUrl = buildWebhookUrl(req.user.tenantId);
    const { result } = await createOrConnectInstance(instance, { webhookUrl });
    const qr = extractQrCode(result);

    const next = await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        status: qr ? WhatsAppSessionStatus.QR_REQUIRED : WhatsAppSessionStatus.CONNECTING,
        qrCodeBase64: qr ? String(qr) : instance.qrCodeBase64,
        lastError: null
      },
      select: {
        status: true,
        qrCodeBase64: true,
        updatedAt: true
      }
    });

    return res.json(next);
  } catch (error) {
    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        status: WhatsAppSessionStatus.ERROR,
        lastError: String(error?.message || "Falha ao conectar instancia")
      }
    });

    return res.status(502).json({ error: error?.message || "Falha ao conectar na Evolution API" });
  }
});

router.post("/session/disconnect", auth, async (req, res) => {
  if (!canManageWhatsApp(req.user)) return res.status(403).json({ error: "Sem permissao" });

  const instance = await prisma.whatsAppInstance.findUnique({ where: { tenantId: req.user.tenantId } });
  if (!instance) return res.status(404).json({ error: "Instancia WhatsApp nao configurada" });

  try {
    await disconnectInstance(instance);
  } catch (_error) {
    // segue fluxo para garantir estado local consistente
  }

  const updated = await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: {
      status: WhatsAppSessionStatus.DISCONNECTED,
      qrCodeBase64: null,
      disconnectedAt: new Date()
    },
    select: { status: true, disconnectedAt: true, updatedAt: true }
  });

  return res.json(updated);
});

router.post("/notify/test", auth, async (req, res) => {
  if (!canManageWhatsApp(req.user)) return res.status(403).json({ error: "Sem permissao" });

  const { phone, text } = req.body || {};
  if (!phone || !text) return res.status(400).json({ error: "phone e text sao obrigatorios" });

  const sent = await sendWhatsAppText({
    tenantId: req.user.tenantId,
    phone,
    text,
    category: "TEST",
    requireConnected: true
  });

  if (!sent.ok) return res.status(400).json(sent);
  return res.json(sent);
});

async function resolveWebhookTenantId(req) {
  if (req.params.tenantId) return req.params.tenantId;

  const instanceName = extractInstanceName(req.body);
  if (!instanceName) return null;

  const instance = await prisma.whatsAppInstance.findUnique({ where: { instanceName: String(instanceName) } });
  return instance?.tenantId || null;
}

router.post(["/webhook", "/webhook/:tenantId"], async (req, res) => {
  try {
    const tenantId = await resolveWebhookTenantId(req);
    if (!tenantId) return res.status(404).json({ error: "Tenant da instancia WhatsApp nao identificado" });

    const instance = await prisma.whatsAppInstance.findUnique({ where: { tenantId } });
    if (!instance) return res.status(404).json({ error: "Instancia WhatsApp nao configurada" });

    if (instance.webhookSecret) {
      const provided =
        req.headers["x-webhook-secret"] ||
        req.query.secret ||
        req.body?.secret ||
        null;

      if (String(provided || "") !== String(instance.webhookSecret)) {
        return res.status(401).json({ error: "Webhook secret invalido" });
      }
    }

    const result = await processWebhookPayload({
      tenantId,
      payload: req.body || {}
    });

    return res.json({ ok: true, result });
  } catch (error) {
    console.error("whatsapp_webhook_error", error);
    return res.status(500).json({ error: "Falha ao processar webhook WhatsApp" });
  }
});

module.exports = router;
