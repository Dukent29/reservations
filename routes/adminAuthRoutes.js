"use strict";

const router = require("express").Router();
const adminAuthController = require("../controllers/adminAuthController");
const { validate } = require("../src/middlewares/validateRequest");
const { authSchemas } = require("../src/middlewares/requestSchemas");
const { requireAdminAuth } = require("../src/middlewares/adminAuth");
const { adminLoginRateLimiter, suspiciousInputGuard } = require("../src/middlewares/security");

router.post(
  "/admin/auth/login",
  adminLoginRateLimiter,
  suspiciousInputGuard(["email", "password"]),
  validate(authSchemas.adminLogin),
  adminAuthController.login
);
router.get("/admin/auth/me", requireAdminAuth, adminAuthController.me);
router.post("/admin/auth/logout", requireAdminAuth, adminAuthController.logout);

module.exports = router;
