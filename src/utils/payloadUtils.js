"use strict";

const DEFAULT_HOTEL_LIMIT = 15;
const DEFAULT_OFFERS_LIMIT = 50;
const DEFAULT_RATE_LIMIT = 40;
const DEFAULT_HP_RATE_LIMIT = 25;

function limitHotels(hotels = [], hotelsLimit = DEFAULT_HOTEL_LIMIT, ratesLimit = DEFAULT_RATE_LIMIT) {
  return hotels
    .slice(0, hotelsLimit)
    .map((hotel) => ({
      ...hotel,
      rates: Array.isArray(hotel?.rates)
        ? hotel.rates.slice(0, ratesLimit)
        : hotel?.rates ?? [],
    }));
}

function trimSerpPayload(payload, options = {}) {
  const hotelsLimit = Number(options.hotelsLimit) || DEFAULT_HOTEL_LIMIT;
  const offersLimit = Number(options.offersLimit) || DEFAULT_OFFERS_LIMIT;
  const ratesLimit = Number(options.ratesLimit) || DEFAULT_RATE_LIMIT;

  if (Array.isArray(payload)) {
    return limitHotels(payload, hotelsLimit, ratesLimit);
  }

  const clone = typeof payload === "object" && payload !== null ? { ...payload } : payload;
  if (Array.isArray(clone?.hotels)) {
    clone.hotels = limitHotels(clone.hotels, hotelsLimit, ratesLimit);
  }
  if (Array.isArray(clone?.results)) {
    clone.results = limitHotels(clone.results, hotelsLimit, ratesLimit);
  }
  if (Array.isArray(clone?.offers)) {
    clone.offers = clone.offers.slice(0, offersLimit);
  }

  return clone;
}

function hotelStars(hotel) {
  const direct = hotel?.stars ?? hotel?.category ?? hotel?.rg_ext?.class;
  const directNum = Number(direct);
  if (Number.isFinite(directNum) && directNum > 0) return directNum;
  if (Array.isArray(hotel?.rates)) {
    const vals = hotel.rates
      .map((rate) => Number(rate?.rg_ext?.class))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (vals.length) return Math.max(...vals);
  }
  return null;
}

function rateHasFreeCancellation(rate) {
  const fc = rate?.payment_options?.payment_types?.[0]?.cancellation_penalties?.free_cancellation_before;
  if (!fc) return false;
  const ts = Date.parse(fc);
  return Number.isFinite(ts) ? ts > Date.now() : false;
}

function rateMealCode(rate) {
  return rate?.meal || rate?.meal_data?.value || null;
}

function filterHotelsByPreferences(hotels = [], filters = {}) {
  let working = [...hotels];

  if (Array.isArray(filters?.stars) && filters.stars.length) {
    const starSet = new Set(
      filters.stars
        .map((value) => Number(value))
        .filter((num) => Number.isFinite(num) && num > 0)
    );
    if (starSet.size) {
      working = working.filter((hotel) => {
        const starValue = Number(hotelStars(hotel));
        return Number.isFinite(starValue) && starSet.has(starValue);
      });
    }
  }

  if ((Array.isArray(filters?.meals) && filters.meals.length) || filters?.free_cancel) {
    working = working
      .map((hotel) => {
        const rates = Array.isArray(hotel?.rates) ? hotel.rates : [];
        const filteredRates = rates.filter((rate) => {
          const mealOk = filters?.meals?.length ? filters.meals.includes(rateMealCode(rate)) : true;
          const cancelOk = filters?.free_cancel ? rateHasFreeCancellation(rate) : true;
          return mealOk && cancelOk;
        });
        return { ...hotel, rates: filteredRates };
      })
      .filter((hotel) => Array.isArray(hotel.rates) && hotel.rates.length > 0);
  }

  return working;
}

function sanitizeHpResults(results = {}, options = {}) {
  const hotelsLimit = Number(options.hotelsLimit) || 3;
  const ratesLimit = Number(options.ratesLimit) || DEFAULT_HP_RATE_LIMIT;

  const clone = typeof results === "object" && results !== null ? { ...results } : results;
  if (Array.isArray(clone?.hotels)) {
    clone.hotels = limitHotels(clone.hotels, hotelsLimit, ratesLimit);
  } else if (Array.isArray(clone?.results?.hotels)) {
    clone.results = {
      ...clone.results,
      hotels: limitHotels(clone.results.hotels, hotelsLimit, ratesLimit),
    };
  }

  return clone;
}

module.exports = {
  trimSerpPayload,
  filterHotelsByPreferences,
  sanitizeHpResults,
};
