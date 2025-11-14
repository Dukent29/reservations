"use strict";

function httpError(status, message, debug) {
  const error = new Error(message);
  error.http = status;
  if (debug) error.debug = debug;
  return error;
}

module.exports = httpError;
