const express = require("express");
const { OrderStatus, PaymentMethod, PaymentStatus } = require("@prisma/client");
const { auth } = require("../middlewares/auth");
const { transitionOrderState } = require("../../core/orderStateMachine");
const { addItemToOrder, recalcOrderTotals } = require("../../core/orderBuilder");
const { normalizePhoneForStorage, normalizeAddressForStorage } = require("../../core/contactUtils");
const { notifyCustomerOrderStatus } = require("../../lib/whatsapp/botService");

const router = express.Router();
const { prisma } = require("../../lib/prisma");
function handleRouteError(res, scope, e) {
  console.error(`${scope}_error`, e);
  if (e?.code === "P1001") {
    return res.status(503).json({ error: "Banco indisponivel no momento. Tente novamente." });
  }
  return res.status(500).json({ error: "Falha interna no PDV" });
}

router.get("/products", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const products = await prisma.product.findMany({
      where: { tenantId, active: true },
      include: { categoryRef: true },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }]
    });
    console.log(req.user);
    return res.json(products);
  } catch (e) {
    return handleRouteError(res, "pdv_products", e);
  }
});

router.post("/cart", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const order = await prisma.order.create({
      data: { tenantId, source: "PDV", status: OrderStatus.OPEN, total: 0, subtotal: 0 }
    });
    return res.json({ cartId: order.id });
  } catch (e) {
    return handleRouteError(res, "pdv_create_cart", e);
  }
});

router.get("/cart/:cartId", auth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.cartId },
      include: { items: { include: { modifiers: true } } }
    });
    if (!order) return res.status(404).json({ error: "Carrinho nao encontrado" });
    return res.json(order);
  } catch (e) {
    return handleRouteError(res, "pdv_get_cart", e);
  }
});

router.post("/cart/:cartId/items", auth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { productId, quantity = 1, pizza = null } = req.body || {};
  if (!productId) return res.status(400).json({ error: "productId obrigatorio" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: req.params.cartId } });
      if (!order || order.tenantId !== tenantId) return { error: "Carrinho invalido", status: 404 };
      if (order.status !== OrderStatus.OPEN) return { error: "Carrinho nao esta OPEN", status: 400 };

      const item = await addItemToOrder(tx, {
        tenantId,
        orderId: req.params.cartId,
        itemInput: {
          productId,
          quantity,
          pizza
        }
      });

      const updatedOrder = await recalcOrderTotals(tx, req.params.cartId);

      return { itemId: item.id, subtotal: updatedOrder.subtotal };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Falha ao adicionar item" });
  }
});

router.delete("/cart/:cartId/items/:itemId", auth, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderItemModifier.deleteMany({ where: { orderItemId: req.params.itemId } });
      await tx.orderItem.delete({ where: { id: req.params.itemId } });
      await recalcOrderTotals(tx, req.params.cartId);
    });

    const order = await prisma.order.findUnique({ where: { id: req.params.cartId } });

    return res.json({ ok: true, subtotal: order?.subtotal || 0 });
  } catch (e) {
    return handleRouteError(res, "pdv_delete_item", e);
  }
});

router.post("/checkout", auth, async (req, res) => {
  const {
    cartId,
    paymentMethod = "PIX",
    customerName,
    customerPhone,
    customerAddress,
    customerReference,
    comanda,
    mode,
    deliveryFee = 0,
    cardFeeAmount = 0
  } = req.body || {};
  if (!cartId) return res.status(400).json({ error: "cartId obrigatorio" });
  if (!Object.values(PaymentMethod).includes(paymentMethod)) return res.status(400).json({ error: "paymentMethod invalido" });

  const tenantId = req.user.tenantId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: cartId }, include: { items: true } });
      if (!order || order.tenantId !== tenantId) return { error: "Pedido invalido", status: 404 };
      if (order.status !== OrderStatus.OPEN) {
        if (order.status === OrderStatus.CONFIRMED) return { updated: order, idempotent: true };
        return { error: "Pedido nao esta OPEN", status: 400 };
      }

      const deliveryFeeValue = Number.isFinite(Number(deliveryFee)) ? Number(deliveryFee) : 0;
      const cardFeeValue = Number.isFinite(Number(cardFeeAmount)) ? Number(cardFeeAmount) : 0;
      const subtotalValue = Number(order.subtotal || 0);
      const finalTotal = subtotalValue + Math.max(0, deliveryFeeValue) + Math.max(0, cardFeeValue);

      let customerId = null;
      const phone = normalizePhoneForStorage(customerPhone);
      const name = String(customerName || "").trim() || "Nao informado";

      if (phone) {
        const customer = await tx.customer.upsert({
          where: { tenantId_phone: { tenantId, phone } },
          update: { name },
          create: { tenantId, name, phone }
        });
        customerId = customer.id;
      } else if (name && name !== "Nao informado") {
        const customer = await tx.customer.create({
          data: { tenantId, name, phone: null }
        });
        customerId = customer.id;
      }

      let addressId = null;
      const streetRaw = normalizeAddressForStorage(customerAddress);
      const referenceRaw = normalizeAddressForStorage(customerReference);
      if (streetRaw || referenceRaw) {
        const createdAddress = await tx.address.create({
          data: {
            tenantId,
            customerId,
            street: streetRaw || "Nao informado",
            city: "Nao informado",
            state: "NA",
            reference: referenceRaw || null
          }
        });
        addressId = createdAddress.id;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          customerId,
          addressId,
          displayId: comanda ? String(comanda).trim() : order.displayId,
          source: mode ? String(mode).trim() : order.source,
          deliveryFee: Math.max(0, deliveryFeeValue),
          total: finalTotal
        }
      });

      const paidAlready = await tx.payment.findFirst({
        where: { orderId: order.id, status: PaymentStatus.PAID }
      });
      if (!paidAlready) {
        await tx.payment.create({
          data: { orderId: order.id, method: paymentMethod, amount: finalTotal, status: PaymentStatus.PAID }
        });
      }

      let updated;
      try {
        updated = await transitionOrderState(tx, {
          orderId: order.id,
          toStatus: OrderStatus.CONFIRMED,
          actorUserId: req.user.sub,
          extraPayload: { paymentMethod }
        });
      } catch (err) {
        if (err?.code === "INVALID_TRANSITION") {
          const current = await tx.order.findUnique({ where: { id: order.id } });
          if (current?.status === OrderStatus.CONFIRMED) return { updated: current, idempotent: true };
        }
        throw err;
      }

      return { updated };
    }, { timeout: 20000, maxWait: 10000 });

    if (result.error) return res.status(result.status).json({ error: result.error });

    notifyCustomerOrderStatus({ orderId: result.updated.id }).catch((err) => {
      console.error("pdv_checkout_whatsapp_notify_error", err?.message || err);
    });

    return res.json(result.updated);
  } catch (e) {
    console.error("checkout_error", e);
    return res.status(500).json({ error: e?.message || "Falha ao finalizar checkout" });
  }
});

module.exports = router;

