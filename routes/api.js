// routes/api.js
"use strict";

const router = require("express").Router();
const apiKeyAuth = require("../src/middlewares/apiKeyAuth");

const systemRoutes = require("./systemRoutes");
const searchRoutes = require("./searchRoutes");
const hotelRoutes = require("./hotelRoutes");
const bookingRoutes = require("./bookingRoutes");
const paymentRoutes = require("./paymentRoutes");
const contentRoutes = require("./contentRoutes");
const webhookRoutes = require("./webhookRoutes");
const systempayRoutes = require("./systempayRoutes.js");
const blogPublicRoutes = require("./blogPublicRoutes");
const cookieRoutes = require("./cookieRoutes");
const adminAuthRoutes = require("./adminAuthRoutes");
const adminBlogRoutes = require("./adminBlogRoutes");
const adminPanelRoutes = require("./adminPanelRoutes");
const chatbotRoutes = require("./chatbotRoutes");
const promoRoutes = require("./promoRoutes");
const contactRoutes = require("./contactRoutes");

// 1) Public/system routes
router.use(systemRoutes);

// 2) Webhooks MUST be public (no apiKeyAuth before them)
router.use(webhookRoutes);
router.use(cookieRoutes);

// 3) Public blog routes + admin auth/blog routes (token based, no X-API-Key)
router.use(blogPublicRoutes);
router.use(adminAuthRoutes);
router.use(adminBlogRoutes);
router.use(adminPanelRoutes);
router.use(chatbotRoutes);
router.use(promoRoutes);
router.use(contactRoutes);

// 4) Everything below here requires X-API-Key
router.use(apiKeyAuth);
router.use(searchRoutes);
router.use(hotelRoutes);
router.use(bookingRoutes);
router.use(paymentRoutes);
router.use(contentRoutes);
router.use(systempayRoutes);

module.exports = router;
