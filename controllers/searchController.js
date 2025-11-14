"use strict";

const searchModel = require("../models/searchModel");
const { saveSerpSearch } = require("../utils/repo");
const {
  trimSerpPayload,
  filterHotelsByPreferences,
  sanitizeHpResults,
  paginateCollection,
  rankHotelsByOccupancy,
} = require("../src/utils/payloadUtils");

/**
 * Destination autocomplete shared between SERP and front filters.
 */
async function searchRegions(req, res, next) {
  try {
    const term = (req.query.q || "").trim();
    const language = (req.query.lang || req.query.language || "en").trim() || "en";

    if (!term) {
      return res.json({ regions: [], hotels: [] });
    }

    const suggestions = await searchModel.fetchDestinationSuggestions(term, language);
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

/**
 * Main SERP endpoint with basic filters and built-in trimming to keep payloads light.
 */
async function searchSerp(req, res, next) {
  try {
    const filters = req.body?.filters || {};
    const page = req.query.page || 1;
    const hotelsLimit = req.query.limit || 20;
    const payload = { ...req.body };

    const { payload: resolvedPayload, resolvedRegion, regionSuggestions } =
      await searchModel.resolveDestination(payload);

    const { endpoint, body } = searchModel.buildSerpRequest(resolvedPayload);
    const data = await searchModel.fetchSerp(endpoint, body);

    let hotels =
      data?.results?.hotels ||
      data?.hotels ||
      (Array.isArray(data?.results) ? data.results : []);

    hotels = Array.isArray(hotels) ? hotels : [];
    hotels = filterHotelsByPreferences(hotels, filters);
    const requestedCapacity = searchModel.getRequestedCapacity(resolvedPayload.guests);
    hotels = rankHotelsByOccupancy(hotels, requestedCapacity);
    const pagination = paginateCollection(hotels, { page, limit: hotelsLimit });

    const trimmed = trimSerpPayload(
      { hotels: pagination.items },
      { hotelsLimit: pagination.perPage, ratesLimit: 40, offersLimit: 40 }
    );

    await saveSerpSearch({
      endpoint,
      payload: body,
      resultsSample: trimmed,
      requestId: data?.debug?.request_id || null,
      ip: req.ip,
    });

    res.json({
      status: "ok",
      endpoint,
      results: trimmed,
      resolvedRegion,
      regionSuggestions,
      pagination: {
        page: pagination.page,
        perPage: pagination.perPage,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Hotel-page search (single hotel refresh) used after SERP prebook.
 */
async function searchHotelPage(req, res, next) {
  try {
    const payload = searchModel.buildHotelPageRequest(req.body || {});
    const data = await searchModel.fetchHotelPage(payload);
    const sanitized = sanitizeHpResults(data, { ratesLimit: Number(req.query.rateLimit) || 25 });
    res.json({ status: "ok", results: sanitized });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchRegions,
  searchSerp,
  searchHotelPage,
};
