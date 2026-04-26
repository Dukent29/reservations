"use strict";

const { getPrebookSummary } = require("../utils/repo");

function normalizeCountry(value, fallback = "FR") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return fallback;
  return normalized.slice(0, 2);
}

function findHotelFromPrebookSummary(prebookSummary) {
  const summary = prebookSummary?.summary || prebookSummary || {};
  const payload = prebookSummary?.payload || {};
  const payloadHotels =
    payload?.data?.hotels ||
    payload?.hotels ||
    payload?.prebook_token?.hotels ||
    [];
  const payloadHotel = Array.isArray(payloadHotels) && payloadHotels.length ? payloadHotels[0] : {};

  const hotelName =
    summary?.hotel?.name ||
    payloadHotel?.name ||
    payloadHotel?.hotel_name ||
    null;

  return {
    name: hotelName || null,
    address:
      summary?.hotel?.address ||
      payloadHotel?.address ||
      payloadHotel?.legal_info?.hotel?.address ||
      "",
    city:
      summary?.hotel?.city ||
      payloadHotel?.city ||
      payloadHotel?.city_name ||
      payloadHotel?.legal_info?.hotel?.city ||
      "",
    country: normalizeCountry(
      summary?.hotel?.country || payloadHotel?.country || payloadHotel?.country_name || "FR"
    ),
    checkIn: summary?.stay?.checkin || "",
    checkOut: summary?.stay?.checkout || "",
  };
}

function deriveHotelFromBookingForm(form) {
  if (!form || typeof form !== "object") return null;
  const hotel = form.hotel || form.hotel_info || form.hotel_data || form.item?.hotel || null;
  const fallbackName =
    hotel?.name ||
    form.hotel_name ||
    form.hotelName ||
    form.name ||
    null;
  if (!hotel && !fallbackName) return null;
  return {
    name: fallbackName,
    address: hotel?.address || hotel?.address_full || "",
    city: hotel?.city || hotel?.city_name || "",
    country: hotel?.country || hotel?.country_name || "",
    checkIn: form.checkin || form.check_in || "",
    checkOut: form.checkout || form.check_out || "",
  };
}

function splitUserName(fullName) {
  const normalized = String(fullName || "").trim();
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function pickNameCandidate(row) {
  const bookingForm = row?.booking_form || {};
  const bookingRaw = row?.booking_raw || {};
  const rawRequest =
    bookingRaw?.debug?.request && typeof bookingRaw.debug.request === "object"
      ? bookingRaw.debug.request
      : bookingRaw;
  const rawUser = rawRequest?.user || bookingRaw?.user || {};
  const rawSupplierData = rawRequest?.supplier_data || {};
  const rawRooms = Array.isArray(rawRequest?.rooms)
    ? rawRequest.rooms
    : Array.isArray(bookingRaw?.rooms)
      ? bookingRaw.rooms
      : [];
  const mainGuest = Array.isArray(rawRooms[0]?.guests) ? rawRooms[0].guests[0] || {} : {};

  const firstName = firstNonEmpty(
    row?.client_first_name,
    mainGuest?.first_name,
    rawSupplierData?.first_name_original,
    rawUser?.first_name,
    bookingForm?.user_first_name,
    bookingForm?.first_name
  );
  const lastName = firstNonEmpty(
    row?.client_last_name,
    mainGuest?.last_name,
    rawSupplierData?.last_name_original,
    rawUser?.last_name,
    bookingForm?.user_last_name,
    bookingForm?.last_name
  );

  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || row?.user_name || "";
}

async function enrichReservationRows(rows = []) {
  return Promise.all(
    rows.map(async (row) => {
      let prebookSummary = null;
      if (row.prebook_token) {
        try {
          prebookSummary = await getPrebookSummary(row.prebook_token);
        } catch (_) {
          prebookSummary = null;
        }
      }

      const hotel =
        deriveHotelFromBookingForm(row.booking_form) ||
        findHotelFromPrebookSummary(prebookSummary) ||
        null;
      const names = splitUserName(pickNameCandidate(row));

      return {
        ...row,
        hotel,
        client_first_name: names.firstName || null,
        client_last_name: names.lastName || null,
        client_full_name: `${names.firstName || ""} ${names.lastName || ""}`.trim() || null,
      };
    })
  );
}

module.exports = {
  deriveHotelFromBookingForm,
  findHotelFromPrebookSummary,
  splitUserName,
  enrichReservationRows,
};
