"use strict";

const router = require("express").Router();
const bookingController = require("../controllers/bookingController");
const { validate } = require("../src/middlewares/validateRequest");
const { bookingSchemas } = require("../src/middlewares/requestSchemas");

router.post("/prebook", validate(bookingSchemas.prebook), bookingController.prebook);
router.post("/booking/form", validate(bookingSchemas.bookingForm), bookingController.bookingForm);
router.post("/booking/start", validate(bookingSchemas.bookingStart), bookingController.startBooking);
router.post("/booking/check", validate(bookingSchemas.bookingCheck), bookingController.checkBooking);
router.get("/booking/status", validate(bookingSchemas.bookingStatus), bookingController.getBookingStatus);

module.exports = router;
