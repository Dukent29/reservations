"use strict";

const https = require("https");
const axios = require("axios");
const httpError = require("../src/utils/httpError");
const floaService = require("../src/lib/floaClient");
const payotaClient = require("../src/lib/payotaClient");
const db = require("../utils/db");
const { savePayment, parseAmount, getPrebookSummary, insertApiLog } = require("../utils/repo");
const paypalClient = require("../src/lib/paypalClient");

const MARKUP_PERCENT = 10;
const KOTAN_EXTERN_PAYMENT_URL = process.env.KOTAN_EXTERN_PAYMENT_URL || "https://kotan-voyages.com/externPayment";
const KOTAN_EXTERN_INFO_URL = process.env.KOTAN_EXTERN_INFO_URL || "https://kotan-voyages.com/externInfo";
const KOTAN_EXTERN_ACCEPT_SELF_SIGNED =
  String(process.env.KOTAN_EXTERN_ACCEPT_SELF_SIGNED || "").toLowerCase() === "true";

function applyMarkupAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return amount;
  return Math.round(num * (1 + MARKUP_PERCENT / 100) * 100) / 100;
}

async function getBookingFormByPartnerOrderId(partnerOrderId) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_forms (
      id BIGSERIAL PRIMARY KEY,
      partner_order_id TEXT,
      prebook_token TEXT,
      etg_order_id BIGINT,
      item_id BIGINT,
      amount NUMERIC,
      currency_code TEXT,
      form JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
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

function civilityToKotan(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "mr";
  if (["mrs", "mme", "madame", "female", "woman"].includes(normalized)) return "mme";
  return "mr";
}

function normalizeCivilityForFloa(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Mr";
  if (["mr", "m", "monsieur", "male", "man"].includes(normalized)) return "Mr";
  if (["mrs", "mme", "madame", "ms", "mlle", "mademoiselle", "female", "woman", "miss"].includes(normalized)) {
    return "Mrs";
  }
  return "Mr";
}

function normalizeCountry(value, fallback = "FR") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return fallback;
  return normalized.slice(0, 2);
}

function toIsoDateOnly(value, fallback = "") {
  if (!value) return fallback;
  const direct = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const ts = Date.parse(direct);
  if (!Number.isFinite(ts)) return fallback;
  return new Date(ts).toISOString().slice(0, 10);
}

function computeNights(checkin, checkout) {
  const ci = Date.parse(checkin);
  const co = Date.parse(checkout);
  if (!Number.isFinite(ci) || !Number.isFinite(co) || co <= ci) return 1;
  const msPerNight = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((co - ci) / msPerNight));
}

function findHotelFromPrebookSummary(prebookSummary) {
  const summary = prebookSummary?.summary || prebookSummary || {};
  const payload = prebookSummary?.payload || {};
  const payloadHotels =
    payload?.data?.hotels ||
    payload?.hotels ||
    payload?.prebook_token?.hotels ||
    [];
  const payloadHotel = Array.isArray(payloadHotels) && payloadHotels.length ? payloadHotels[0] : {};

  const hotelName =
    summary?.hotel?.name ||
    payloadHotel?.name ||
    payloadHotel?.hotel_name ||
    null;
  const stars = Number(
    payloadHotel?.stars ??
    payloadHotel?.category ??
    payloadHotel?.rg_ext?.class
  );

  return {
    name: hotelName || "Hotel",
    address:
      summary?.hotel?.address ||
      payloadHotel?.address ||
      payloadHotel?.legal_info?.hotel?.address ||
      "",
    city:
      summary?.hotel?.city ||
      payloadHotel?.city ||
      payloadHotel?.city_name ||
      payloadHotel?.legal_info?.hotel?.city ||
      "",
    zipcode: payloadHotel?.postal_code || "",
    country: normalizeCountry(summary?.hotel?.country || payloadHotel?.country || payloadHotel?.country_name || "FR"),
    stars: Number.isFinite(stars) && stars > 0 ? stars : null,
    checkIn: summary?.stay?.checkin || "",
    checkOut: summary?.stay?.checkout || "",
    rooms: Array.isArray(summary?.stay?.guests) ? summary.stay.guests.length : 1,
  };
}

