"use strict";

const router = require("express").Router();
const cookieController = require("../controllers/cookieController");

// Public cookie consent routes used by the Vue banner and preferences modal.
router.get("/cookies/consent", cookieController.getCookieConsent);
router.post("/cookies/consent", cookieController.postCookieConsent);

module.exports = router;
