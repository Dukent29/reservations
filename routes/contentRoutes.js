"use strict";

const router = require("express").Router();
const contentController = require("../controllers/contentController");

router.post("/content/hotel-dump", contentController.hotelDump);

module.exports = router;
