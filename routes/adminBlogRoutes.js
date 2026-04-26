"use strict";

const router = require("express").Router();
const blogAdminController = require("../controllers/blogAdminController");
const { validate } = require("../src/middlewares/validateRequest");
const { blogSchemas } = require("../src/middlewares/requestSchemas");
const { requireAdminAuth, requireRoles } = require("../src/middlewares/adminAuth");
const { adminApiRateLimiter, suspiciousInputGuard } = require("../src/middlewares/security");

router.use("/admin/blog", adminApiRateLimiter, requireAdminAuth, requireRoles("admin", "editor"));

router.get("/admin/blog", validate(blogSchemas.adminListPosts), blogAdminController.listPosts);
router.get("/admin/blog/:id", validate(blogSchemas.adminPostId), blogAdminController.getPost);
router.post(
  "/admin/blog",
  suspiciousInputGuard(["title", "slug", "excerpt", "category", "coverImageUrl", "imageUrls", "tags", "status"]),
  validate(blogSchemas.adminCreatePost),
  blogAdminController.create
);
router.put(
  "/admin/blog/:id",
  suspiciousInputGuard(["title", "slug", "excerpt", "category", "coverImageUrl", "imageUrls", "tags", "status"]),
  validate(blogSchemas.adminUpdatePost),
  blogAdminController.update
);
router.delete("/admin/blog/:id", validate(blogSchemas.adminPostId), blogAdminController.remove);
router.post(
  "/admin/blog/upload-cover",
  suspiciousInputGuard(["fileName"]),
  validate(blogSchemas.adminUploadCover),
  blogAdminController.uploadCoverImage
);

module.exports = router;
