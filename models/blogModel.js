"use strict";

const db = require("../utils/db");

let blogSchemaEnsured = false;

const BLOG_STATUSES = new Set(["draft", "published"]);

function normalizeStatus(status) {
  const value = String(status || "draft").trim().toLowerCase();
  return BLOG_STATUSES.has(value) ? value : "draft";
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of tags) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const lower = value.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    normalized.push(value);
  }
  return normalized;
}

function normalizeImageUrl(raw) {
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

function normalizeImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of imageUrls) {
    const value = normalizeImageUrl(raw);
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function toPublicPost(row) {
  if (!row) return null;
  const coverImageUrl = normalizeImageUrl(row.cover_image_url);
  const imageUrls = normalizeImageUrls(row.image_urls);
  if (!imageUrls.length && coverImageUrl) {
    imageUrls.push(coverImageUrl);
  }
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    coverImageUrl,
    imageUrls,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: row.status,
    authorId: row.author_id,
    authorEmail: row.author_email,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureBlogSchema() {
  if (blogSchemaEnsured) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      content TEXT NOT NULL,
      cover_image_url TEXT,
      image_urls TEXT[] NOT NULL DEFAULT '{}',
      category TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      author_id TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'published'))
    )
  `);
  await db.query(
    "ALTER TABLE blog_posts ALTER COLUMN author_id TYPE TEXT USING author_id::text"
  );
  await db.query(
    "ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}'"
  );
  await db.query(
    "UPDATE blog_posts SET image_urls = '{}' WHERE image_urls IS NULL"
  );

  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at ON blog_posts(status, published_at DESC)"
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)"
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id)"
  );

  blogSchemaEnsured = true;
}

async function listPublishedPosts({ limit = 20, offset = 0 } = {}) {
  await ensureBlogSchema();

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const result = await db.query(
    `SELECT p.*, u.email AS author_email
       FROM blog_posts p
  LEFT JOIN public.users u ON u.id::text = p.author_id
      WHERE p.status = 'published'
        AND p.published_at IS NOT NULL
      ORDER BY p.published_at DESC, p.id DESC
      LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );

  return result.rows.map(toPublicPost);
}

async function countPublishedPosts() {
  await ensureBlogSchema();

  const result = await db.query(
    `SELECT COUNT(*) AS total
       FROM blog_posts
      WHERE status = 'published'
        AND published_at IS NOT NULL`
  );

  return Number(result.rows[0]?.total || 0);
}

async function getPublishedPostBySlug(slug) {
  await ensureBlogSchema();
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  const result = await db.query(
    `SELECT p.*, u.email AS author_email
       FROM blog_posts p
  LEFT JOIN public.users u ON u.id::text = p.author_id
      WHERE p.slug = $1
        AND p.status = 'published'
        AND p.published_at IS NOT NULL
      LIMIT 1`,
    [normalizedSlug]
  );

  return toPublicPost(result.rows[0]);
}

