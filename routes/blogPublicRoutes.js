"use strict";

const router = require("express").Router();
const blogPublicController = require("../controllers/blogPublicController");

router.get("/blog", blogPublicController.listPublished);
router.get("/blog/:slug", blogPublicController.getBySlug);

module.exports = router;
