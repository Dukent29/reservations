"use strict";

const hotelModel = require("../models/hotelModel");

/**
 * Fetch detailed hotel metadata (rooms, policies, etc.).
 */
async function getHotelInfo(req, res, next) {
  try {
    const payload = hotelModel.buildHotelInfoPayload(req.body || {});
    const info = await hotelModel.fetchHotelInfo(payload);
    res.json({ status: "ok", info });
  } catch (error) {
    next(error);
  }
}

/**
 * Lightweight proxy that keeps only the most relevant image URLs.
 */
async function getHotelImages(req, res, next) {
  try {
    const { images, sizeUsed, hid } = await hotelModel.fetchHotelImages(req.body || {});
    res.json({ status: "ok", hid, sizeUsed, count: images.length, images });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHotelInfo,
  getHotelImages,
};
