import { API_BASE, safeJsonFetch } from './httpClient.js'

function buildContactError(statusCode, data) {
  const message = data?.error || data?.message || `HTTP ${statusCode}`
  const error = new Error(message)
  error.statusCode = statusCode
  error.data = data
  return error
}

export async function sendContactRequest(payload) {
  const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })

  if (statusCode >= 400 || data?.error || data?.status === 'error') {
    throw buildContactError(statusCode, data)
  }

  return data || {}
}
