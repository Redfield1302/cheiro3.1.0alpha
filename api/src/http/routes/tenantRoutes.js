const express = require("express");
const { auth } = require("../middlewares/auth");

const router = express.Router();
const { prisma } = require("../../lib/prisma");

router.get("/me", auth, async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
  const rules = tenant.rulesJson || {};
  const checkout = rules.checkout || {};
  const branding = rules.branding || {};
  const home = rules.home || {};
  res.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    segment: tenant.segment,
    logoUrl: tenant.logoUrl,
    branding: {
      heroImageUrl: String(branding.heroImageUrl || ""),
      restaurantIconUrl: String(branding.restaurantIconUrl || "")
    },
    homeSettings: {
      deliveryEta: String(home.deliveryEta || ""),
      minimumOrder: Number(home.minimumOrder || 0),
      paymentMethods: Array.isArray(home.paymentMethods) ? home.paymentMethods : []
    },
    rulesJson: rules,
    checkoutSettings: {
      pixKey: checkout.pixKey || "",
      deliveryFee: Number(checkout.deliveryFee || 0),
      cardFeePercent: Number(checkout.cardFeePercent || 0)
    }
  });
});

router.patch("/me", auth, async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
  if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

  const { logoUrl, openingHours, checkoutSettings, branding, homeSettings } = req.body || {};
  const nextRules = { ...(tenant.rulesJson || {}) };
  if (openingHours !== undefined) nextRules.openingHours = openingHours;
  if (branding !== undefined) {
    const currentBranding = nextRules.branding || {};
    nextRules.branding = {
      ...currentBranding,
      heroImageUrl: String(branding?.heroImageUrl || "").trim(),
      restaurantIconUrl: String(branding?.restaurantIconUrl || "").trim()
    };
  }
  if (homeSettings !== undefined) {
    const currentHome = nextRules.home || {};
    nextRules.home = {
      ...currentHome,
      deliveryEta: String(homeSettings?.deliveryEta || "").trim(),
      minimumOrder: Number(homeSettings?.minimumOrder || 0),
      paymentMethods: Array.isArray(homeSettings?.paymentMethods)
        ? homeSettings.paymentMethods.map((m) => String(m)).filter(Boolean)
        : []
    };
  }
  if (checkoutSettings !== undefined) {
    const current = nextRules.checkout || {};
    nextRules.checkout = {
      ...current,
      pixKey: String(checkoutSettings?.pixKey || "").trim(),
      deliveryFee: Number(checkoutSettings?.deliveryFee || 0),
      cardFeePercent: Number(checkoutSettings?.cardFeePercent || 0)
    };
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      logoUrl: logoUrl !== undefined ? logoUrl : tenant.logoUrl,
      rulesJson: nextRules
    }
  });

  res.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    segment: updated.segment,
    logoUrl: updated.logoUrl,
    branding: {
      heroImageUrl: String(updated?.rulesJson?.branding?.heroImageUrl || ""),
      restaurantIconUrl: String(updated?.rulesJson?.branding?.restaurantIconUrl || "")
    },
    homeSettings: {
      deliveryEta: String(updated?.rulesJson?.home?.deliveryEta || ""),
      minimumOrder: Number(updated?.rulesJson?.home?.minimumOrder || 0),
      paymentMethods: Array.isArray(updated?.rulesJson?.home?.paymentMethods)
        ? updated.rulesJson.home.paymentMethods
        : []
    },
    rulesJson: updated.rulesJson || {},
    checkoutSettings: {
      pixKey: String(updated?.rulesJson?.checkout?.pixKey || ""),
      deliveryFee: Number(updated?.rulesJson?.checkout?.deliveryFee || 0),
      cardFeePercent: Number(updated?.rulesJson?.checkout?.cardFeePercent || 0)
    }
  });
});

module.exports = router;


