"use strict";

const httpError = require("../src/utils/httpError");
const promoCodeModel = require("../models/promoCodeModel");

async function validatePromo(req, res, next) {
  try {
    const {
      code,
      partner_order_id,
      user_email,
      user_id,
    } = req.body || {};

    const result = await promoCodeModel.validatePromoForBooking({
      code,
      partnerOrderId: partner_order_id,
      userId: user_email || user_id || null,
      attach: true,
    });

    res.json({
      status: "ok",
      promo: result.promo,
    });
  } catch (error) {
    next(error);
  }
}

async function clearPromo(req, res, next) {
  try {
    const { partner_order_id } = req.body || {};
    if (!partner_order_id) throw httpError(400, "partner_order_id is required");
    await promoCodeModel.clearAppliedPromo(partner_order_id);
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
}

async function listAdminPromoCodes(req, res, next) {
  try {
    const data = await promoCodeModel.listPromoCodes(req.query || {});
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createAdminPromoCode(req, res, next) {
  try {
    const promo = await promoCodeModel.createPromoCode(req.body || {});
    res.status(201).json({ promo });
  } catch (error) {
    next(error);
  }
}

async function updateAdminPromoCode(req, res, next) {
  try {
    const promo = await promoCodeModel.updatePromoCode(req.params.id, req.body || {});
    res.json({ promo });
  } catch (error) {
    next(error);
  }
}

async function deleteAdminPromoCode(req, res, next) {
  try {
    const deleted = await promoCodeModel.deletePromoCode(req.params.id);
    if (!deleted) throw httpError(404, "promo_code_not_found");
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validatePromo,
  clearPromo,
  listAdminPromoCodes,
  createAdminPromoCode,
  updateAdminPromoCode,
  deleteAdminPromoCode,
};
