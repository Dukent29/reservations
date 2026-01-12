// front/lib/http.js
// Small HTTP helper for JSON APIs, shared by front-end modules.

export const API_BASE = (function () {
  try {
    const { hostname, port, origin } = window.location;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    if (port === "3000") return "";
    if (isLocalhost) return "http://localhost:3000";
    return origin;
  } catch (_) {
    return "";
  }
})();

export async function safeJsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const statusCode = response.status;
  const rawText = await response.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (parseErr) {
    data = { _parseError: parseErr.message, _raw: rawText, _httpStatus: statusCode };
  }
  return { statusCode, data };
}

