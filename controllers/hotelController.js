"use strict";

const hotelModel = require("../models/hotelModel");
const hotelPoiService = require("../services/hotelPoiService");

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
    res.setHeader("Cache-Control", "private, max-age=300, stale-while-revalidate=3600");
    res.json({ status: "ok", hid, sizeUsed, count: images.length, images });
  } catch (error) {
    next(error);
  }
}

/**
 * Read hotel POIs from BedTrip's database import, never from the raw dump.
 */
async function getHotelPois(req, res, next) {
  try {
    const payload = await hotelPoiService.listHotelPois(req.query || {});
    res.json({ status: "ok", ...payload });
  } catch (error) {
    next(error);
  }
}

/**
 * Batch POI lookup for result cards to avoid one request per hotel.
 */
async function getHotelPoisBatch(req, res, next) {
  try {
    const payload = await hotelPoiService.listHotelPoisBatch(req.body || {});
    res.json({ status: "ok", ...payload });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHotelInfo,
  getHotelImages,
  getHotelPois,
  getHotelPoisBatch,
};
