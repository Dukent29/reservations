"use strict";

const router = require("express").Router();
const searchController = require("../controllers/searchController");

router.get("/regions/search", searchController.searchRegions);
router.post("/search/serp", searchController.searchSerp);
router.post("/search/hp", searchController.searchHotelPage);

module.exports = router;
