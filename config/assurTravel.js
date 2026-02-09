"use strict";

const assurTravelConfig = {
  mode: process.env.ASSUR_TRAVEL_MODE || "live",
  url:
    process.env.ASSUR_TRAVEL_URL ||
    "https://souscription.assur-travel.fr/webservice/b2b_to_v2/",
  wsdl:
    process.env.ASSUR_TRAVEL_WSDL ||
    "https://souscription.assur-travel.fr/webservice/b2b_to_v2/?wsdl",
  login: process.env.ASSUR_TRAVEL_LOGIN || "k84oTA2N",
  password: process.env.ASSUR_TRAVEL_PASSWORD || "J-ryeo-v6cAW",
  offersToShow: ["ANBVM"],
};

module.exports = {
  assurTravelConfig,
};
