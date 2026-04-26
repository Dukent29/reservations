function normalizeAdminLoginPath(value) {
  const raw = String(value || '').trim()
  if (!raw) return '/admin/login'

  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/')
  if (collapsed === '/') return '/admin/login'

  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed
}

export const ADMIN_LOGIN_PATH = normalizeAdminLoginPath(
  import.meta.env.VITE_ADMIN_LOGIN_PATH || '/portal-9k3v7n/auth'
)

export function getAdminLoginLocation(query = undefined) {
  return {
    path: ADMIN_LOGIN_PATH,
    ...(query ? { query } : {}),
  }
}

export function getAdminLoginUrl(query = undefined) {
  const params = new URLSearchParams()
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
  }

  const search = params.toString()
  return search ? `${ADMIN_LOGIN_PATH}?${search}` : ADMIN_LOGIN_PATH
}
