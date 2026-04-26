"use strict";

const httpError = require("../src/utils/httpError");
const {
  countPublishedPosts,
  getPublishedPostBySlug,
  listPublishedPosts,
} = require("../models/blogModel");

async function listPublished(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const [posts, total] = await Promise.all([
      listPublishedPosts({ limit, offset }),
      countPublishedPosts(),
    ]);

    return res.json({
      status: "ok",
      posts,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getBySlug(req, res, next) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug) {
      return next(httpError(400, "invalid_slug"));
    }

    const post = await getPublishedPostBySlug(slug);
    if (!post) {
      return next(httpError(404, "blog_post_not_found"));
    }

    return res.json({
      status: "ok",
      post,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPublished,
  getBySlug,
};
