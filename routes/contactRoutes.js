"use strict";

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const contactController = require("../controllers/contactController");
const { validate } = require("../src/middlewares/validateRequest");
const { contactSchemas } = require("../src/middlewares/requestSchemas");

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "contact_rate_limited" },
});

router.post(
  "/contact",
  contactLimiter,
  validate(contactSchemas.contactRequest),
  contactController.postContactRequest,
);

module.exports = router;
