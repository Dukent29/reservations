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

// 1) Public/system routes
router.use(systemRoutes);

// 2) Webhooks MUST be public (no apiKeyAuth before them)
router.use(webhookRoutes);

// 3) Everything below here requires X-API-Key
router.use(apiKeyAuth);
router.use(searchRoutes);
router.use(hotelRoutes);
router.use(bookingRoutes);
router.use(paymentRoutes);
router.use(contentRoutes);
router.use(systempayRoutes);

module.exports = router;
