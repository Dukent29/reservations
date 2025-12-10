// front/lib/http.js
// Small HTTP helper for JSON APIs, shared by front-end modules.

export const API_BASE = (function () {
  try {
    return window.location.port === "3000" ? "" : "http://localhost:3000";
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

