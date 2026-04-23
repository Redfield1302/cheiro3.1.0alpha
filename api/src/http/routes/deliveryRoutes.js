const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OrderStatus } = require("@prisma/client");
const { auth, authDelivery } = require("../middlewares/auth");
const { transitionOrderState } = require("../../core/orderStateMachine");
const { notifyCustomerOrderStatus } = require("../../lib/whatsapp/botService");

const router = express.Router();
const { prisma } = require("../../lib/prisma");

function deliveryPayload(deliveryPerson) {
  return {
    sub: deliveryPerson.id,
    tenantId: deliveryPerson.tenantId,
    actorType: "DELIVERY_PERSON",
    role: "DELIVERY",
    email: deliveryPerson.email
  };
}

router.post("/auth/login", async (req, res) => {
  const { email, password, tenantSlug } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e password sao obrigatorios" });

  const normalizedEmail = String(email).trim().toLowerCase();
  const where = {
    email: normalizedEmail,
    ...(tenantSlug ? { tenant: { slug: String(tenantSlug).trim().toLowerCase() } } : {})
  };

  const matches = await prisma.deliveryPerson.findMany({
    where,
    include: { tenant: true },
    take: 5
  });
  if (!matches.length) return res.status(401).json({ error: "Credenciais invalidas" });
  if (!tenantSlug && matches.length > 1) {
    return res.status(409).json({ error: "Informe o slug do tenant para este entregador" });
  }

  const deliveryPerson = matches[0];

  const ok = await bcrypt.compare(password, deliveryPerson.password);
  if (!ok) return res.status(401).json({ error: "Credenciais invalidas" });

  const token = jwt.sign(deliveryPayload(deliveryPerson), process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });

  return res.json({
    token,
    deliveryPerson: {
      id: deliveryPerson.id,
      name: deliveryPerson.name,
      email: deliveryPerson.email,
      phone: deliveryPerson.phone || null
    },
    tenant: {
      id: deliveryPerson.tenant.id,
      name: deliveryPerson.tenant.name,
      slug: deliveryPerson.tenant.slug
    }
  });
});

router.get("/orders", authDelivery, async (req, res) => {
  try {
    const tenantId = req.deliveryUser.tenantId;
    const deliveryPersonId = req.deliveryUser.sub;

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          { status: OrderStatus.READY },
          {
            status: OrderStatus.DISPATCHED,
            delivery: { deliveryPersonId }
          }
        ]
      },
      orderBy: [{ createdAt: "asc" }],
      include: {
        customer: true,
        address: true,
        payments: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        delivery: {
          include: { deliveryPerson: { select: { id: true, name: true } } }
        },
        items: {
          orderBy: { id: "asc" },
          include: { modifiers: { orderBy: { createdAt: "asc" } } }
        }
      },
      take: 120
    });

    return res.json(orders);
  } catch (e) {
    console.error("delivery_orders_error", e);
    if (e?.code === "P1001") return res.status(503).json({ error: "Banco indisponivel no momento. Tente novamente." });
    return res.status(500).json({ error: "Falha ao carregar pedidos de entrega" });
  }
});

router.patch("/orders/:id/claim", authDelivery, async (req, res) => {
  try {
    const tenantId = req.deliveryUser.tenantId;
    const deliveryPersonId = req.deliveryUser.sub;
    const orderId = req.params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true }
    });
    if (!order || order.tenantId !== tenantId) return res.status(404).json({ error: "Pedido nao encontrado" });
    if (order.status !== OrderStatus.READY) return res.status(400).json({ error: "Somente pedidos READY podem ser assumidos" });
    if (order.delivery?.deliveryPersonId && order.delivery.deliveryPersonId !== deliveryPersonId) {
      return res.status(409).json({ error: "Pedido ja assumido por outro entregador" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: { deliveryPersonId, status: "ASSIGNED" }
        });
      } else {
        await tx.delivery.create({
          data: { orderId, deliveryPersonId, status: "ASSIGNED" }
        });
      }
      return transitionOrderState(tx, {
        orderId,
        toStatus: OrderStatus.DISPATCHED,
        actorUserId: deliveryPersonId,
        reason: "delivery_claim"
      });
    });

    notifyCustomerOrderStatus({ orderId: updated.id }).catch((err) => {
      console.error("delivery_claim_whatsapp_notify_error", err?.message || err);
    });

    return res.json(updated);
  } catch (e) {
    console.error("delivery_claim_error", e);
    if (e.code === "INVALID_TRANSITION") return res.status(400).json({ error: e.message });
    return res.status(500).json({ error: "Falha ao assumir pedido" });
  }
});

