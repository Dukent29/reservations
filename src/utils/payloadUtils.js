"use strict";

const DEFAULT_HOTEL_LIMIT = 20;
const DEFAULT_OFFERS_LIMIT = 50;
const DEFAULT_RATE_LIMIT = 40;
const DEFAULT_HP_RATE_LIMIT = 25;
const MAX_HOTEL_LIMIT = 100;

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

function sanitizeLimit(limit, fallback = DEFAULT_HOTEL_LIMIT) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(MAX_HOTEL_LIMIT, Math.floor(parsed)));
}

function sanitizePage(page) {
  const parsed = Number(page);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function trimSerpPayload(payload, options = {}) {
  const hotelsLimit = sanitizeLimit(options.hotelsLimit, DEFAULT_HOTEL_LIMIT);
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

function normalizePropertyTypeValue(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes("apart") ||
    normalized.includes("appart") ||
    normalized.includes("flat") ||
    normalized.includes("studio") ||
    normalized.includes("condo")
  ) {
    return "apartment";
  }

  if (
    normalized.includes("hotel") ||
    normalized.includes("resort") ||
    normalized.includes("hostel") ||
    normalized.includes("guesthouse") ||
    normalized.includes("motel") ||
    normalized.includes("bnb") ||
    normalized.includes("villa")
  ) {
    return "hotel";
  }

  return null;
}

function hotelPropertyType(hotel) {
  if (!hotel || typeof hotel !== "object") return null;
  const candidates = [
    hotel?.kind,
    hotel?.property_type,
    hotel?.propertyType,
    hotel?.accommodation_type,
    hotel?.accommodationType,
    hotel?.hotel_type,
    hotel?.hotelType,
    hotel?.type,
    hotel?.rg_ext?.kind,
    hotel?.rg_ext?.property_type,
    hotel?.rg_ext?.accommodation_type,
    hotel?.rg_ext?.hotel_type,
    hotel?.rg_ext?.type,
  ];
  for (const candidate of candidates) {
    const normalized = normalizePropertyTypeValue(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function rateHasFreeCancellation(rate) {
  const fc = rate?.payment_options?.payment_types?.[0]?.cancellation_penalties?.free_cancellation_before;
  if (!fc) return false;
  const ts = Date.parse(fc);
  return Number.isFinite(ts) ? ts > Date.now() : false;
}

function parseDistanceMeters(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const kmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*km\b/);
  if (kmMatch) return Number(kmMatch[1]) * 1000;
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m\b/);
  if (mMatch) return Number(mMatch[1]);
  const miMatch = normalized.match(/(\d+(?:\.\d+)?)\s*mi\b/);
  if (miMatch) return Number(miMatch[1]) * 1609.34;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function firstDistanceFromCandidates(candidates = []) {
  for (const candidate of candidates) {
    const parsed = parseDistanceMeters(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function findPoiDistance(hotel, keywords = []) {
  const poiGroups = [
    hotel?.points_of_interest,
    hotel?.pois,
    hotel?.nearby_points,
    hotel?.rg_ext?.points_of_interest,
  ];
  for (const pois of poiGroups) {
    if (!Array.isArray(pois)) continue;
    const matches = pois
      .map((poi) => {
        const label = String(
          poi?.name || poi?.label || poi?.description || poi?.type || poi?.kind || ""
        )
          .trim()
          .toLowerCase();
        if (!label) return null;
        const isMatch = keywords.some((kw) => label.includes(kw));
        if (!isMatch) return null;
        return firstDistanceFromCandidates([
          poi?.distance,
          poi?.distance_meters,
          poi?.distance_center_meters,
        ]);
      })
      .filter((num) => Number.isFinite(num));
    if (matches.length) return Math.min(...matches);
  }
  return null;
}

function cityCenterDistanceMeters(hotel) {
  const direct = firstDistanceFromCandidates([
    hotel?.cityCenterDistanceM,
    hotel?.geo?.cityCenterDistanceM,
    hotel?.distance_to_city_center,
    hotel?.distance_to_center,
    hotel?.city_center_distance,
    hotel?.center_distance,
    hotel?.distance_center,
    hotel?.distance,
    hotel?.location?.distance_to_city_center,
    hotel?.location?.distance_to_center,
    hotel?.distances?.city_center,
    hotel?.distances?.to_center,
    hotel?.rg_ext?.distance_to_city_center,
    hotel?.rg_ext?.distance_to_center,
    hotel?.rg_ext?.city_center_distance,
    hotel?.rg_ext?.center_distance,
  ]);
  if (direct !== null) return direct;
  return findPoiDistance(hotel, [
    "city center",
    "city centre",
    "center",
    "centre",
    "downtown",
    "old town",
    "centre-ville",
  ]);
}

function beachDistanceMeters(hotel) {
  const direct = firstDistanceFromCandidates([
    hotel?.beachDistanceM,
    hotel?.geo?.beachDistanceM,
    hotel?.distance_to_beach,
    hotel?.beach_distance,
    hotel?.distance_beach,
    hotel?.location?.distance_to_beach,
    hotel?.distances?.beach,
    hotel?.rg_ext?.distance_to_beach,
    hotel?.rg_ext?.beach_distance,
  ]);
  if (direct !== null) return direct;
  return findPoiDistance(hotel, ["beach", "plage", "sea", "shore", "coast"]);
}

function normalizeGeoProfile(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  switch (normalized) {
    case "in_city":
    case "city_near":
    case "center_near":
    case "city_center_near":
      return "in_city";
    case "away_city":
    case "city_far":
    case "center_far":
    case "city_center_far":
      return "away_city";
    case "near_beach":
    case "beach_near":
      return "near_beach";
    case "far_beach":
    case "beach_far":
      return "far_beach";
    default:
      return normalized;
  }
}

function hotelMatchesGeoProfile(hotel, profile) {
  const CITY_NEAR_MAX_M = 2500;
  const CITY_FAR_MIN_M = 5000;
  const BEACH_NEAR_MAX_M = 1200;
  const BEACH_FAR_MIN_M = 3000;
  const cityDistance = cityCenterDistanceMeters(hotel);
  const beachDistance = beachDistanceMeters(hotel);

  switch (profile) {
    case "in_city":
      return Number.isFinite(cityDistance) ? cityDistance <= CITY_NEAR_MAX_M : false;
    case "away_city":
      return Number.isFinite(cityDistance) ? cityDistance >= CITY_FAR_MIN_M : false;
    case "near_beach":
      return Number.isFinite(beachDistance) ? beachDistance <= BEACH_NEAR_MAX_M : false;
    case "far_beach":
      return Number.isFinite(beachDistance) ? beachDistance >= BEACH_FAR_MIN_M : false;
    default:
      return true;
  }
}

function resolveDistanceFilter(rawValue) {
  if (Array.isArray(rawValue)) {
    const candidates = rawValue
      .map((value) => Number(value))
      .filter((num) => Number.isFinite(num) && num > 0);
    if (!candidates.length) return null;
    return Math.max(...candidates);
  }
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMealCode(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  switch (normalized) {
    case "ro":
    case "room_only":
    case "room-only":
    case "roomonly":
    case "nomeal":
    case "no_meal":
    case "no-meal":
      return "nomeal";
    case "bb":
    case "bed_breakfast":
    case "bed-breakfast":
    case "breakfast":
      return "breakfast";
    case "hb":
    case "half_board":
    case "half-board":
    case "halfboard":
      return "half_board";
    case "fb":
    case "full_board":
    case "full-board":
    case "fullboard":
      return "full_board";
    case "ai":
    case "al":
    case "all_inclusive":
    case "all-inclusive":
    case "allinclusive":
      return "all_inclusive";
    default:
      return normalized;
  }
}

function rateMealCode(rate) {
  return normalizeMealCode(rate?.meal_data?.value || rate?.meal);
}

function rateCapacityFromRate(rate) {
  if (!rate) return null;
  const candidates = [
    rate?.rg_ext?.capacity,
    rate?.rg_ext?.occupancy,
    rate?.capacity,
    rate?.max_occupancy,
    rate?.occupancy,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function ratePriceAmount(rate) {
  const payment = rate?.payment_options?.payment_types?.[0];
  const val = Number(payment?.show_amount ?? payment?.amount);
  return Number.isFinite(val) ? val : 0;
}
function rateNightsCount(rate) {
  if (Array.isArray(rate?.daily_prices) && rate.daily_prices.length > 0) {
    return rate.daily_prices.length;
  }
  const stay = rate?.stay || rate?.stay_dates;
  if (Array.isArray(stay) && stay.length > 0) {
    return stay.length;
  }
  return 1;
}

function rankHotelsByOccupancy(hotels = [], requiredCapacity = 1) {
  if (!Array.isArray(hotels) || !hotels.length) return hotels;
  const need = Math.max(1, Number(requiredCapacity) || 1);

  const scored = hotels.map((hotel, idx) => {
    const rates = Array.isArray(hotel?.rates) ? hotel.rates : [];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const rate of rates) {
      const capacity = rateCapacityFromRate(rate) || 0;
      const deficit = capacity >= need ? 0 : need - capacity;
      const excess = capacity > need ? capacity - need : 0;
      const price = ratePriceAmount(rate);
      const score = deficit * 100000 + excess * 1000 + price;
      if (score < bestScore) bestScore = score;
    }
    if (!rates.length) bestScore = 1e12 + idx;
    return { hotel, bestScore, idx };
  });

  return scored
    .sort((a, b) => {
      if (a.bestScore === b.bestScore) return a.idx - b.idx;
      return a.bestScore - b.bestScore;
    })
    .map((entry) => entry.hotel);
}

function filterHotelsByPreferences(hotels = [], filters = {}) {
  let working = [...hotels];

  const rawMin = filters?.budget_min ?? filters?.budgetMin;
  const rawMax = filters?.budget_max ?? filters?.budgetMax;
  const parsedMin = Number(rawMin);
  const parsedMax = Number(rawMax);
  let budgetMin = Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : null;
  let budgetMax = Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : null;
  if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
    const swap = budgetMin;
    budgetMin = budgetMax;
    budgetMax = swap;
  }

  if (Array.isArray(filters?.stars) && filters.stars.length) {
    const starSet = new Set(
      filters.stars
        .map((value) => Number(value))
        .filter((num) => Number.isFinite(num) && num >= 2)
    );
    if (starSet.size) {
      working = working.filter((hotel) => {
        const starValue = Number(hotelStars(hotel));
        return Number.isFinite(starValue) && starSet.has(starValue);
      });
    }
  }

  const rawPropertyTypes = Array.isArray(filters?.property_types)
    ? filters.property_types
    : Array.isArray(filters?.propertyTypes)
      ? filters.propertyTypes
      : [];
  if (rawPropertyTypes.length) {
    const propertyTypeSet = new Set(
      rawPropertyTypes
        .map((value) => normalizePropertyTypeValue(value))
        .filter(Boolean)
    );
    if (propertyTypeSet.size) {
      working = working.filter((hotel) => {
        const type = hotelPropertyType(hotel);
        return type ? propertyTypeSet.has(type) : false;
      });
    }
  }

  const shouldFilterRates =
    (Array.isArray(filters?.meals) && filters.meals.length) ||
    filters?.free_cancel ||
    budgetMin !== null ||
    budgetMax !== null;
  const cityDistanceMaxM = resolveDistanceFilter(
    filters?.city_distance_max_m ?? filters?.cityDistanceMaxM
  );
  const beachDistanceMaxM = resolveDistanceFilter(
    filters?.beach_distance_max_m ??
      filters?.beachDistanceMaxM ??
      filters?.beach_distance_options_m
  );
  const normalizedGeoProfiles = new Set(
    (Array.isArray(filters?.geo_profiles)
      ? filters.geo_profiles
      : Array.isArray(filters?.geoProfiles)
        ? filters.geoProfiles
        : [])
      .map((value) => normalizeGeoProfile(value))
      .filter(Boolean)
  );

  if (shouldFilterRates) {
    const normalizedMealFilterSet = new Set(
      (Array.isArray(filters?.meals) ? filters.meals : [])
        .map((value) => normalizeMealCode(value))
        .filter(Boolean)
    );
    working = working
      .map((hotel) => {
        const rates = Array.isArray(hotel?.rates) ? hotel.rates : [];
        const filteredRates = rates.filter((rate) => {
          const mealOk = normalizedMealFilterSet.size
            ? normalizedMealFilterSet.has(rateMealCode(rate))
            : true;
          const cancelOk = filters?.free_cancel ? rateHasFreeCancellation(rate) : true;
          const nightlyPrice = (() => {
            const amount = ratePriceAmount(rate);
            const nights = Math.max(1, rateNightsCount(rate));
            return amount / nights;
          })();
          const minOk = budgetMin === null || nightlyPrice >= budgetMin;
          const maxOk = budgetMax === null || nightlyPrice <= budgetMax;
          return mealOk && cancelOk && minOk && maxOk;
        });
        return { ...hotel, rates: filteredRates };
      })
      .filter((hotel) => Array.isArray(hotel.rates) && hotel.rates.length > 0);
  }

  if (normalizedGeoProfiles.size) {
    working = working.filter((hotel) => {
      for (const profile of normalizedGeoProfiles) {
        if (hotelMatchesGeoProfile(hotel, profile)) {
          return true;
        }
      }
      return false;
    });
  }

  if (cityDistanceMaxM !== null || beachDistanceMaxM !== null) {
    working = working.filter((hotel) => {
      if (cityDistanceMaxM !== null) {
        const cityDistance = cityCenterDistanceMeters(hotel);
        if (Number.isFinite(cityDistance) && cityDistance > cityDistanceMaxM) {
          return false;
        }
      }
      if (beachDistanceMaxM !== null) {
        const beachDistance = beachDistanceMeters(hotel);
        if (Number.isFinite(beachDistance) && beachDistance > beachDistanceMaxM) {
          return false;
        }
      }
      return true;
    });
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

function paginateCollection(items = [], options = {}) {
  const total = Array.isArray(items) ? items.length : 0;
  const perPage = sanitizeLimit(options.limit, DEFAULT_HOTEL_LIMIT);
  const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / perPage));
  const currentPage = totalPages === 0
    ? 1
    : Math.min(sanitizePage(options.page), totalPages);
  const start = (currentPage - 1) * perPage;
  const pagedItems = Array.isArray(items) ? items.slice(start, start + perPage) : [];

  return {
    items: pagedItems,
    page: currentPage,
    perPage,
    total,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}

module.exports = {
  trimSerpPayload,
  filterHotelsByPreferences,
  sanitizeHpResults,
  paginateCollection,
  rankHotelsByOccupancy,
};
