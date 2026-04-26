"use strict";

const router = require("express").Router();
const adminPanelController = require("../controllers/adminPanelController");
const { validate } = require("../src/middlewares/validateRequest");
const { authSchemas } = require("../src/middlewares/requestSchemas");
const { requireAdminAuth, requireRoles } = require("../src/middlewares/adminAuth");

router.use("/admin", requireAdminAuth, requireRoles("admin", "editor"));

router.get("/admin/overview", adminPanelController.getOverview);
router.get("/admin/notifications", adminPanelController.getNotifications);
router.patch("/admin/notifications/:id/read", adminPanelController.readNotification);
router.get(
  "/admin/payments",
  validate(authSchemas.adminListPayments),
  adminPanelController.getPayments
);
router.get(
  "/admin/users",
  validate(authSchemas.adminListUsers),
  adminPanelController.getUsers
);
router.patch(
  "/admin/users/:id/role",
  validate(authSchemas.adminUpdateUserRole),
  adminPanelController.changeUserRole
);
router.get(
  "/admin/reservations",
  validate(authSchemas.adminListReservations),
  adminPanelController.getReservations
);
router.get(
  "/admin/reservations/:partnerOrderId/voucher",
  validate(authSchemas.adminDownloadVoucher),
  adminPanelController.downloadReservationVoucher
);

module.exports = router;
