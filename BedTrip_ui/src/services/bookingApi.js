// Booking API service for BedTrip UI.
// Vue equivalent of front/lib/bookingApi.js.

import { API_BASE, safeJsonFetch } from './httpClient.js'

function buildError(label, statusCode, data) {
  const baseMessage =
    data?.error ||
    data?.message ||
    (data?.debug && (data.debug.error || data.debug.reason)) ||
    `HTTP ${statusCode}`
  const detail =
    data && typeof data === 'object' ? JSON.stringify(data, null, 2) : String(baseMessage)
  const error = new Error(`[${label}] ${baseMessage}`)
  // Attach extra detail for debug panels
  error._detail = detail
  return error
}

export async function requestBookingForm(prebookToken) {
  const payload = { prebook_token: prebookToken }
  const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/booking/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (statusCode >= 400 || data?.error) {
    throw buildError('/api/booking/form', statusCode, data)
  }
  return data || {}
}

export async function createFloaHotelDeal(body) {
  const { statusCode, data } = await safeJsonFetch(
    `${API_BASE}/api/payments/floa/hotel/deal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (statusCode >= 400 || data?.status === 'nok' || data?.error) {
    throw buildError('/api/payments/floa/hotel/deal', statusCode, data)
  }
  return data || {}
}

export async function finalizeFloaDeal(dealReference, payload) {
  const { statusCode, data } = await safeJsonFetch(
    `${API_BASE}/api/payments/floa/deal/${encodeURIComponent(dealReference)}/finalize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (statusCode >= 400 || data?.error) {
    throw buildError('/api/payments/floa/deal/finalize', statusCode, data)
  }
  return data || {}
}

