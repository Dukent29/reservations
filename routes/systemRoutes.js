"use strict";

const router = require("express").Router();
const systemController = require("../controllers/systemController");

router.get("/health", systemController.healthCheck);
router.get("/etg/overview", systemController.getOverview);
router.get("/config", systemController.getConfig);
router.get("/test-client", systemController.getTestClient);
router.get("/apilogs", systemController.getApiLogs);
router.get("/etg-orders", systemController.getEtgOrders);
router.get("/etg-order-info", systemController.getEtgOrderInfo);

module.exports = router;