router.patch("/orders/:id/status", authDelivery, async (req, res) => {
  try {
    const tenantId = req.deliveryUser.tenantId;
    const deliveryPersonId = req.deliveryUser.sub;
    const { toStatus } = req.body || {};
    if (!toStatus || ![OrderStatus.DELIVERED, OrderStatus.CANCELED].includes(toStatus)) {
      return res.status(400).json({ error: "toStatus invalido para entrega" });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { delivery: true }
    });
    if (!order || order.tenantId !== tenantId) return res.status(404).json({ error: "Pedido nao encontrado" });
    if (!order.delivery?.deliveryPersonId || order.delivery.deliveryPersonId !== deliveryPersonId) {
      return res.status(403).json({ error: "Pedido nao pertence a este entregador" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextDeliveryStatus = toStatus === OrderStatus.DELIVERED ? "DELIVERED" : "CANCELED";
      await tx.delivery.update({
        where: { id: order.delivery.id },
        data: { status: nextDeliveryStatus }
      });
      return transitionOrderState(tx, {
        orderId: order.id,
        toStatus,
        actorUserId: deliveryPersonId,
        reason: "delivery_status_update"
      });
    });

    notifyCustomerOrderStatus({ orderId: updated.id }).catch((err) => {
      console.error("delivery_status_whatsapp_notify_error", err?.message || err);
    });

    return res.json(updated);
  } catch (e) {
    console.error("delivery_status_error", e);
    if (e.code === "INVALID_TRANSITION") return res.status(400).json({ error: e.message });
    return res.status(500).json({ error: "Falha ao atualizar status da entrega" });
  }
});

router.post("/agents", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const role = String(req.user.role || "");
    if (!["ADMIN", "MANAGER"].includes(role)) return res.status(403).json({ error: "Sem permissao" });

    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "name, email e password sao obrigatorios" });
    if (String(password).length < 6) return res.status(400).json({ error: "password deve ter pelo menos 6 caracteres" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await prisma.deliveryPerson.findFirst({
      where: { tenantId, email: normalizedEmail }
    });
    if (exists) return res.status(409).json({ error: "Entregador ja cadastrado com este email" });

    const hash = await bcrypt.hash(String(password), 10);
    const created = await prisma.deliveryPerson.create({
      data: {
        tenantId,
        name: String(name).trim(),
        email: normalizedEmail,
        password: hash,
        phone: phone ? String(phone).trim() : null
      },
      select: { id: true, name: true, email: true, phone: true, createdAt: true }
    });

    return res.status(201).json(created);
  } catch (e) {
    console.error("delivery_agent_create_error", e);
    return res.status(500).json({ error: "Falha ao criar entregador" });
  }
});

router.get("/agents", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const role = String(req.user.role || "");
    if (!["ADMIN", "MANAGER"].includes(role)) return res.status(403).json({ error: "Sem permissao" });

    const rows = await prisma.deliveryPerson.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }],
      select: { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true }
    });

    return res.json(rows);
  } catch (e) {
    console.error("delivery_agents_list_error", e);
    return res.status(500).json({ error: "Falha ao listar entregadores" });
  }
});

router.patch("/agents/:id", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const role = String(req.user.role || "");
    if (!["ADMIN", "MANAGER"].includes(role)) return res.status(403).json({ error: "Sem permissao" });

    const current = await prisma.deliveryPerson.findFirst({
      where: { id: req.params.id, tenantId }
    });
    if (!current) return res.status(404).json({ error: "Entregador nao encontrado" });

    const { name, email, phone, password } = req.body || {};
    const nextEmail = email ? String(email).trim().toLowerCase() : current.email;
    if (email && nextEmail !== current.email) {
      const exists = await prisma.deliveryPerson.findFirst({
        where: { tenantId, email: nextEmail, NOT: { id: current.id } }
      });
      if (exists) return res.status(409).json({ error: "Ja existe entregador com este email" });
    }

    const data = {
      name: name ? String(name).trim() : current.name,
      email: nextEmail,
      phone: phone != null ? String(phone).trim() : current.phone
    };

    if (password != null && String(password).trim() !== "") {
      if (String(password).length < 6) return res.status(400).json({ error: "password deve ter pelo menos 6 caracteres" });
      data.password = await bcrypt.hash(String(password), 10);
    }

    const updated = await prisma.deliveryPerson.update({
      where: { id: current.id },
      data,
      select: { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true }
    });

    return res.json(updated);
  } catch (e) {
    console.error("delivery_agent_update_error", e);
    return res.status(500).json({ error: "Falha ao atualizar entregador" });
  }
});

module.exports = router;
