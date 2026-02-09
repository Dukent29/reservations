"use strict";

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const apiRoutes = require("../routes/api");
const errorHandler = require("./middlewares/errorHandler");
const { enforceObjectBody } = require("./middlewares/validateRequest");

const app = express();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please slow down" },
});

app.use(compression());
app.use(express.json({ limit: "500kb" }));

// Systempay return URLs (Systempay envoie un POST ou un GET sur ces chemins)
// Default frontend is now the Vue app build.
const vueDist = path.join(__dirname, "..", "BedTrip_ui", "dist");
const hasVueFront = fs.existsSync(path.join(vueDist, "index.html"));
const frontRoot = path.join(__dirname, "..", "front");
const vueIndex = path.join(vueDist, "index.html");

function detectUiChoice(req) {
  const ui = req.query?.ui || req.body?.ui || req.headers["x-ui-target"] || "";
  const normalized = String(ui).trim().toLowerCase();
  if (["front", "legacy", "classic"].includes(normalized)) return "legacy";
  if (["bedtrip", "spa", "vue"].includes(normalized)) return "spa";
  return null;
}

function sendVueIndex(res) {
  return res.sendFile(vueIndex);
}

function redirectOrSend(req, res, vuePath, legacyFile, options = {}) {
  const { forceLegacy = false } = options;
  const uiChoice = detectUiChoice(req);
  const wantsLegacy = forceLegacy || uiChoice === "legacy" || !hasVueFront;
  if (!wantsLegacy && (uiChoice === "spa" || hasVueFront)) {
    return res.redirect(vuePath);
  }
  return res.sendFile(path.join(frontRoot, legacyFile));
}

app.all("/payment/success", (req, res) => {
  if (hasVueFront) return sendVueIndex(res);
  return redirectOrSend(req, res, "/payment/success", "payment-success.html");
});

app.all("/payment/error", (req, res) => {
  if (hasVueFront) return sendVueIndex(res);
  return redirectOrSend(req, res, "/payment/error", "payment-error.html");
});

app.all("/payment-success.html", (req, res) => {
  if (hasVueFront) return res.redirect("/payment/success");
  return redirectOrSend(req, res, "/payment/success", "payment-success.html", { forceLegacy: true });
});

app.all("/payment-error.html", (req, res) => {
  if (hasVueFront) return res.redirect("/payment/error");
  return redirectOrSend(req, res, "/payment/error", "payment-error.html", { forceLegacy: true });
});

// Floa return URL (used for both success and refusal)
// Floa sends a POST with application/x-www-form-urlencoded fields, including "status".
// We inspect status and redirect to the appropriate static page.
app.all(
  "/floa-return",
  express.urlencoded({ extended: false }),
  (req, res) => {
    const rawStatus = (req.body && req.body.status) || req.query.status || "";
    const status = String(rawStatus).toLowerCase();

    const isFailure =
      status === "refusal" ||
      status === "refused" ||
      status === "canceled" ||
      status === "cancelled" ||
      status === "abandoned" ||
      status === "failed";

    const vuePath = isFailure ? "/payment/error" : "/payment/success";
    const legacyFile = isFailure ? "payment-error.html" : "payment-success.html";
    if (hasVueFront) return res.redirect(vuePath);
    return redirectOrSend(req, res, vuePath, legacyFile);
  }
);

app.use("/front", express.static(frontRoot));
if (hasVueFront) {
  app.use(express.static(vueDist));
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api/search", searchLimiter);
app.get("/", (_req, res) => {
  if (hasVueFront) return sendVueIndex(res);
  return res.sendFile(path.join(__dirname, "..", "front", "reservation.html"));
});

app.use("/api", enforceObjectBody);
app.use("/api", apiRoutes);

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (hasVueFront) return sendVueIndex(res);
  return next();
});

app.use(errorHandler);

module.exports = app;
