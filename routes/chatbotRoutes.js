"use strict";

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const chatbotController = require("../controllers/chatbotController");

const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "chatbot_rate_limited" },
});

router.get("/chatbot/config", chatbotController.getChatbotConfig);
router.post("/chatbot/message", chatbotLimiter, chatbotController.postChatbotMessage);

module.exports = router;
