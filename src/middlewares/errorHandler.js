"use strict";

function errorHandler(err, req, res, _next) {
  console.error(`[API Error] ${req.method} ${req.originalUrl}`, err);
  const status = err?.http || err?.statusCode || err?.status || 500;
  const message = err?.message || err?.error || "Internal Server Error";
  const debug = err?.debug || null;

  res.status(status).json({
    error: message,
    status: err?.status || "error",
    http: status,
    request_id: err?.request_id || debug?.request_id || null,
    debug,
  });
}

module.exports = errorHandler;
