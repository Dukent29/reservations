import { API_BASE, safeJsonFetch } from './httpClient.js'

const hotelInfoCache = new Map()

function pickFirstString(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

function normalizeNumericId(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

export function getHotelInfoIdentity(source) {
  if (!source) return null

  if (typeof source === 'string' || typeof source === 'number') {
    const hid = normalizeNumericId(source)
    return hid !== null
      ? { type: 'hid', value: hid }
      : { type: 'id', value: String(source).trim() }
  }

  const hid = normalizeNumericId(
    source.hid ??
    source.hotel_id ??
    source.hotelId ??
    source.rg_ext?.hid ??
    source.rg_ext?.hotel_id,
  )
  if (hid !== null) {
    return { type: 'hid', value: hid }
  }

  const id = pickFirstString(
    source.id,
    source.hotel_id,
    source.hotelId,
    source.rg_ext?.id,
  )
  return id ? { type: 'id', value: id } : null
}

function normalizeHotelInfo(info) {
  return {
    name: pickFirstString(
      info?.name,
      info?.hotel_name,
      info?.full_name,
    ),
    address: pickFirstString(
      info?.address,
      info?.address_full,
      info?.location?.address,
    ),
    raw: info || null,
  }
}

export async function fetchHotelInfoSummary(source, options = {}) {
  const identity = getHotelInfoIdentity(source)
  if (!identity?.value) return null

  const language = String(options.language || 'fr').trim() || 'fr'
  const cacheKey = `${identity.type}:${identity.value}|${language}`
  if (hotelInfoCache.has(cacheKey)) {
    return hotelInfoCache.get(cacheKey)
  }

  const payload = { language }
  if (identity.type === 'hid') payload.hid = identity.value
  else payload.id = identity.value

  const requestPromise = (async () => {
    const endpoint = `${API_BASE}/api/hotel/info`
    const { statusCode, data } = await safeJsonFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (statusCode >= 400 || !data || data.error) {
      throw new Error(data?.error || data?._raw || 'Hotel info lookup failed')
    }
    return normalizeHotelInfo(data?.info || data?.result || data)
  })()

  hotelInfoCache.set(cacheKey, requestPromise)
  try {
    const info = await requestPromise
    hotelInfoCache.set(cacheKey, info)
    return info
  } catch (error) {
    hotelInfoCache.delete(cacheKey)
    throw error
  }
}
