// HTTP client and API base configuration for BedTrip UI.
// Mirrors the behavior from front/lib/http.js but in a reusable module.

export const API_BASE = (() => {
  try {
    // In dev, the Vue app and API can be on the same origin (Vite dev server).
    // In that case we let relative URLs be used.
    return window.location.port === "3000" ? "" : "http://localhost:3000";
  } catch (_) {
    return "";
  }
})();

/**
 * safeJsonFetch
 * -------------
 * Wraps fetch and always returns a `{ statusCode, data }` object.
 * - `data` is parsed JSON when possible.
 * - If parsing fails, `data` contains `_raw` and `_parseError` fields.
 */
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

