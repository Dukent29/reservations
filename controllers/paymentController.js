"use strict";

const httpError = require("../src/utils/httpError");
const floaService = require("../src/lib/floaClient");
const payotaClient = require("../src/lib/payotaClient");
const db = require("../utils/db");
const { savePayment, parseAmount } = require("../utils/repo");

async function getBookingFormByPartnerOrderId(partnerOrderId) {
  const sql = `
    SELECT *
    FROM booking_forms
    WHERE partner_order_id = $1
    ORDER BY id DESC
    LIMIT 1
  `;
  const result = await db.query(sql, [partnerOrderId]);
  if (!result.rows.length) {
    throw httpError(404, "booking_form_not_found");
  }
  return result.rows[0];
}

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

async function createHotelDeal(req, res, next) {
  try {
    const { partner_order_id, productCode, customer, device = "Desktop" } = req.body || {};

    if (!partner_order_id) {
      throw httpError(400, "partner_order_id is required");
    }
    if (!productCode) {
      throw httpError(400, "productCode is required");
    }
    if (!customer) {
      throw httpError(400, "customer is required");
    }
    if (!customer.civility) {
      throw httpError(400, "customer.civility is required for Floa eligibility (e.g., 'Mr' or 'Mrs')");
    }

    // 1. Load ETG booking form row
    const bf = await getBookingFormByPartnerOrderId(partner_order_id);

    // Try a few places for the amount coming from the ETG booking form
    const paymentType = bf?.form && Array.isArray(bf.form.payment_types) && bf.form.payment_types.length > 0
      ? bf.form.payment_types[0]
      : null;

    const candidates = [];
    if (paymentType && paymentType.amount !== undefined) candidates.push(paymentType.amount);
    if (bf.amount !== undefined) candidates.push(bf.amount);
    // legacy or other fields sometimes used by ETG
    if (bf.form && bf.form.total_amount !== undefined) candidates.push(bf.form.total_amount);
    if (bf.form && bf.form.order_amount !== undefined) candidates.push(bf.form.order_amount);

    let amount = null;
    let usedSource = null;
    for (const c of candidates) {
      const parsed = parseAmount(c);
      if (Number.isFinite(parsed) && parsed > 0) {
        amount = parsed;
        usedSource = c;
        break;
      }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      // Try a fallback: some systems store amount as integer cents (e.g. 10000 meaning 100.00)
      const first = candidates.length ? candidates[0] : null;
      let fallbackAmount = null;
      if (first !== null && first !== undefined) {
        // numeric string like "10000"
        if (typeof first === "string" && /^\d+$/.test(first)) {
          const asInt = Number(first);
          if (Number.isFinite(asInt) && asInt > 0) fallbackAmount = asInt / 100;
        }
        // raw number like 10000
        if (typeof first === "number" && Number.isFinite(first) && Number.isInteger(first) && first > 100) {
          fallbackAmount = first / 100;
        }
      }

      if (fallbackAmount && Number.isFinite(fallbackAmount) && fallbackAmount > 0) {
        amount = fallbackAmount;
        console.warn("[HotelDeal] used cents-fallback for booking_form amount", { partner_order_id, fallbackAmount, original: first });
      } else {
        console.error("[HotelDeal] invalid booking_form amount", {
          partner_order_id,
          booking_form_row: bf,
          tried_candidates: candidates,
          parsedAmount: amount,
        });
        throw httpError(400, "invalid_amount_in_booking_form", { tried_candidates: candidates, booking_form: bf });
      }
    }
    const currency = bf.currency_code || "EUR";

    const merchantFinancedAmount = Math.round(amount * 100);

    const items = [
      {
        name: "Séjour hôtel",
        amount: amount,
        quantity: 1,
        reference: String(bf.item_id || bf.etg_order_id || partner_order_id),
        category: "Travel",
        subCategory: "Hotel",
        customCategory: "Hotel stay",
      },
    ];

    const itemCount = items.length;

    const safeCustomer = {
      civility: customer.civility,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      mobilePhoneNumber: customer.mobilePhoneNumber,
      homeAddress: customer.homeAddress || { countryCode: "FR" },
    };

    const shippingAddress = customer.homeAddress || { countryCode: "FR" };
    const country_code = shippingAddress.countryCode || "FR";

    // 2. Eligibility check for chosen productCode
    const eligibilityPayload = {
      customers: [safeCustomer],
      merchantFinancedAmount,
      itemCount,
      items,
      device,
      country_code,
      currency,
    };

    console.log(
      "[FLOA] eligibilityPayload",
      JSON.stringify(eligibilityPayload, null, 2)
    );

    let eligibility;
    try {
      eligibility = await floaService.checkProductEligibility(eligibilityPayload);
    } catch (err) {
      // Floa sometimes returns 400 with a body that still contains
      // productEligibilities (with per-product errors / constraints).
      // In that case we can still inspect the payload instead of failing hard.
      if (err?.http === 400 && err?.debug?.productEligibilities) {
        eligibility = err.debug;
      } else {
        throw err;
      }
    }
    const productEligibilities = eligibility.productEligibilities || [];

    const matching = productEligibilities.find(
      (p) =>
        p.productCode === productCode &&
        p.countryCode === country_code &&
        p.hasAgreement === true &&
        !p.errors
    );

    if (!matching) {
      return res.status(400).json({
        status: "nok",
        reason: "Not eligible for this product / country",
        floa: eligibility,
      });
    }

    const productEligibilityId = eligibility.id;

    // 3. Create Floa deal
    const deal = await floaService.createDeal({
      productCode,
      implementationType: "CustomerInformationForm",
      merchantReference: partner_order_id,
      merchantFinancedAmount,
      itemCount,
      items,
      customers: [safeCustomer],
      device,
      shippingMethod: "STD",
      shippingAddress,
      currency,
      productEligibilityId,
    });

    const dealReference = deal.dealReference || deal.reference || null;

    // 4. Persist payment row
    await savePayment({
      provider: "floa",
      status: "pending",
      partnerOrderId: partner_order_id,
      prebookToken: bf.prebook_token || null,
      etgOrderId: bf.etg_order_id || null,
      itemId: bf.item_id || null,
      amount,
      currencyCode: currency,
      externalReference: dealReference,
      payload: { deal, eligibility },
    });

    res.json({
      status: "ok",
      partner_order_id,
      deal,
    });
  } catch (error) {
    next(error);
  }
}

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
    let eligibility;
    try {
      eligibility = await floaService.checkProductEligibility(eligibilityPayload);
    } catch (err) {
      // Floa sometimes returns 400 with a body that still contains
      // productEligibilities (per-product errors / constraints).
      if (err?.http === 400 && err?.debug?.productEligibilities) {
        eligibility = err.debug;
      } else {
        throw err;
      }
    }

    console.log(
      "[FLOA] eligibilityResult",
      JSON.stringify(eligibility, null, 2)
    );

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
      console.warn(
        "[FLOA] product not eligible",
        JSON.stringify({ productCode, country_code, matching, productEligibilities }, null, 2)
      );
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
  createHotelDeal,
  finalizeDeal,
  getInstallment,
  cancelDeal,
  createCreditCardToken,
};
