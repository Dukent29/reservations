import { API_BASE, safeJsonFetch } from './httpClient'

/**
 * Cookie consent API client.
 *
 * Requests include credentials so signed HTTP cookies set by the backend are
 * stored by the browser, including when Vite runs on a different localhost port.
 */

export async function fetchCookieConsent() {
  const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/cookies/consent`, {
    credentials: 'include',
  })
  if (statusCode >= 400 || !data) {
    throw new Error(data?.error || 'cookie_consent_unavailable')
  }
  return data
}

export async function saveCookieConsent(payload) {
  const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/cookies/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload || {}),
  })
  if (statusCode >= 400 || !data) {
    throw new Error(data?.error || 'cookie_consent_save_failed')
  }
  return data
}
