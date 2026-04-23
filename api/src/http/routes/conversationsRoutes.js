const express = require("express");
const { MessageSender } = require("@prisma/client");
const { auth } = require("../middlewares/auth");
const { sendWhatsAppText } = require("../../lib/whatsapp/botService");

const router = express.Router();
const { prisma } = require("../../lib/prisma");

// GET /api/conversations
router.get("/", auth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const conversations = await prisma.conversation.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { customer: true }
  });
  res.json(conversations);
});

// GET /api/conversations/:id
router.get("/:id", auth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const conv = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: "asc" } }, customer: true }
  });
  if (!conv || conv.tenantId !== tenantId) return res.status(404).json({ error: "Conversa não encontrada" });
  res.json(conv);
});

// POST /api/conversations/:id/messages
router.post("/:id/messages", auth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { content, sender = "HUMAN" } = req.body || {};
  if (!content) return res.status(400).json({ error: "content é obrigatório" });

  const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conv || conv.tenantId !== tenantId) return res.status(404).json({ error: "Conversa não encontrada" });

  const s = Object.values(MessageSender).includes(sender) ? sender : MessageSender.HUMAN;
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      sender: s,
      content
    }
  });

  if (s === MessageSender.HUMAN && conv.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: conv.customerId } });
    if (customer?.phone) {
      sendWhatsAppText({
        tenantId,
        phone: customer.phone,
        text: String(content),
        category: "HUMAN_REPLY",
        customerId: customer.id,
        requireConnected: true
      }).catch((err) => {
        console.error("conversation_human_whatsapp_error", err?.message || err);
      });
    }
  }

  res.status(201).json(msg);
});

module.exports = router;
