// HTTP client and API base configuration for BedTrip UI.
// Mirrors the behavior from front/lib/http.js but in a reusable module.

export const API_BASE = (() => {
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

/**
 * safeJsonFetch
 * -------------
 * Wraps fetch and always returns a `{ statusCode, data }` object.
 * - `data` is parsed JSON when possible.
 * - If parsing fails, `data` contains `_raw` and `_parseError` fields.
 */
export async function safeJsonFetch(url, options = {}) {
  try {
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
  } catch (err) {
    if (!options?.skipServerDownRedirect && typeof window !== "undefined") {
      const currentPath = window.location.pathname || "";
      if (!currentPath.startsWith("/server-down")) {
        window.location.assign("/server-down");
      }
    }
    return {
      statusCode: 0,
      data: { error: "network_error", message: err?.message || "Network error" },
    };
  }
}
