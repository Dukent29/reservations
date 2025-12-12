"use strict";

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

const apiRoutes = require("../routes/api");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please slow down" },
});

app.use(compression());
app.use(express.json({ limit: "500kb" }));

// Systempay return URLs (Systempay envoie un POST ou un GET sur ces chemins)
// In the legacy front, these served static HTML pages.
// For the Vue app, we redirect to the SPA routes (running e.g. on http://localhost:5173).
const FRONT_BASE =
  process.env.FRONT_BASE_URL || "http://localhost:5173";

app.all("/payment/success", (_req, res) => {
  const target = `${FRONT_BASE.replace(/\/$/, "")}/payment/success`;
  return res.redirect(target);
});

app.all("/payment/error", (_req, res) => {
  const target = `${FRONT_BASE.replace(/\/$/, "")}/payment/error`;
  return res.redirect(target);
});

app.all("/payment-success.html", (_req, res) => {
  const target = `${FRONT_BASE.replace(/\/$/, "")}/payment/success`;
  return res.redirect(target);
});

app.all("/payment-error.html", (_req, res) => {
  const target = `${FRONT_BASE.replace(/\/$/, "")}/payment/error`;
  return res.redirect(target);
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

    const pathTarget = isFailure ? "/payment/error" : "/payment/success";
    const target = `${FRONT_BASE.replace(/\/$/, "")}${pathTarget}`;
    res.redirect(target);
  }
);

app.use(express.static(path.join(__dirname, "..", "front")));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api/search", searchLimiter);
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "front", "reservation.html"));
});

app.use("/api", apiRoutes);
app.use(errorHandler);

module.exports = app;
