"use strict";

const { callETG, BASE } = require("../utils/etg");

function getHealthSnapshot() {
  return { ok: true, env: process.env.ETG_ENV || "prod", base: BASE };
}

async function fetchOverview() {
  return callETG("GET", "/overview/", null);
}

module.exports = {
  getHealthSnapshot,
  fetchOverview,
};