function buildPassengersFromSummary(summary, customer) {
  const guests = Array.isArray(summary?.stay?.guests) ? summary.stay.guests : [];
  const adults = guests.reduce((acc, room) => acc + (Number(room?.adults) || 0), 0);
  const children = guests.reduce((acc, room) => {
    if (Array.isArray(room?.children)) return acc + room.children.length;
    const count = Number(room?.children);
    return acc + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);

  const base = {
    address: customer.addressLine1 || "",
    cp: customer.postalCode || "",
    city: customer.city || "",
    phone: customer.phone || "",
    bonusProgramNumber: "",
  };

  const rows = [];
  const defaultAdultCount = Math.max(1, adults || 1);
  for (let i = 0; i < defaultAdultCount; i += 1) {
    rows.push({
      type: "adult",
      civilite: civilityToKotan(customer.civility),
      fname: i === 0 ? customer.firstName : `Adult${i + 1}`,
      lname: customer.lastName || "",
      birthdate: toIsoDateOnly(customer.birthdate, ""),
      ...base,
    });
  }
  for (let i = 0; i < children; i += 1) {
    rows.push({
      type: "child",
      civilite: "mr",
      fname: `Child${i + 1}`,
      lname: customer.lastName || "",
      birthdate: "",
      ...base,
    });
  }
  return rows;
}

function enforceMarkupFloor(candidateAmount, baseSupplierAmount) {
  const candidate = Number(candidateAmount);
  if (!Number.isFinite(candidate) || candidate <= 0) return null;
  const base = Number(baseSupplierAmount);
  if (!Number.isFinite(base) || base <= 0) return candidate;
  const expected = applyMarkupAmount(base);
  if (!Number.isFinite(expected) || expected <= 0) return candidate;
  // If a candidate is lower than expected markup (with tiny tolerance), force expected.
  return candidate < expected * 0.99 ? expected : candidate;
}

function deriveTotalAmount({ prebookSummary, bookingFormRow }) {
  const baseSupplierAmount =
    parseAmount(bookingFormRow?.form?.payment_types?.[0]?.amount) ||
    parseAmount(bookingFormRow?.amount) ||
    parseAmount(bookingFormRow?.form?.total_amount) ||
    parseAmount(bookingFormRow?.form?.order_amount) ||
    null;

  const summaryRoomPrice = parseAmount(
    prebookSummary?.summary?.room?.price ??
    prebookSummary?.room?.price
  );
  const pricingTotal = parseAmount(bookingFormRow?.form?.pricing?.total_amount);

  const summaryResolved = enforceMarkupFloor(summaryRoomPrice, baseSupplierAmount);
  if (Number.isFinite(summaryResolved) && summaryResolved > 0) return summaryResolved;

  const pricingResolved = enforceMarkupFloor(pricingTotal, baseSupplierAmount);
  if (Number.isFinite(pricingResolved) && pricingResolved > 0) return pricingResolved;

  if (Number.isFinite(baseSupplierAmount) && baseSupplierAmount > 0) {
    return applyMarkupAmount(baseSupplierAmount);
  }

  return null;
}

function isAcceptedFlag(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(normalized);
}

function getRequestIp(req) {
  const xForwardedFor = String(req.headers?.["x-forwarded-for"] || "").trim();
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = String(req.headers?.["x-real-ip"] || "").trim();
  if (realIp) return realIp;
  return String(req.ip || req.socket?.remoteAddress || "").trim() || null;
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
    const prebookSummary = bf.prebook_token ? await getPrebookSummary(bf.prebook_token) : null;
    const summaryAmount = Number(prebookSummary?.summary?.room?.price ?? prebookSummary?.room?.price);
    const formPricingAmount = Number(bf?.form?.pricing?.total_amount);
    const resolvedAmount =
      Number.isFinite(summaryAmount) && summaryAmount > 0
        ? summaryAmount
        : Number.isFinite(formPricingAmount) && formPricingAmount > 0
          ? formPricingAmount
          : applyMarkupAmount(amount);
    const currency = bf.currency_code || "EUR";

    const resolvedAmountCents = Math.round(resolvedAmount * 100);
    const merchantFinancedAmount = resolvedAmountCents;

    const items = [
      {
        name: "Séjour hôtel",
        amount: resolvedAmountCents,
        quantity: 1,
        reference: String(bf.item_id || bf.etg_order_id || partner_order_id),
        category: "Travel",
        subCategory: "Hotel",
        customCategory: "Hotel stay",
      },
    ];

    const itemCount = items.length;

    const safeCustomer = {
      civility: normalizeCivilityForFloa(customer.civility),
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      mobilePhoneNumber: customer.mobilePhoneNumber,
      homeAddress: customer.homeAddress || { countryCode: "FR" },
    };

    const shippingAddress = customer.homeAddress || { countryCode: "FR" };
    const country_code = shippingAddress.countryCode || "FR";

    // Use a unique merchantReference for each Floa deal to avoid
    // "merchantReference has already been used" errors when a user
    // retries payment for the same partner_order_id.
    const merchantReference = `${partner_order_id}-${Date.now().toString(36)}`;

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
      merchantReference,
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
      amount: resolvedAmount,
      currencyCode: currency,
      externalReference: dealReference,
      payload: { deal, eligibility, customer: safeCustomer },
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
    const safeCustomer = {
      ...customer,
      civility: normalizeCivilityForFloa(customer.civility),
    };

    const eligibilityPayload = {
      customers: [safeCustomer],
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
      customers: [safeCustomer],
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

async function createKotanExternPayment(req, res, next) {
  try {
    const {
      partner_order_id,
      customer,
      passengers,
      services,
      checkoutData,
      productType,
      payment_variant,
      conditions_acceptance,
    } = req.body || {};
    if (!partner_order_id) throw httpError(400, "partner_order_id is required");
    if (!customer) throw httpError(400, "customer is required");
    if (!isAcceptedFlag(conditions_acceptance?.accepted)) {
      throw httpError(400, "conditions_acceptance_required");
    }

    const conditionsAcceptanceProof = {
      accepted_at_server: new Date().toISOString(),
      ip: getRequestIp(req),
      user_agent: String(req.headers?.["user-agent"] || "").trim() || null,
      conditions_version: String(conditions_acceptance?.conditions_version || "booking_conditions_v1").trim(),
      accepted_at_client:
        typeof conditions_acceptance?.accepted_at_client === "string" &&
        conditions_acceptance.accepted_at_client.trim()
          ? conditions_acceptance.accepted_at_client.trim()
          : null,
    };

    const bf = await getBookingFormByPartnerOrderId(partner_order_id);
    const prebookSummary = bf.prebook_token ? await getPrebookSummary(bf.prebook_token) : null;
    const hotel = findHotelFromPrebookSummary(prebookSummary);
    const resolvedPassengers = Array.isArray(passengers) && passengers.length
      ? passengers
      : buildPassengersFromSummary(prebookSummary?.summary || null, customer);

    const guestAdults = resolvedPassengers.filter((p) => String(p?.type || "").toLowerCase() === "adult").length;
    const guestChildren = resolvedPassengers.filter((p) => String(p?.type || "").toLowerCase() === "child").length;
    const guestBabies = resolvedPassengers.filter((p) => String(p?.type || "").toLowerCase() === "baby").length;

    const amountTotal = deriveTotalAmount({ prebookSummary, bookingFormRow: bf });
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      throw httpError(400, "unable_to_resolve_total_amount");
    }

    const merchantBaseUrl = (process.env.KOTAN_MERCHANT_URL || process.env.APP_PUBLIC_URL || "https://dev.bedtrip.fr")
      .replace(/\/+$/, "");
    const merchantLogo = process.env.KOTAN_MERCHANT_LOGO || "/img/bedtrip_logo_3.png";
    const merchantPaymentReturnUrl = process.env.KOTAN_MERCHANT_LOGO || "https://h1.bedtrip.fr/payment_status";
    const merchantStreet = process.env.KOTAN_MERCHANT_STREET || "";
    const merchantZip = process.env.KOTAN_MERCHANT_ZIPCODE || "";
    const merchantCity = process.env.KOTAN_MERCHANT_CITY || "";
    const merchantCountry = normalizeCountry(process.env.KOTAN_MERCHANT_COUNTRY || "FR");
    const merchantPhone = process.env.KOTAN_MERCHANT_PHONE || "";
    const merchantEmail = process.env.KOTAN_MERCHANT_EMAIL || "";
    const merchantName = process.env.KOTAN_MERCHANT_NAME || "";
    const merchantCompany = process.env.KOTAN_MERCHANT_COMPANY || "BED TRIP";
    const merchantVat = process.env.KOTAN_MERCHANT_VAT || "";
    const merchantTax = process.env.KOTAN_MERCHANT_TAX || "";
    const merchantTaxNumber = process.env.KOTAN_MERCHANT_TAX_NUMBER || "";
    const merchantTaxRate = process.env.KOTAN_MERCHANT_TAX_RATE || "";
    const merchantTaxType = process.env.KOTAN_MERCHANT_TAX_TYPE || "";

    const checkIn = toIsoDateOnly(hotel.checkIn, "");
    const checkOut = toIsoDateOnly(hotel.checkOut, "");
    const nights = computeNights(checkIn, checkOut);
    const reference = String(partner_order_id);

    const totalAsFixed = Number(amountTotal).toFixed(2);
    const returnSuccessUrl =
      `${merchantBaseUrl}/payment/success?partner_order_id=${encodeURIComponent(reference)}&provider=kotan`;

    const externPaymentData = {
      payment_variant: payment_variant || null,
      paymentOrigin: {
        // Kotan can use this URL to redirect the user back to BedTrip after payment.
        url: returnSuccessUrl,
        logo_link: merchantLogo,
        return_url: merchantPaymentReturnUrl,
        reference,
        payment_variant: payment_variant || null,
        adr_street: merchantStreet,
        adr_zipcode: merchantZip,
        adr_city: merchantCity,
        adr_country: merchantCountry,
        adr_phone: merchantPhone,
        adr_email: merchantEmail,
        adr_name: merchantName,
        adr_company: merchantCompany,
        adr_vat: merchantVat,
        adr_tax: merchantTax,
        adr_tax_number: merchantTaxNumber,
        adr_tax_rate: merchantTaxRate,
        adr_tax_type: merchantTaxType,
        adr_tax_country: merchantCountry,
        adr_tax_city: merchantCity,
        adr_tax_zipcode: merchantZip,
      },
      passengers: resolvedPassengers,
      services: Array.isArray(services) ? services : [],
      payer: {
        payer_civilite: civilityToKotan(customer.civility),
        payer_fname: customer.firstName || "",
        payer_lname: customer.lastName || "",
        payer_birthname: customer.lastName || "",
        payer_birthdate: toIsoDateOnly(customer.birthdate, ""),
        payer_birth_zipcode_city: customer.city || "",
        payer_birth_zipcode: customer.postalCode || "",
        payer_country: normalizeCountry(customer.country || merchantCountry),
        payer_address: customer.addressLine1 || "",
        payer_cp: customer.postalCode || "",
        payer_city: customer.city || "",
        payer_phone: customer.phone || "",
        payer_email: customer.email || "",
      },
      productType: productType || "hotel",
      checkoutData: {
        adult: String(checkoutData?.adult ?? guestAdults ?? 1),
        child: String(checkoutData?.child ?? guestChildren ?? 0),
        baby: String(checkoutData?.baby ?? guestBabies ?? 0),
      },
      hotel: {
        name: hotel.name || "Hotel",
        address: hotel.address || "",
        city: hotel.city || "",
        zipcode: hotel.zipcode || "",
        country: hotel.country || merchantCountry,
        stars: hotel.stars || null,
        checkIn: checkIn || "",
        checkOut: checkOut || "",
        rooms: Number(hotel.rooms) || 1,
        nights,
      },
      price: {
        hotel: totalAsFixed,
        service: 0,
        insurance: 0,
        total: totalAsFixed,
      },
    };

    await savePayment({
      provider: "kotan_extern",
      status: "initiated",
      partnerOrderId: partner_order_id,
      prebookToken: bf.prebook_token || null,
      etgOrderId: bf.etg_order_id || null,
      itemId: bf.item_id || null,
      amount: amountTotal,
      currencyCode: bf.currency_code || "EUR",
      externalReference: reference,
      payload: {
        endpoint: KOTAN_EXTERN_PAYMENT_URL,
        extern_payment_data: externPaymentData,
        conditions_acceptance_proof: conditionsAcceptanceProof,
      },
    });

    insertApiLog({
      endpoint: `POST externPayment`,
      request: {
        method: "POST",
        url: KOTAN_EXTERN_PAYMENT_URL,
        headers: { "Content-Type": "application/json" },
        body: externPaymentData,
      },
      response: {
        _type: "redirect",
        message: "Client submits form POST to extern payment URL",
        action: KOTAN_EXTERN_PAYMENT_URL,
        reference,
      },
      statusCode: 200,
    }).catch((e) => console.error("[payment] api_log insert failed:", e.message));

    res.json({
      status: "ok",
      action: KOTAN_EXTERN_PAYMENT_URL,
      reference,
      extern_payment_data: externPaymentData,
      conditions_acceptance_proof: conditionsAcceptanceProof,
    });
  } catch (error) {
    next(error);
  }
}

async function getKotanExternPaymentInfo(req, res, next) {
  try {
    const ref = String(req.query?.ref || "").trim();
    if (!ref) throw httpError(400, "ref is required");
    const axiosConfig = {
      params: { ref },
      timeout: 12000,
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    };
    if (KOTAN_EXTERN_ACCEPT_SELF_SIGNED) {
      axiosConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }
    const response = await axios.get(KOTAN_EXTERN_INFO_URL, axiosConfig);
    const info = response.data;

    const pickStatusText = (payload) => {
      if (!payload || typeof payload !== "object") return "";
      const candidates = [
        payload.status,
        payload.payment_status,
        payload.paymentStatus,
        payload.latestStatus,
        payload.state,
        payload.result,
        payload.code,
        payload?.data?.status,
        payload?.data?.payment_status,
        payload?.payment?.status,
        payload?.order?.status,
      ];
      for (const value of candidates) {
        if (value === undefined || value === null) continue;
        const str = String(value).trim();
        if (!str) continue;
        return str.toLowerCase();
      }
      return "";
    };

    /** Accept cofidis email_sent as paid: any payment with status email_sent + event cofidis_initiated + paymentMethod cofidis */
    const hasCofidisEmailSent = (payload) => {
      const payments = payload?.payments;
      if (!Array.isArray(payments)) return false;
      return payments.some(
        (p) =>
          p &&
          String(p.status || "").trim() === "email_sent" &&
          String(p.event || "").trim() === "cofidis_initiated" &&
          String(p.paymentMethod || "").trim() === "cofidis"
      );
    };

    /** True if any payment has paymentMethod === "cofidis" */
    const isCofidis = (() => {
      const payments = info?.payments;
      if (!Array.isArray(payments)) return false;
      return payments.some((p) => p && String(p.paymentMethod || "").trim() === "cofidis");
    })();

    /** On production (bedtrip.fr), reject payment when event is cofidis_initiated */
    const hasCofidisInitiated = (payload) => {
      const payments = payload?.payments;
      if (!Array.isArray(payments)) return false;
      return payments.some((p) => p && String(p.event || "").trim() === "cofidis_initiated");
    };

    const rawStatus = pickStatusText(info);
    const frontBaseUrl = String(process.env.FRONT_BASE_URL || "").trim();
    const cofidisAccepted =
      frontBaseUrl === "https://bedtrip.fr" ? false : hasCofidisEmailSent(info);

    const cofidisRejectedOnProduction =
      frontBaseUrl === "https://bedtrip.fr" && hasCofidisInitiated(info);

    let isPaid =
      cofidisAccepted ||
      rawStatus.includes("paid") ||
      rawStatus.includes("success") ||
      rawStatus.includes("succeed") ||
      rawStatus.includes("accept") ||
      rawStatus.includes("authoriz") ||
      rawStatus.includes("complete") ||
      rawStatus === "ok";
    let isFailed =
      rawStatus.includes("fail") ||
      rawStatus.includes("error") ||
      rawStatus.includes("cancel") ||
      rawStatus.includes("refus") ||
      rawStatus.includes("reject") ||
      rawStatus.includes("declin");

    if (cofidisRejectedOnProduction) {
      isPaid = false;
      isFailed = true;
    }

    const normalizedPaymentStatus = isPaid ? "paid" : isFailed ? "failed" : "pending";

    const bookingBaseUrl = (frontBaseUrl || process.env.APP_PUBLIC_URL || "https://dev.bedtrip.fr").replace(/\/+$/, "");
    const redirectTo = isCofidis ? `${bookingBaseUrl}/booking?token=p-${encodeURIComponent(ref)}` : null;
    

    const stepsLines = [
      `1. raw_status: ${rawStatus || "(empty)"}`,
      `2. FRONT_BASE_URL: ${frontBaseUrl || "(not set)"}`,
      `3. isCofidis (paymentMethod cofidis): ${isCofidis}`,
      `4. cofidisAccepted: ${cofidisAccepted}`,
      `5. cofidisRejectedOnProduction (bedtrip.fr + cofidis_initiated): ${cofidisRejectedOnProduction}`,
      `6. isPaid: ${isPaid}`,
      `7. isFailed: ${isFailed}`,
      `8. normalizedPaymentStatus: ${normalizedPaymentStatus}`,
      ...(redirectTo ? [`9. redirect_to: ${redirectTo}`] : []),
    ];
    const stepsText = stepsLines.join("\n");

    insertApiLog({
      endpoint: "KOTAN_EXTERN_INFO_STATUS",
      request: { ref },
      response: {
        steps_text: stepsText,
        raw_status: rawStatus || null,
        front_base_url: frontBaseUrl || null,
        is_cofidis: isCofidis,
        cofidis_accepted: cofidisAccepted,
        cofidis_rejected_on_production: cofidisRejectedOnProduction,
        is_paid: isPaid,
        is_failed: isFailed,
        normalized_payment_status: normalizedPaymentStatus,
        ...(redirectTo && { redirect_to: redirectTo }),
      },
      statusCode: 200,
    }).catch((e) => console.error("[payment] api_log insert failed:", e.message));

    try {
      await db.query(
        `UPDATE payments
         SET status = $1, updated_at = NOW()
         WHERE provider = 'kotan_extern'
           AND (external_reference = $2 OR partner_order_id = $3)`,
        [normalizedPaymentStatus, ref, ref]
      );
    } catch (dbErr) {
      console.warn("[KOTAN] failed to persist payment status sync:", dbErr.message);
    }

    res.json({
      status: "ok",
      ref,
      payment_status: normalizedPaymentStatus,
      raw_status: rawStatus || null,
      info,
      ...(redirectTo && { redirect_to: redirectTo }),
    });
  } catch (error) {
    if (error?.http) return next(error);
    if (error?.response) {
      return next(
        httpError(
          error.response.status || 502,
          "KOTAN_EXTERN_INFO_FAILED",
          error.response.data || error.message
        )
      );
    }
    next(httpError(502, "KOTAN_EXTERN_INFO_FAILED", error.message || String(error || "")));
  }
}
// POST /api/payments/paypal/order
async function createPayPalOrder(req, res, next) {
  try {
    const { partner_order_id } = req.body || {};
    if (!partner_order_id) throw httpError(400, "partner_order_id is required");

    const bf = await getBookingFormByPartnerOrderId(partner_order_id);
    const prebookSummary = bf.prebook_token ? await getPrebookSummary(bf.prebook_token) : null;

    const amountTotal = deriveTotalAmount({ prebookSummary, bookingFormRow: bf });
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      throw httpError(400, "unable_to_resolve_total_amount");
    }

    const currency = (bf.currency_code || "EUR").toUpperCase();

    const frontBaseUrl = (process.env.FRONT_BASE_URL || process.env.APP_PUBLIC_URL || "https://dev.bedtrip.fr")
      .replace(/\/+$/, "");

    // user returns to your site; front can call capture endpoint after redirect OR you capture in onApprove
    const returnUrl = `${frontBaseUrl}/payment/paypal/return?partner_order_id=${encodeURIComponent(partner_order_id)}`;
    const cancelUrl = `${frontBaseUrl}/payment/paypal/cancel?partner_order_id=${encodeURIComponent(partner_order_id)}`;

    const order = await paypalClient.createOrder({
      referenceId: String(partner_order_id),
      amount: amountTotal,
      currency,
      returnUrl,
      cancelUrl,
    });

    await savePayment({
      provider: "paypal",
      status: "initiated",
      partnerOrderId: partner_order_id,
      prebookToken: bf.prebook_token || null,
      etgOrderId: bf.etg_order_id || null,
      itemId: bf.item_id || null,
      amount: amountTotal,
      currencyCode: currency,
      externalReference: order.id, // PayPal orderId
      payload: { order },
    });

    res.json({ status: "ok", orderId: order.id, order });
  } catch (e) {
    next(e);
  }
}

async function capturePayPalOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!orderId) throw httpError(400, "orderId is required");

    const capture = await paypalClient.captureOrder(orderId);

    // minimal: consider status COMPLETED as paid
    const status = String(capture?.status || "").toUpperCase();
    const isPaid = status === "COMPLETED";

    // Update DB (best: also match partner_order_id if you store it)
    await db.query(
      `UPDATE payments
       SET status = $1, updated_at = NOW(), payload = COALESCE(payload,'{}'::jsonb) || $2::jsonb
       WHERE provider = 'paypal' AND external_reference = $3`,
      [isPaid ? "paid" : "pending", JSON.stringify({ capture }), orderId]
    );

    res.json({ status: "ok", paid: isPaid, capture });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  simulatePlan,
  createDeal,
  createHotelDeal,
  finalizeDeal,
  getInstallment,
  createPayPalOrder,
  capturePayPalOrder,
  cancelDeal,
  createCreditCardToken,
  createKotanExternPayment,
  getKotanExternPaymentInfo,
};
