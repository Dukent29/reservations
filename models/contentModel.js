"use strict";

const { callETG } = require("../utils/etg");

async function fetchHotelDump(language = "en") {
  return callETG("POST", "/hotel/info/dump/", { language });
}

module.exports = {
  fetchHotelDump,
};
