"use strict";

const crypto = require("crypto");
const soap = require("soap");
const { assurTravelConfig } = require("../../config/assurTravel");

let clientPromise = null;

function formatDateTime(value = new Date()) {
  const dt = value instanceof Date ? value : new Date(value);
  const pad = (num) => String(num).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const mm = pad(dt.getMonth() + 1);
  const dd = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mi = pad(dt.getMinutes());
  const ss = pad(dt.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function buildAuthHeader() {
  const datetime = formatDateTime();
  const hashed = crypto
    .createHash("sha1")
    .update(datetime, "utf8")
    .digest("hex");
  const password = crypto
    .createHash("sha1")
    .update(`${hashed}${assurTravelConfig.password}`, "utf8")
    .digest("hex");

  return {
    AuthHeader: {
      username: assurTravelConfig.login,
      password,
      datetime,
    },
  };
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = soap.createClientAsync(assurTravelConfig.wsdl);
  }
  const client = await clientPromise;
  client.clearSoapHeaders();
  client.addSoapHeader(buildAuthHeader(), "", "", assurTravelConfig.url);
  client.setEndpoint(assurTravelConfig.url);
  return client;
}

async function searchQuote({ departureDate, arrivalDate, insuredCount, amount, destinations }) {
  const client = await getClient();
  const payload = {
    data: {
      subscription: {
        date_departure: departureDate,
        date_arrival: arrivalDate,
        nb_insured_persons: insuredCount,
        amount,
        destinations,
      },
    },
  };
  const [result, rawResponse] = await client.searchQuoteAsync(payload);
  return { result, rawResponse };
}

async function newSubscription({
  contractCode,
  extensionsCodes,
  passengers,
  departureDate,
  arrivalDate,
  amount,
  destinations,
}) {
  const client = await getClient();
  const payload = {
    data: {
      subscription: {
        contract_code: contractCode,
        date_booking: formatDateTime().slice(0, 10).split("-").reverse().join("/"),
        date_departure: departureDate,
        date_arrival: arrivalDate,
        nb_insured_persons: passengers.length,
        amount,
        destinations,
        extensions_codes: extensionsCodes,
        pricing_model: 1,
      },
      insured: passengers,
    },
    options: {
      mode: assurTravelConfig.mode === "test" ? "test" : "production",
    },
  };
  const [result, rawResponse] = await client.newSubscriptionAsync(payload);
  return { result, rawResponse };
}

module.exports = {
  searchQuote,
  newSubscription,
};
