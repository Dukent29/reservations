"use strict";

const httpError = require("../src/utils/httpError");
const floaService = require("../src/lib/floaClient");

async function simulatePlan(req, res, next) {
  try {
    const payload = req.body || {};
    const plan = await floaService.simulatePlan(payload);
    res.json({ status: "ok", plan });
  } catch (error) {
    next(error);
  }
}

async function createDeal(req, res, next) {
  try {
    const payload = req.body || {};
    const deal = await floaService.createDeal(payload);
    res.json({ status: "ok", deal });
  } catch (error) {
    next(error);
  }
}

async function finalizeDeal(req, res, next) {
  try {
    const payload = req.body || {};
    const result = await floaService.finalizeDeal(payload);
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

module.exports = {
  simulatePlan,
  createDeal,
  finalizeDeal,
  getInstallment,
  cancelDeal,
};
