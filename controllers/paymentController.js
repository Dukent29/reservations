"use strict";

const httpError = require("../src/utils/httpError");
const floaService = require("../src/lib/floaClient");
const payotaClient = require("../src/lib/payotaClient");

async function simulatePlan(req, res, next) {
  try {
    const payload = req.body || {};
    const plan = await floaService.simulatePlan(payload);
    res.json({ status: "ok", plan });
  } catch (error) {
    next(error);
  }
}

// controllers/paymentController.js

async function createDeal(req, res, next) {
  try {
    const payload = req.body || {};

    // --- Normalize customer: support `customer` or `customers[0]` ---
    let customer = payload.customer;
    if (!customer && Array.isArray(payload.customers) && payload.customers.length > 0) {
      customer = payload.customers[0];
    }
    if (!customer) {
      throw httpError(400, "customer is required");
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw httpError(400, "items array is required");
    }

    const items = payload.items;
    const merchantFinancedAmount = payload.merchantFinancedAmount;
    const itemCount =
      typeof payload.itemCount === "number" && Number.isFinite(payload.itemCount)
        ? payload.itemCount
        : items.length;

    const country_code = payload.shippingAddress?.countryCode || "FR";

    // --- 1. Build the eligibility payload ---
    const eligibilityPayload = {
      customers: [customer],
      merchantFinancedAmount,
      itemCount,
      items,
      device: payload.device || "Desktop",
      country_code,
      currency: payload.currency || "EUR",
    };

    // --- 2. Call product eligibilities ---
    const eligibility = await floaService.checkProductEligibility(eligibilityPayload);

    const productEligibilities = eligibility.productEligibilities || [];

    // Find a matching product in the list
    const matching = productEligibilities.find(
      (p) =>
        p.productCode === payload.productCode &&
        p.countryCode === country_code &&
        p.hasAgreement === true &&
        !p.errors
    );

    if (!matching) {
      // Floa answered, but this specific productCode/country is not offered
      return res.status(400).json({
        status: "nok",
        reason: "Not eligible for this product / country",
        floa: eligibility,
      });
    }

    // ✔ The ID to use is the ROOT `id`, not matching.id
    const productEligibilityId = eligibility.id;

    // --- 3. Create deal with eligibility id ---
    const deal = await floaService.createDeal({
      ...payload,
      productEligibilityId,
    });

    res.json({ status: "ok", deal });
  } catch (error) {
    next(error);
  }
}

// controllers/paymentController.js

async function finalizeDeal(req, res, next) {
  try {
    const { dealReference } = req.params;
    if (!dealReference) {
      throw httpError(400, "dealReference is required");
    }

    const payload = req.body || {};

    const result = await floaService.finalizeDeal(dealReference, payload);

    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
}


async function getInstallment(req, res, next) {
  try {
    const { dealReference } = req.params;
    if (!dealReference) {
      throw httpError(400, "dealReference is required");
    }
    const plan = await floaService.retrieveDeal(dealReference);
    res.json({ status: "ok", plan });
  } catch (error) {
    next(error);
  }
}
  

async function cancelDeal(req, res, next) {
  try {
    const { dealReference } = req.params;
    if (!dealReference) {
      throw httpError(400, "dealReference is required");
    }
    const cancellation = await floaService.cancelDeal(dealReference, req.body || {});
    res.json({ status: "ok", cancellation });
  } catch (error) {
    next(error);
  }
}

async function createCreditCardToken(req, res, next) {
  try {
    const payload = req.body || {};

    const requiredFields = [
      "object_id",
      "pay_uuid",
      "init_uuid",
      "user_first_name",
      "user_last_name",
      "credit_card_data_core",
      "is_cvc_required",
    ];

    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null) {
        throw httpError(400, `Missing required field: ${field}`);
      }
    }

    const result = await payotaClient.createCreditCardToken(payload);

    res.json({
      status: "ok",
      payota: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  simulatePlan,
  createDeal,
  finalizeDeal,
  getInstallment,
  cancelDeal,
   createCreditCardToken,
};
