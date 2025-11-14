"use strict";

const router = require("express").Router();
const webhookController = require("../controllers/webhookController");

router.post("/webhook/ratehawk", webhookController.ratehawkWebhook);
router.post("/webhook/stripe", webhookController.stripeWebhook);

module.exports = router;
