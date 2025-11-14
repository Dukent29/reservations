"use strict";

const router = require("express").Router();
const systemController = require("../controllers/systemController");

router.get("/health", systemController.healthCheck);
router.get("/etg/overview", systemController.getOverview);

module.exports = router;
