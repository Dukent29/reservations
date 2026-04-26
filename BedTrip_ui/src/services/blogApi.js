import { API_BASE, safeJsonFetch } from './httpClient'
import { getAdminAuthHeaders } from './adminAuth'

function buildUrl(path) {
  return `${API_BASE}${path}`
}

function createHttpError(statusCode, data, fallback = 'request_failed') {
  const error = new Error(data?.error || fallback)
  error.statusCode = statusCode
  error.data = data
  return error
}

function normalizeTagsInput(tagsValue) {
  if (Array.isArray(tagsValue)) return tagsValue
  if (typeof tagsValue === 'string') {
    return tagsValue
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeImageUrlsInput(imageUrlsValue) {
  if (!Array.isArray(imageUrlsValue)) return []
  return imageUrlsValue
    .map((url) => String(url || '').trim())
    .filter(Boolean)
}

function sanitizeBlogPayload(rawPayload = {}) {
  const payload = {
    ...rawPayload,
    tags: normalizeTagsInput(rawPayload?.tags),
    imageUrls: normalizeImageUrlsInput(rawPayload?.imageUrls),
  }

  const optionalStringFields = ['slug', 'excerpt', 'coverImageUrl', 'category']
  for (const field of optionalStringFields) {
    if (typeof payload[field] !== 'string') continue
    const trimmed = payload[field].trim()
    if (!trimmed) {
      delete payload[field]
      continue
    }
    payload[field] = trimmed
  }

  if (typeof payload.title === 'string') payload.title = payload.title.trim()
  if (typeof payload.content === 'string') payload.content = payload.content.trim()
  if (typeof payload.status === 'string') payload.status = payload.status.trim().toLowerCase()
  if (!payload.imageUrls.length) delete payload.imageUrls

  return payload
}

export async function fetchPublishedPosts({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  const { statusCode, data } = await safeJsonFetch(buildUrl(`/api/blog?${params.toString()}`), {
    method: 'GET',
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'blog_fetch_failed')
  }

  return data
}

export async function fetchPublishedPostBySlug(slug) {
  const { statusCode, data } = await safeJsonFetch(buildUrl(`/api/blog/${encodeURIComponent(slug)}`), {
    method: 'GET',
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'blog_post_fetch_failed')
  }

  return data
}

export async function fetchAdminPosts({ status = '', q = '', limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  if (status) params.set('status', status)
  if (q) params.set('q', q)

  const { statusCode, data } = await safeJsonFetch(buildUrl(`/api/admin/blog?${params.toString()}`), {
    method: 'GET',
    headers: {
      ...getAdminAuthHeaders(),
    },
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'admin_blog_fetch_failed')
  }

  return data
}

export async function fetchAdminPost(id) {
  const { statusCode, data } = await safeJsonFetch(buildUrl(`/api/admin/blog/${id}`), {
    method: 'GET',
    headers: {
      ...getAdminAuthHeaders(),
    },
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'admin_blog_post_fetch_failed')
  }

  return data
}

export async function createAdminPost(payload) {
  const body = sanitizeBlogPayload(payload)

  const { statusCode, data } = await safeJsonFetch(buildUrl('/api/admin/blog'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'admin_blog_create_failed')
  }

  return data
}

export async function updateAdminPost(id, payload) {
  const body = sanitizeBlogPayload(payload)

  const { statusCode, data } = await safeJsonFetch(buildUrl(`/api/admin/blog/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'admin_blog_update_failed')
  }

  return data
}

export async function deleteAdminPost(id) {
  const { statusCode, data } = await safeJsonFetch(buildUrl(`/api/admin/blog/${id}`), {
    method: 'DELETE',
    headers: {
      ...getAdminAuthHeaders(),
    },
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'admin_blog_delete_failed')
  }

  return data
}

export async function uploadAdminBlogCover(fileName, contentBase64) {
  const { statusCode, data } = await safeJsonFetch(buildUrl('/api/admin/blog/upload-cover'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(),
    },
    body: JSON.stringify({ fileName, contentBase64 }),
  })

  if (statusCode >= 400) {
    throw createHttpError(statusCode, data, 'admin_blog_upload_failed')
  }

  return data
}
