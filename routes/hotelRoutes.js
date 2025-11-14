"use strict";

const router = require("express").Router();
const hotelController = require("../controllers/hotelController");

router.post("/hotel/info", hotelController.getHotelInfo);
router.post("/hotel/images", hotelController.getHotelImages);

module.exports = router;
