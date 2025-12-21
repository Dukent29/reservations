"use strict";

const router = require("express").Router();
const searchController = require("../controllers/searchController");
const { validate } = require("../src/middlewares/validateRequest");
const { searchSchemas } = require("../src/middlewares/requestSchemas");

router.get("/regions/search", validate(searchSchemas.searchRegions), searchController.searchRegions);
router.post("/search/serp", validate(searchSchemas.searchSerp), searchController.searchSerp);
router.post("/search/hp", validate(searchSchemas.searchHp), searchController.searchHotelPage);

module.exports = router;
