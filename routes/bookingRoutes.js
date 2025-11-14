"use strict";

const router = require("express").Router();
const bookingController = require("../controllers/bookingController");

router.post("/prebook", bookingController.prebook);
router.post("/booking/form", bookingController.bookingForm);
router.post("/booking/start", bookingController.startBooking);
router.post("/booking/check", bookingController.checkBooking);

module.exports = router;
