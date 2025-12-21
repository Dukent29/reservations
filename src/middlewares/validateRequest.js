"use strict";

const httpError = require("../utils/httpError");

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function pushError(errors, path, message) {
  errors.push({ path, message });
}

function validatePrimitive(value, types) {
  return types.some((type) => {
    if (type === "array") return Array.isArray(value);
    if (type === "object") return isPlainObject(value);
    if (type === "null") return value === null;
    return typeof value === type;
  });
}

function validateValue(value, rules, path, errors) {
  if (rules.allowAny) return;

  if (value === undefined || value === null) {
    if (rules.required) {
      pushError(errors, path, "is required");
    }
    return;
  }

  const types = Array.isArray(rules.type) ? rules.type : [rules.type || "any"];
  if (types[0] !== "any" && !validatePrimitive(value, types)) {
    pushError(errors, path, `must be ${types.join(" or ")}`);
    return;
  }

  if (typeof value === "string") {
    if (Number.isFinite(rules.minLen) && value.length < rules.minLen) {
      pushError(errors, path, `must be at least ${rules.minLen} characters`);
    }
    if (Number.isFinite(rules.maxLen) && value.length > rules.maxLen) {
      pushError(errors, path, `must be at most ${rules.maxLen} characters`);
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      pushError(errors, path, "has invalid format");
    }
    if (Array.isArray(rules.enum) && !rules.enum.includes(value)) {
      pushError(errors, path, "must be one of the allowed values");
    }
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      pushError(errors, path, "must be a finite number");
    } else {
      if (Number.isFinite(rules.min) && value < rules.min) {
        pushError(errors, path, `must be >= ${rules.min}`);
      }
      if (Number.isFinite(rules.max) && value > rules.max) {
        pushError(errors, path, `must be <= ${rules.max}`);
      }
      if (rules.integer && !Number.isInteger(value)) {
        pushError(errors, path, "must be an integer");
      }
    }
  }

  if (Array.isArray(value)) {
    if (Number.isFinite(rules.minLen) && value.length < rules.minLen) {
      pushError(errors, path, `must have at least ${rules.minLen} items`);
    }
    if (Number.isFinite(rules.maxLen) && value.length > rules.maxLen) {
      pushError(errors, path, `must have at most ${rules.maxLen} items`);
    }
    if (rules.items) {
      value.forEach((item, index) => {
        validateValue(item, rules.items, `${path}[${index}]`, errors);
      });
    }
  }

  if (isPlainObject(value) && rules.shape) {
    validateObject(value, rules.shape, path, errors);
  }
}

function validateObject(target, shape, path, errors) {
  if (!isPlainObject(target)) {
    pushError(errors, path, "must be an object");
    return;
  }
  Object.keys(shape).forEach((key) => {
    const rules = shape[key];
    validateValue(target[key], rules, `${path}.${key}`, errors);
  });
}

function validate(schema = {}) {
  return (req, _res, next) => {
    const errors = [];

    if (schema.body) {
      validateObject(req.body || {}, schema.body, "body", errors);
    }
    if (schema.query) {
      validateObject(req.query || {}, schema.query, "query", errors);
    }
    if (schema.params) {
      validateObject(req.params || {}, schema.params, "params", errors);
    }

    if (typeof schema.custom === "function") {
      schema.custom(req, errors);
    }

    if (errors.length) {
      return next(httpError(400, "validation_error", { errors }));
    }
    next();
  };
}

function enforceObjectBody(req, _res, next) {
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json") && !contentType.includes("application/x-www-form-urlencoded")) {
    return next();
  }

  if (req.body === undefined || req.body === null) return next();
  if (!isPlainObject(req.body)) {
    return next(httpError(400, "invalid_request_body", { reason: "body_must_be_object" }));
  }
  return next();
}

module.exports = {
  validate,
  enforceObjectBody,
};
