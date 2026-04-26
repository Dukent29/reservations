import { API_BASE, safeJsonFetch } from './httpClient'
import { getAdminLoginUrl } from '../utils/adminAccess'

const TOKEN_STORAGE_KEY = 'bedtrip_admin_token'
const ADMIN_IDLE_TIMEOUT_MS = 60 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
let inactivityTimer = null
let listenersBound = false

function buildUrl(path) {
  return `${API_BASE}${path}`
}

function clearInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer)
    inactivityTimer = null
  }
}

function scheduleInactivityLogout() {
  if (typeof window === 'undefined') return
  clearInactivityTimer()

  if (!getAdminToken()) return

  inactivityTimer = window.setTimeout(() => {
    clearAdminToken()
    if (window.location.pathname.startsWith('/admin')) {
      window.location.assign(getAdminLoginUrl({ reason: 'inactive' }))
    }
  }, ADMIN_IDLE_TIMEOUT_MS)
}

function handleActivity() {
  if (!getAdminToken()) return
  scheduleInactivityLogout()
}

function bindActivityListeners() {
  if (typeof window === 'undefined' || listenersBound) return
  for (const eventName of ACTIVITY_EVENTS) {
    window.addEventListener(eventName, handleActivity, { passive: true })
  }
  listenersBound = true
}

export function startAdminInactivityWatcher() {
  bindActivityListeners()
  scheduleInactivityLogout()
}

export function stopAdminInactivityWatcher() {
  clearInactivityTimer()
}

export function getAdminToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch (_) {
    return ''
  }
}

export function setAdminToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      stopAdminInactivityWatcher()
      return
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    startAdminInactivityWatcher()
  } catch (_) {
    // no-op
  }
}

export function clearAdminToken() {
  setAdminToken('')
}

export function getAdminAuthHeaders() {
  const token = getAdminToken()
  if (!token) return {}
  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function loginAdmin(email, password) {
  const { statusCode, data } = await safeJsonFetch(buildUrl('/api/admin/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (statusCode >= 400) {
    const error = new Error(data?.error || 'admin_login_failed')
    error.statusCode = statusCode
    error.data = data
    throw error
  }

  if (data?.token) {
    setAdminToken(data.token)
  }

  return data
}

export async function fetchAdminMe() {
  const token = getAdminToken()
  if (!token) return null

  const { statusCode, data } = await safeJsonFetch(buildUrl('/api/admin/auth/me'), {
    method: 'GET',
    headers: {
      ...getAdminAuthHeaders(),
    },
  })

  if (statusCode >= 400) {
    if (statusCode === 401) clearAdminToken()
    const error = new Error(data?.error || 'admin_me_failed')
    error.statusCode = statusCode
    error.data = data
    throw error
  }

  startAdminInactivityWatcher()

  return data
}

export async function logoutAdmin() {
  const token = getAdminToken()
  if (!token) return

  await safeJsonFetch(buildUrl('/api/admin/auth/logout'), {
    method: 'POST',
    headers: {
      ...getAdminAuthHeaders(),
    },
  })

  clearAdminToken()
}
