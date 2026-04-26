"use strict";

function normalizeAdminLoginPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "/admin/login";

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, "/");
  if (collapsed === "/") return "/admin/login";

  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
}

function getAdminLoginPath() {
  return normalizeAdminLoginPath(
    process.env.ADMIN_LOGIN_PATH || process.env.VITE_ADMIN_LOGIN_PATH || "/admin/login"
  );
}

module.exports = {
  getAdminLoginPath,
  normalizeAdminLoginPath,
};
