"use strict";

const router = require("express").Router();
const hotelController = require("../controllers/hotelController");
const { validate } = require("../src/middlewares/validateRequest");
const { hotelSchemas } = require("../src/middlewares/requestSchemas");

router.post("/hotel/info", validate(hotelSchemas.hotelInfo), hotelController.getHotelInfo);
router.post("/hotel/images", validate(hotelSchemas.hotelImages), hotelController.getHotelImages);

module.exports = router;
