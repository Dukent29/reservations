"use strict";

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

const apiRoutes = require("../routes/api");
const errorHandler = require("./middlewares/errorHandler");
const { enforceObjectBody } = require("./middlewares/validateRequest");
const { insertApiLog } = require("../utils/repo");

const app = express();

// Required when behind a reverse proxy (nginx, etc.) so express-rate-limit
// can use X-Forwarded-For for client IP. 1 = trust first proxy.
app.set("trust proxy", 1);

/**
 * Rate limit only search endpoints (as you had)
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please slow down" },
});

app.use(compression());
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: false })); // useful for return URLs, forms, etc.

/**
 * C O R S (keep as you had — although "*" in prod is risky)
 */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, X-UI-Target"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/**
 * --- FRONTEND CONFIG ---
 * We want Vue to be the default frontend, like your nginx root /dist.
 *
 * Vue build output should be here:
 *   bedtrip/BedTrip_ui/dist
 */
const vueDist = path.resolve(process.cwd(), "BedTrip_ui", "dist");
console.log("cwd =", process.cwd());
console.log("vueDist =", vueDist);
console.log("vueDist index exists? =", require("fs").existsSync(path.join(vueDist, "index.html")));


/**
 * Legacy static pages (optional fallback)
 * If you still want the old HTML pages available as fallback.
 */
const legacyFrontRoot = path.join(__dirname, "..", "front");

/**
 * Utility: do we have Vue dist available?
 * (Important: in CI/CD, dist might not exist if build step wasn’t run.)
 */
function hasVueDist() {
  try {
    // index.html must exist
    require("fs").accessSync(path.join(vueDist, "index.html"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: redirect to SPA route if Vue exists, else serve legacy file.
 */
function sendPaymentResult(req, res, vuePath, legacyFile) {
  if (hasVueDist()) {
    // Serve the SPA entry so the Vue router can render the right view.
    return res.sendFile(path.join(vueDist, "index.html"));
  }
  // Fallback: serve legacy static HTML pages if dist is missing
  return res.sendFile(path.join(legacyFrontRoot, legacyFile));
}

/**
 * --- PAYMENT RETURN URLS ---
 * Systempay / Kotan can hit these with GET or POST. Log each access to api_logs.
 */
app.all("/payment/success", (req, res) => {
  const url = req.originalUrl || `${req.path}${req.url || ""}`;
  insertApiLog({
    endpoint: `${req.method} /payment/success`,
    request: {
      method: req.method,
      url,
      query: req.query || {},
      body: req.method === "POST" && req.body ? req.body : undefined,
    },
    response: { _type: "page_serve", message: "Payment success page (SPA)" },
    statusCode: 200,
  }).catch((e) => console.error("[app] payment/success api_log insert failed:", e.message));
  return sendPaymentResult(req, res, "/payment/success", "payment-success.html");
});

app.all("/payment/error", (req, res) => {
  return sendPaymentResult(req, res, "/payment/error", "payment-error.html");
});

/**
 * Keep old legacy URLs if something still calls them
 */
app.all("/payment-success.html", (req, res) => {
  return res.sendFile(path.join(legacyFrontRoot, "payment-success.html"));
});

app.all("/payment-error.html", (req, res) => {
  return res.sendFile(path.join(legacyFrontRoot, "payment-error.html"));
});

/**
 * Floa return URL: POST x-www-form-urlencoded with `status`
 */
app.all("/floa-return", (req, res) => {
  const rawStatus = (req.body && req.body.status) || req.query.status || "";
  const status = String(rawStatus).toLowerCase();
  const statusToken =
    (req.body && req.body.status_token) ||
    (req.query && req.query.status_token) ||
    "";

  const isFailure =
    status === "refusal" ||
    status === "refused" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "abandoned" ||
    status === "failed";

  const source =
    (req.body && typeof req.body === "object" ? req.body : {}) || {};
  const query =
    (req.query && typeof req.query === "object" ? req.query : {}) || {};

  const rawPartner =
    source.partner_order_id ||
    query.partner_order_id ||
    source.merchantReference ||
    query.merchantReference ||
    source.merchant_reference ||
    query.merchant_reference ||
    source.reference ||
    query.reference ||
    source.orderRef ||
    query.orderRef ||
    source.order_reference ||
    query.order_reference ||
    "";

  let partnerOrderId = rawPartner ? String(rawPartner).trim() : "";
  const uuidMatch = partnerOrderId.match(/^([0-9a-fA-F-]{36})-/);
  if (uuidMatch && uuidMatch[1]) {
    partnerOrderId = uuidMatch[1];
  }

  const target = isFailure ? "/payment/error" : "/payment/success";
  if (partnerOrderId || statusToken) {
    const params = new URLSearchParams({
      partner_order_id: partnerOrderId || "",
      status_token: statusToken || "",
    });
    return res.redirect(`${target}?${params.toString()}`);
  }
  return res.redirect(target);
});

/**
 * --- API ROUTES FIRST ---
 * Important: define API BEFORE serving SPA fallback.
 */
app.use("/api/search", searchLimiter);
app.use("/api", enforceObjectBody);
app.use("/api", apiRoutes);

/**
 * --- SERVE VUE AS DEFAULT FRONTEND ---
 * Equivalent to your nginx:
 *   root .../dist
 *   location / { try_files $uri $uri/ /index.html; }
 */
if (hasVueDist()) {
  // Serve static assets from Vue dist (js/css/assets)
  app.use(express.static(vueDist));

  // SPA fallback (history mode): any non-API route returns index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    return res.sendFile(path.join(vueDist, "index.html"));
  });
} else {
  /**
   * If Vue dist is missing, don't crash the app.
   * Provide a clear message + optionally serve legacy front static.
   */
  app.use(express.static(legacyFrontRoot));

  app.get("/", (_req, res) => {
    return res
      .status(500)
      .send(
        "Frontend build not found (BedTrip_ui/dist/index.html). " +
          "Ensure CI/CD runs `npm run build` in BedTrip_ui before starting the API."
      );
  });
}

/**
 * --- ERROR HANDLER LAST ---
 */
app.use(errorHandler);

module.exports = app;
