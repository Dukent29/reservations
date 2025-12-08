"use strict";

const router = require("express").Router();
const webhookController = require("../controllers/webhookController");
const express = require("express");

router.post("/webhook/ratehawk", webhookController.ratehawkWebhook);
router.post("/webhook/stripe", webhookController.stripeWebhook);

// Systempay IPN uses x-www-form-urlencoded
router.post(
  "/webhook/systempay",
  express.urlencoded({ extended: false }),
  webhookController.systempayWebhook
);

// Floa notification webhook (JSON)
router.post("/webhook/floa", webhookController.floaWebhook);

module.exports = router;
