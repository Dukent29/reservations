import { API_BASE, safeJsonFetch } from './httpClient'
import { getAdminAuthHeaders, clearAdminToken } from './adminAuth'

function buildUrl(path) {
  return `${API_BASE}${path}`
}

function createHttpError(statusCode, data, fallback = 'admin_request_failed') {
  const error = new Error(data?.error || fallback)
  error.statusCode = statusCode
  error.data = data
  return error
}

async function safeAdminRequest(path, options = {}, fallback = 'admin_request_failed') {
  const { statusCode, data } = await safeJsonFetch(buildUrl(path), {
    ...options,
    headers: {
      ...getAdminAuthHeaders(),
      ...(options.headers || {}),
    },
  })

  if (statusCode >= 400) {
    if (statusCode === 401) clearAdminToken()
    throw createHttpError(statusCode, data, fallback)
  }

  return data
}

export function fetchAdminOverview({ period = 'week', start = '', end = '' } = {}) {
  const params = new URLSearchParams()
  if (period) params.set('period', period)
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  return safeAdminRequest(
    `/api/admin/overview${params.toString() ? `?${params.toString()}` : ''}`,
    { method: 'GET' },
    'admin_overview_failed'
  )
}

export function fetchAdminNotifications(limit = 12) {
  return safeAdminRequest(
    `/api/admin/notifications?limit=${encodeURIComponent(limit)}`,
    { method: 'GET' },
    'admin_notifications_failed'
  )
}

export function markAdminNotificationRead(id) {
  return safeAdminRequest(
    `/api/admin/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
    'admin_notification_read_failed'
  )
}

export function fetchAdminPayments({ limit = 15, offset = 0 } = {}) {
  return safeAdminRequest(
    `/api/admin/payments?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    { method: 'GET' },
    'admin_payments_failed'
  )
}

export function fetchAdminUsers({ limit = 15, offset = 0 } = {}) {
  return safeAdminRequest(
    `/api/admin/users?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    { method: 'GET' },
    'admin_users_failed'
  )
}

export function updateAdminUserRole(userId, role) {
  return safeAdminRequest(
    `/api/admin/users/${encodeURIComponent(userId)}/role`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    },
    'admin_user_role_update_failed'
  )
}

export function fetchAdminReservations({ limit = 15, offset = 0, q = '' } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (q) params.set('q', q)
  return safeAdminRequest(
    `/api/admin/reservations?${params.toString()}`,
    { method: 'GET' },
    'admin_reservations_failed'
  )
}

export function fetchAdminPromoCodes({ limit = 50, offset = 0 } = {}) {
  return safeAdminRequest(
    `/api/admin/promo-codes?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    { method: 'GET' },
    'admin_promo_codes_failed'
  )
}

export function createAdminPromoCode(payload) {
  return safeAdminRequest(
    '/api/admin/promo-codes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'admin_promo_code_create_failed'
  )
}

export function updateAdminPromoCode(id, payload) {
  return safeAdminRequest(
    `/api/admin/promo-codes/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'admin_promo_code_update_failed'
  )
}

export function deleteAdminPromoCode(id) {
  return safeAdminRequest(
    `/api/admin/promo-codes/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'admin_promo_code_delete_failed'
  )
}

export async function downloadAdminVoucher(partnerOrderId, language = 'fr') {
  const response = await fetch(
    buildUrl(
      `/api/admin/reservations/${encodeURIComponent(partnerOrderId)}/voucher?language=${encodeURIComponent(language)}`
    ),
    {
      method: 'GET',
      headers: {
        ...getAdminAuthHeaders(),
      },
    }
  )

  if (!response.ok) {
    let payload = null
    try {
      payload = await response.json()
    } catch (_) {
      payload = null
    }
    throw createHttpError(response.status, payload, 'admin_voucher_download_failed')
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  const filename = filenameMatch?.[1] || `bedtrip-voucher-${partnerOrderId}.pdf`

  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)

  return { status: 'ok', filename }
}
