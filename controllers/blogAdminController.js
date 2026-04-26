"use strict";

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const httpError = require("../src/utils/httpError");
const {
  countAdminPosts,
  createPost,
  deletePostById,
  getPostById,
  getPostBySlug,
  listAdminPosts,
  updatePostById,
} = require("../models/blogModel");

const BLOG_UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "blog");
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_URLS = 24;

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTags(rawTags) {
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags === "string") {
    return rawTags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSafeImageUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  if (value.startsWith("/uploads/")) {
    return value;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }

  const protocol = String(parsed.protocol || "").toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return "";
  }

  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

function normalizeImageUrls(rawImageUrls) {
  let input = [];
  if (Array.isArray(rawImageUrls)) {
    input = rawImageUrls;
  } else if (typeof rawImageUrls === "string") {
    input = rawImageUrls.split(",");
  }

  const invalid = [];
  const seen = new Set();
  const safeUrls = [];

  for (const item of input) {
    const originalValue = String(item || "").trim();
    if (!originalValue) continue;

    const normalizedValue = normalizeSafeImageUrl(originalValue);
    if (!normalizedValue) {
      invalid.push(originalValue);
      continue;
    }

    if (seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);
    safeUrls.push(normalizedValue);
  }

  return { safeUrls, invalid };
}

function normalizePostInput(body) {
  const title = String(body?.title || "").trim();
  const providedSlug = String(body?.slug || "").trim();
  const slug = providedSlug ? slugify(providedSlug) : slugify(title);
  const content = String(body?.content || "").trim();
  const excerpt = body?.excerpt ? String(body.excerpt).trim() : "";
  const rawCoverImageUrl = body?.coverImageUrl ? String(body.coverImageUrl).trim() : "";
  const coverImageUrl = rawCoverImageUrl ? normalizeSafeImageUrl(rawCoverImageUrl) : "";
  const imageUrlResult = normalizeImageUrls(body?.imageUrls);
  const imageUrls = imageUrlResult.safeUrls;
  const invalidImageUrls = [...imageUrlResult.invalid];

  if (rawCoverImageUrl && !coverImageUrl) {
    invalidImageUrls.push(rawCoverImageUrl);
  }

  const category = body?.category ? String(body.category).trim() : "";
  const status = String(body?.status || "draft").trim().toLowerCase();
  const tags = normalizeTags(body?.tags);
  if (coverImageUrl && !imageUrls.includes(coverImageUrl)) {
    imageUrls.unshift(coverImageUrl);
  }
  const resolvedCoverImageUrl = coverImageUrl || imageUrls[0] || "";

  return {
    title,
    slug,
    content,
    excerpt,
    coverImageUrl: resolvedCoverImageUrl,
    imageUrls,
    category,
    status,
    tags,
    invalidImageUrls,
  };
}

function validatePayload(payload) {
  if (!payload.title || payload.title.length < 3) {
    throw httpError(400, "invalid_title");
  }
  if (!payload.slug || payload.slug.length < 3) {
    throw httpError(400, "invalid_slug");
  }
  if (!payload.content || payload.content.length < 10) {
    throw httpError(400, "invalid_content");
  }
  if (!["draft", "published"].includes(payload.status)) {
    throw httpError(400, "invalid_status");
  }
  if (Array.isArray(payload.imageUrls) && payload.imageUrls.length > MAX_IMAGE_URLS) {
    throw httpError(400, "too_many_images");
  }
  if (Array.isArray(payload.invalidImageUrls) && payload.invalidImageUrls.length) {
    throw httpError(400, "invalid_image_url");
  }
}

async function listPosts(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status).toLowerCase() : "";
    const q = req.query.q ? String(req.query.q).trim() : "";
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const [posts, total] = await Promise.all([
      listAdminPosts({ status, q, limit, offset }),
      countAdminPosts({ status, q }),
    ]);

    return res.json({
      status: "ok",
      posts,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    return next(error);
  }
}

