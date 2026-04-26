import { API_BASE, safeJsonFetch } from './httpClient.js'
import { getHotelInfoIdentity } from './hotelInfoService.js'

const poiCache = new Map()

function buildIdentityKey(identity) {
  if (!identity?.value) return null
  return `${identity.type}:${identity.value}`
}

export async function fetchHotelPois(source, options = {}) {
  const identity = getHotelInfoIdentity(source)
  if (!identity?.value) return { hotel: null, filters: null, count: 0, pois: [] }

  const query = new URLSearchParams()
  if (identity.type === 'hid') query.set('hid', String(identity.value))
  else query.set('id', String(identity.value))

  if (options.subtype) query.set('subtype', String(options.subtype))
  if (options.maxDistanceM) query.set('max_distance_m', String(options.maxDistanceM))
  if (options.limit) query.set('limit', String(options.limit))
  if (options.featured) query.set('featured', 'true')

  const cacheKey = query.toString()
  if (poiCache.has(cacheKey)) {
    return poiCache.get(cacheKey)
  }

  const requestPromise = (async () => {
    const endpoint = `${API_BASE}/api/hotel/pois?${query.toString()}`
    const { statusCode, data } = await safeJsonFetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (statusCode >= 400 || !data || data.error) {
      throw new Error(data?.error || data?._raw || 'Hotel POI lookup failed')
    }

    return {
      hotel: data.hotel || null,
      filters: data.filters || null,
      count: Array.isArray(data.pois) ? data.pois.length : 0,
      pois: Array.isArray(data.pois) ? data.pois : [],
    }
  })()

  poiCache.set(cacheKey, requestPromise)
  try {
    const response = await requestPromise
    poiCache.set(cacheKey, response)
    return response
  } catch (error) {
    poiCache.delete(cacheKey)
    throw error
  }
}

export async function fetchHotelPoisBatch(sources = [], options = {}) {
  const identities = (Array.isArray(sources) ? sources : [])
    .map((source) => ({ source, identity: getHotelInfoIdentity(source) }))
    .filter((entry) => entry.identity?.value)

  if (!identities.length) {
    return { filters: null, hotels: [], byIdentity: {} }
  }

  const hids = []
  const ids = []
  const seen = new Set()
  identities.forEach(({ identity }) => {
    const key = buildIdentityKey(identity)
    if (!key || seen.has(key)) return
    seen.add(key)
    if (identity.type === 'hid') hids.push(identity.value)
    else ids.push(identity.value)
  })

  const cacheKey = JSON.stringify({
    hids,
    ids,
    subtype: options.subtype || null,
    maxDistanceM: options.maxDistanceM || null,
    limitPerHotel: options.limitPerHotel || null,
    featured: Boolean(options.featured),
  })
  if (poiCache.has(cacheKey)) {
    return poiCache.get(cacheKey)
  }

  const requestPromise = (async () => {
    const endpoint = `${API_BASE}/api/hotel/pois/batch`
    const body = {}
    if (hids.length) body.hids = hids
    if (ids.length) body.ids = ids
    if (options.subtype) body.subtype = String(options.subtype)
    if (options.maxDistanceM) body.max_distance_m = Number(options.maxDistanceM)
    if (options.limitPerHotel) body.limit_per_hotel = Number(options.limitPerHotel)
    if (options.featured) body.featured = true

    const { statusCode, data } = await safeJsonFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (statusCode >= 400 || !data || data.error) {
      throw new Error(data?.error || data?._raw || 'Hotel POI batch lookup failed')
    }

    const hotels = Array.isArray(data.hotels) ? data.hotels : []
    const byIdentity = {}
    hotels.forEach((hotel) => {
      if (hotel?.hid !== undefined && hotel?.hid !== null) {
        byIdentity[`hid:${hotel.hid}`] = Array.isArray(hotel.pois) ? hotel.pois : []
      }
      if (hotel?.id) {
        byIdentity[`id:${hotel.id}`] = Array.isArray(hotel.pois) ? hotel.pois : []
      }
    })

    return {
      filters: data.filters || null,
      hotels,
      byIdentity,
    }
  })()

  poiCache.set(cacheKey, requestPromise)
  try {
    const response = await requestPromise
    poiCache.set(cacheKey, response)
    return response
  } catch (error) {
    poiCache.delete(cacheKey)
    throw error
  }
}

export function getHotelPoisFromBatch(batchResponse, source) {
  const identity = getHotelInfoIdentity(source)
  const key = buildIdentityKey(identity)
  if (!key) return []
  return batchResponse?.byIdentity?.[key] || []
}
