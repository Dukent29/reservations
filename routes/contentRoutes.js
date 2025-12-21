"use strict";

const router = require("express").Router();
const contentController = require("../controllers/contentController");
const { validate } = require("../src/middlewares/validateRequest");
const { contentSchemas } = require("../src/middlewares/requestSchemas");

router.post("/content/hotel-dump", validate(contentSchemas.hotelDump), contentController.hotelDump);

module.exports = router;
