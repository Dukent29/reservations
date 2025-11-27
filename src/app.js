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
app.all("/payment-success.html", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "front", "payment-success.html"));
});

app.all("/payment-error.html", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "front", "payment-error.html"));
});

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
