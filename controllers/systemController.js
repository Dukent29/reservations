"use strict";

const systemModel = require("../models/systemModel");

/**
 * Lightweight heartbeat endpoint so ops can confirm the API is reachable.
 */
function healthCheck(_req, res) {
  res.json(systemModel.getHealthSnapshot());
}

/**
 * Proxy ETG overview to help clients discover active upstream endpoints.
 */
async function getOverview(_req, res, next) {
  try {
    const endpoints = await systemModel.fetchOverview();
    res.json({ status: "ok", endpoints });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  healthCheck,
  getOverview,
};
