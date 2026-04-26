"use strict";

const router = require("express").Router();
const promoCodeController = require("../controllers/promoCodeController");
const { validate } = require("../src/middlewares/validateRequest");
const { promoSchemas } = require("../src/middlewares/requestSchemas");
const { requireAdminAuth, requireRoles } = require("../src/middlewares/adminAuth");

router.post("/promo/validate", validate(promoSchemas.validatePromo), promoCodeController.validatePromo);
router.post("/promo/clear", validate(promoSchemas.clearPromo), promoCodeController.clearPromo);

router.get(
  "/admin/promo-codes",
  requireAdminAuth,
  requireRoles("admin", "editor"),
  validate(promoSchemas.adminListPromoCodes),
  promoCodeController.listAdminPromoCodes,
);
router.post(
  "/admin/promo-codes",
  requireAdminAuth,
  requireRoles("admin", "editor"),
  validate(promoSchemas.adminCreatePromoCode),
  promoCodeController.createAdminPromoCode,
);
router.patch(
  "/admin/promo-codes/:id",
  requireAdminAuth,
  requireRoles("admin", "editor"),
  validate(promoSchemas.adminUpdatePromoCode),
  promoCodeController.updateAdminPromoCode,
);
router.delete(
  "/admin/promo-codes/:id",
  requireAdminAuth,
  requireRoles("admin", "editor"),
  validate(promoSchemas.adminPromoCodeId),
  promoCodeController.deleteAdminPromoCode,
);

module.exports = router;
