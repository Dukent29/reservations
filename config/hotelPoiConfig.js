"use strict";

const DEFAULT_IMPORT_SOURCE_NAME = "etg_poi_dump";

const POI_SUBTYPE_RULES = Object.freeze({
  airport: { maxDistanceM: 70000, baseScore: 200, perHotelLimit: 2 },
  beach: { maxDistanceM: 20000, baseScore: 190, perHotelLimit: 4 },
  historical_poi: { maxDistanceM: 12000, baseScore: 175, perHotelLimit: 5 },
  museum: { maxDistanceM: 10000, baseScore: 165, perHotelLimit: 4 },
  park: { maxDistanceM: 7000, baseScore: 150, perHotelLimit: 4 },
  theater: { maxDistanceM: 10000, baseScore: 145, perHotelLimit: 3 },
  church: { maxDistanceM: 10000, baseScore: 140, perHotelLimit: 3 },
  shopping_mall: { maxDistanceM: 9000, baseScore: 135, perHotelLimit: 3 },
  shopping_area: { maxDistanceM: 9000, baseScore: 132, perHotelLimit: 3 },
  arenas_and_stadiums: { maxDistanceM: 12000, baseScore: 128, perHotelLimit: 2 },
  zoos_and_aquariums: { maxDistanceM: 15000, baseScore: 126, perHotelLimit: 2 },
  amusement_park: { maxDistanceM: 18000, baseScore: 124, perHotelLimit: 3 },
  educational_objects: { maxDistanceM: 8000, baseScore: 100, perHotelLimit: 2 },
  marina: { maxDistanceM: 12000, baseScore: 120, perHotelLimit: 2 },
  ski_lift: { maxDistanceM: 20000, baseScore: 170, perHotelLimit: 4 },
  medical_facility: { maxDistanceM: 6000, baseScore: 95, perHotelLimit: 2 },
});

const POI_TYPE_RULES = Object.freeze({
  airport: {
    normalizedSubtype: "airport",
    maxDistanceM: 70000,
    baseScore: 200,
    perHotelLimit: 2,
    keepWhenSubtypeMissing: true,
  },
  railway_station: {
    normalizedSubtype: "railway_station",
    maxDistanceM: 25000,
    baseScore: 180,
    perHotelLimit: 3,
    keepWhenSubtypeMissing: true,
  },
  subway_station: {
    normalizedSubtype: "subway_station",
    maxDistanceM: 5000,
    baseScore: 170,
    perHotelLimit: 4,
    keepWhenSubtypeMissing: true,
  },
  bus_station: {
    normalizedSubtype: "bus_station",
    maxDistanceM: 12000,
    baseScore: 125,
    perHotelLimit: 2,
    keepWhenSubtypeMissing: true,
  },
  ferry_terminal: {
    normalizedSubtype: "ferry_terminal",
    maxDistanceM: 20000,
    baseScore: 130,
    perHotelLimit: 2,
    keepWhenSubtypeMissing: true,
  },
});

const POI_TYPE_ALIASES = Object.freeze({
  airport: "airport",
  "railway station": "railway_station",
  railway_station: "railway_station",
  "subway (entrace)": "subway_station",
  "subway (entrance)": "subway_station",
  subway: "subway_station",
  metro: "subway_station",
  "bus station": "bus_station",
  bus_station: "bus_station",
  ferry: "ferry_terminal",
  ferry_terminal: "ferry_terminal",
});

const IMPORT_LIMITS = Object.freeze({
  batchSize: 500,
  logEveryHotels: 2000,
  maxPoisPerHotel: 24,
  maxFeaturedPoisPerHotel: 10,
  errorSampleLimit: 20,
  defaultQueryLimit: 20,
  maxQueryLimit: 100,
});

module.exports = {
  DEFAULT_IMPORT_SOURCE_NAME,
  POI_SUBTYPE_RULES,
  POI_TYPE_RULES,
  POI_TYPE_ALIASES,
  IMPORT_LIMITS,
};

