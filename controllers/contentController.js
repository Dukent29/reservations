"use strict";

const contentModel = require("../models/contentModel");

/**
 * Proxy ETG hotel dump metadata so the client can download directly.
 */
async function hotelDump(req, res, next) {
  try {
    const { language = "en" } = req.body || {};
    const data = await contentModel.fetchHotelDump(language);
    const download_url = data?.download_url || data?.url || data?.link || null;
    res.json({
      status: "ok",
      hint: "Use download_url to fetch the .zst file (often .jsonl.zst or .tar.zst)",
      download_url,
      raw: data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { hotelDump };
