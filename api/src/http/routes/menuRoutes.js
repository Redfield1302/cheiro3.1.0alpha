const express = require("express");
const { PaymentStatus, PaymentMethod, OrderStatus } = require("@prisma/client");
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
  return res.status(500).json({ error: "Falha interna no menu" });
}

// GET /api/menu/:slug
router.get("/:slug", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });
    const rules = tenant.rulesJson || {};
    const checkout = rules.checkout || {};
    const branding = rules.branding || {};
    return res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        branding: {
          heroImageUrl: String(branding.heroImageUrl || ""),
          restaurantIconUrl: String(branding.restaurantIconUrl || "")
        },
        rulesJson: rules,
        checkoutSettings: {
          pixKey: String(checkout.pixKey || ""),
          deliveryFee: Number(checkout.deliveryFee || 0),
          cardFeePercent: Number(checkout.cardFeePercent || 0)
        }
      }
    });
  } catch (e) {
    return handleRouteError(res, "menu_tenant", e);
  }
});

// GET /api/menu/:slug/categories
router.get("/:slug/categories", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });

    const categories = await prisma.productCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sort: "asc" }, { name: "asc" }]
    });
    return res.json({ categories });
  } catch (e) {
    return handleRouteError(res, "menu_categories", e);
  }
});

// GET /api/menu/:slug/products?categoryId=
router.get("/:slug/products", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });

    const where = { tenantId: tenant.id, active: true };
    if (req.query.categoryId) where.categoryId = String(req.query.categoryId);

    const products = await prisma.product.findMany({
      where,
      include: {
        categoryRef: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return res.json({ products });
  } catch (e) {
    return handleRouteError(res, "menu_products", e);
  }
});

// GET /api/menu/:slug/products/:id
router.get("/:slug/products/:id", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: {
        categoryRef: true,
        modifierGroups: { include: { options: true }, orderBy: { sort: "asc" } },
        pizzaSizes: { where: { tenantId: tenant.id, active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] },
        pizzaFlavors: {
          where: { tenantId: tenant.id, active: true },
          orderBy: [{ sort: "asc" }, { name: "asc" }],
          include: { prices: { include: { size: true } } }
        }
      }
    });

    if (!product) return res.status(404).json({ error: "Produto nao encontrado" });
    return res.json({ product });
  } catch (e) {
    return handleRouteError(res, "menu_product", e);
  }
});

// POST /api/menu/:slug/orders
router.post("/:slug/orders", async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug } });
  if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado" });

  const {
    items = [],
    paymentMethod = "PIX",
    customerName,
    customerPhone,
    customerAddress,
    customerReference,
    mode,
    notes,
    deliveryFee = 0,
    cardFeeAmount = 0
  } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items invalido" });

  const method = Object.values(PaymentMethod).includes(paymentMethod) ? paymentMethod : PaymentMethod.PIX;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          source: mode ? String(mode).trim() : "MENU",
          status: OrderStatus.OPEN,
          subtotal: 0,
          total: 0
        }
      });

      for (const it of items) {
        await addItemToOrder(tx, {
          tenantId: tenant.id,
          orderId: order.id,
          itemInput: {
            productId: it.productId,
            quantity: it.quantity,
            pizza: it.pizza,
            notes: it.notes || null,
            modifiers: it.modifiers || []
          }
        });
      }

      const updated = await recalcOrderTotals(tx, order.id);

      let customerId = null;
      const phone = normalizePhoneForStorage(customerPhone);
      const name = String(customerName || "").trim() || "Nao informado";

      if (phone) {
        const customer = await tx.customer.upsert({
          where: { tenantId_phone: { tenantId: tenant.id, phone } },
          update: { name },
          create: { tenantId: tenant.id, name, phone }
        });
        customerId = customer.id;
      } else if (name && name !== "Nao informado") {
        const customer = await tx.customer.create({
          data: { tenantId: tenant.id, name, phone: null }
        });
        customerId = customer.id;
      }

      let addressId = null;
      const streetRaw = normalizeAddressForStorage(customerAddress);
      const referenceRaw = normalizeAddressForStorage(customerReference);
      if (streetRaw || referenceRaw) {
        const createdAddress = await tx.address.create({
          data: {
            tenantId: tenant.id,
            customerId,
            street: streetRaw || "Nao informado",
            city: "Nao informado",
            state: "NA",
            reference: referenceRaw || null
          }
        });
        addressId = createdAddress.id;
      }

      const deliveryFeeParsed = Number(deliveryFee);
      const cardFeeParsed = Number(cardFeeAmount);
      const deliveryFeeValue = Math.max(0, Number.isFinite(deliveryFeeParsed) ? deliveryFeeParsed : 0);
      const cardFeeValue = Math.max(0, Number.isFinite(cardFeeParsed) ? cardFeeParsed : 0);
      const finalTotal = Number(updated.total || 0) + deliveryFeeValue + cardFeeValue;

      const updatedWithCustomer = await tx.order.update({
        where: { id: updated.id },
        data: {
          customerId,
          addressId,
          deliveryFee: deliveryFeeValue,
          total: finalTotal
        }
      });

      const payment = await tx.payment.create({
        data: {
          orderId: updatedWithCustomer.id,
          method,
          amount: finalTotal,
          status: PaymentStatus.PAID
        }
      });

      if (String(notes || "").trim()) {
        await tx.orderEvent.create({
          data: {
            orderId: updatedWithCustomer.id,
            type: "CUSTOMER_NOTES",
            payload: { notes: String(notes).trim() }
          }
        });
      }

      const confirmed = await transitionOrderState(tx, {
        orderId: updatedWithCustomer.id,
        toStatus: OrderStatus.CONFIRMED,
        reason: "menu_checkout",
        extraPayload: { paymentMethod: method }
      });

      return { order: confirmed, payment };
    }, { timeout: 30000, maxWait: 10000 });

    notifyCustomerOrderStatus({ orderId: created.order.id }).catch((err) => {
      console.error("menu_checkout_whatsapp_notify_error", err?.message || err);
    });

    return res.status(201).json(created);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Falha ao criar pedido" });
  }
});

router.post("/payments/pix", async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "orderId obrigatorio" });

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) return res.status(404).json({ error: "Pagamento nao encontrado" });

    return res.json({ payment });
  } catch (e) {
    return handleRouteError(res, "menu_payment_pix", e);
  }
});

router.get("/payments/:id", async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: "Pagamento nao encontrado" });
    return res.json({ payment });
  } catch (e) {
    return handleRouteError(res, "menu_payment_get", e);
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { modifiers: true } }, payments: true }
    });
    if (!order) return res.status(404).json({ error: "Pedido nao encontrado" });
    return res.json({ order });
  } catch (e) {
    return handleRouteError(res, "menu_order_get", e);
  }
});

module.exports = router;


