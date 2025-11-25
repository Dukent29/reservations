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

router.use(systemRoutes);
router.use(apiKeyAuth);
router.use(searchRoutes);
router.use(hotelRoutes);
router.use(bookingRoutes);
router.use(paymentRoutes);
router.use(contentRoutes);
router.use(webhookRoutes);
router.use(systempayRoutes);

module.exports = router;
