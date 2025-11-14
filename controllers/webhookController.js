"use strict";

function ratehawkWebhook(req, res) {
  console.log("[ETG Webhook]", req.body);
  res.status(200).send("OK");
}

function stripeWebhook(req, res) {
  console.log("[Stripe Webhook]", req.body);
  res.status(200).send("OK");
}

module.exports = {
  ratehawkWebhook,
  stripeWebhook,
};