async function getPost(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return next(httpError(400, "invalid_post_id"));
    }

    const post = await getPostById(id);
    if (!post) {
      return next(httpError(404, "blog_post_not_found"));
    }

    return res.json({ status: "ok", post });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const payload = normalizePostInput(req.body || {});
    validatePayload(payload);

    const existing = await getPostBySlug(payload.slug);
    if (existing) {
      return next(httpError(409, "slug_already_exists"));
    }

    const created = await createPost(payload, req.adminAuth?.user?.id || null);
    return res.status(201).json({ status: "ok", post: created });
  } catch (error) {
    if (error?.code === "23505") {
      return next(httpError(409, "slug_already_exists"));
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return next(httpError(400, "invalid_post_id"));
    }

    const current = await getPostById(id);
    if (!current) {
      return next(httpError(404, "blog_post_not_found"));
    }

    const payload = normalizePostInput(req.body || {});
    validatePayload(payload);

    const existing = await getPostBySlug(payload.slug);
    if (existing && String(existing.id) !== String(id)) {
      return next(httpError(409, "slug_already_exists"));
    }

    const updated = await updatePostById(id, payload);
    return res.json({ status: "ok", post: updated });
  } catch (error) {
    if (error?.code === "23505") {
      return next(httpError(409, "slug_already_exists"));
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return next(httpError(400, "invalid_post_id"));
    }

    const post = await getPostById(id);
    if (!post) {
      return next(httpError(404, "blog_post_not_found"));
    }

    const role = String(req.adminAuth?.user?.role || "").toLowerCase();
    const userId = req.adminAuth?.user?.id;

    if (role !== "admin" && String(post.authorId) !== String(userId)) {
      return next(httpError(403, "forbidden"));
    }

    await deletePostById(id);
    return res.json({ status: "ok" });
  } catch (error) {
    return next(error);
  }
}

function extractBase64Payload(value) {
  const raw = String(value || "").trim();
  if (!raw) return { mime: "", data: "" };

  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    return {
      mime: String(dataUrlMatch[1] || "").toLowerCase(),
      data: dataUrlMatch[2],
    };
  }

  return { mime: "", data: raw };
}

function extensionFromMime(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return "";
}

function safeExtension(filename) {
  const ext = path.extname(String(filename || "").toLowerCase());
  return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : "";
}

function canonicalExtension(ext) {
  const value = String(ext || "").toLowerCase();
  if (value === ".jpeg") return ".jpg";
  return value;
}

function detectImageExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return ".png";
  }

  // GIF: GIF87a / GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return ".gif";
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return ".webp";
  }

  return "";
}

function decodeBase64Strict(payload) {
  const normalized = String(payload || "").replace(/\s+/g, "");
  if (!normalized) return null;
  if (normalized.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null;

  try {
    const buffer = Buffer.from(normalized, "base64");
    return buffer.length ? buffer : null;
  } catch {
    return null;
  }
}

async function uploadCoverImage(req, res, next) {
  try {
    const { fileName, contentBase64 } = req.body || {};
    const parsed = extractBase64Payload(contentBase64);

    if (!parsed.data) {
      return next(httpError(400, "missing_image_payload"));
    }

    const buffer = decodeBase64Strict(parsed.data);
    if (!buffer) {
      return next(httpError(400, "invalid_image_payload"));
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      return next(httpError(400, "image_too_large"));
    }

    const detectedExtension = canonicalExtension(detectImageExtension(buffer));
    if (!detectedExtension || !ALLOWED_IMAGE_EXTENSIONS.has(detectedExtension)) {
      return next(httpError(400, "invalid_image_format"));
    }

    const hintedExtension = canonicalExtension(safeExtension(fileName) || extensionFromMime(parsed.mime));
    if (hintedExtension && hintedExtension !== detectedExtension) {
      return next(httpError(400, "invalid_image_format"));
    }

    await fs.mkdir(BLOG_UPLOADS_DIR, { recursive: true });

    const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
    const outputFile = `${Date.now()}-${hash}${detectedExtension}`;
    const outputPath = path.join(BLOG_UPLOADS_DIR, outputFile);

    await fs.writeFile(outputPath, buffer);

    return res.status(201).json({
      status: "ok",
      file: {
        name: outputFile,
        size: buffer.length,
        url: `/uploads/blog/${outputFile}`,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPosts,
  getPost,
  create,
  update,
  remove,
  uploadCoverImage,
};