async function listAdminPosts({ status, q, limit = 50, offset = 0 } = {}) {
  await ensureBlogSchema();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const filters = [];
  const values = [];

  if (status && BLOG_STATUSES.has(status)) {
    values.push(status);
    filters.push(`p.status = $${values.length}`);
  }

  if (q) {
    values.push(`%${String(q).trim()}%`);
    filters.push(`(p.title ILIKE $${values.length} OR p.slug ILIKE $${values.length} OR COALESCE(p.excerpt, '') ILIKE $${values.length})`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  values.push(safeLimit);
  const limitParam = `$${values.length}`;
  values.push(safeOffset);
  const offsetParam = `$${values.length}`;

  const query = `
    SELECT p.*, u.email AS author_email
      FROM blog_posts p
 LEFT JOIN public.users u ON u.id::text = p.author_id
      ${whereClause}
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const result = await db.query(query, values);
  return result.rows.map(toPublicPost);
}

async function countAdminPosts({ status, q } = {}) {
  await ensureBlogSchema();

  const filters = [];
  const values = [];

  if (status && BLOG_STATUSES.has(status)) {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }

  if (q) {
    values.push(`%${String(q).trim()}%`);
    filters.push(`(title ILIKE $${values.length} OR slug ILIKE $${values.length} OR COALESCE(excerpt, '') ILIKE $${values.length})`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await db.query(
    `SELECT COUNT(*) AS total
       FROM blog_posts
      ${whereClause}`,
    values
  );

  return Number(result.rows[0]?.total || 0);
}

async function getPostById(id) {
  await ensureBlogSchema();

  const result = await db.query(
    `SELECT p.*, u.email AS author_email
       FROM blog_posts p
  LEFT JOIN public.users u ON u.id::text = p.author_id
      WHERE p.id = $1
      LIMIT 1`,
    [id]
  );

  return toPublicPost(result.rows[0]);
}

async function getPostBySlug(slug) {
  await ensureBlogSchema();

  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return null;

  const result = await db.query(
    `SELECT p.*, u.email AS author_email
       FROM blog_posts p
  LEFT JOIN public.users u ON u.id::text = p.author_id
      WHERE p.slug = $1
      LIMIT 1`,
    [normalized]
  );

  return toPublicPost(result.rows[0]);
}

async function createPost(payload, authorId) {
  await ensureBlogSchema();

  const status = normalizeStatus(payload.status);
  const normalizedSlug = String(payload.slug || "").trim().toLowerCase();

  const result = await db.query(
    `INSERT INTO blog_posts (
      title,
      slug,
      excerpt,
      content,
      cover_image_url,
      image_urls,
      category,
      tags,
      status,
      author_id,
      published_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $9 = 'published' THEN NOW() ELSE NULL END)
    RETURNING id`,
    [
      String(payload.title || "").trim(),
      normalizedSlug,
      payload.excerpt ? String(payload.excerpt).trim() : null,
      String(payload.content || "").trim(),
      normalizeImageUrl(payload.coverImageUrl) || null,
      normalizeImageUrls(payload.imageUrls),
      payload.category ? String(payload.category).trim() : null,
      normalizeTags(payload.tags),
      status,
      authorId != null ? String(authorId) : null,
    ]
  );

  return getPostById(result.rows[0].id);
}

async function updatePostById(id, payload) {
  await ensureBlogSchema();

  const status = normalizeStatus(payload.status);
  const normalizedSlug = String(payload.slug || "").trim().toLowerCase();

  await db.query(
    `UPDATE blog_posts
        SET title = $2,
            slug = $3,
            excerpt = $4,
            content = $5,
            cover_image_url = $6,
            image_urls = $7,
            category = $8,
            tags = $9,
            status = $10,
            published_at = CASE
              WHEN $10 = 'published' AND published_at IS NULL THEN NOW()
              WHEN $10 = 'draft' THEN NULL
              ELSE published_at
            END,
            updated_at = NOW()
      WHERE id = $1`,
    [
      id,
      String(payload.title || "").trim(),
      normalizedSlug,
      payload.excerpt ? String(payload.excerpt).trim() : null,
      String(payload.content || "").trim(),
      normalizeImageUrl(payload.coverImageUrl) || null,
      normalizeImageUrls(payload.imageUrls),
      payload.category ? String(payload.category).trim() : null,
      normalizeTags(payload.tags),
      status,
    ]
  );

  return getPostById(id);
}

async function deletePostById(id) {
  await ensureBlogSchema();

  const result = await db.query(
    `DELETE FROM blog_posts
      WHERE id = $1
      RETURNING id`,
    [id]
  );

  return result.rowCount > 0;
}

module.exports = {
  ensureBlogSchema,
  listPublishedPosts,
  countPublishedPosts,
  getPublishedPostBySlug,
  listAdminPosts,
  countAdminPosts,
  getPostById,
  getPostBySlug,
  createPost,
  updatePostById,
  deletePostById,
};
