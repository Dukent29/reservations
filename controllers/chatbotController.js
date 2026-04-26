"use strict";

const chatbotService = require("../services/chatbotService");

function getChatbotConfig(_req, res, next) {
  try {
    res.json({ status: "ok", ...chatbotService.getPublicConfig() });
  } catch (error) {
    next(error);
  }
}

async function postChatbotMessage(req, res, next) {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Message is required",
      });
    }
    const result = await chatbotService.answerMessage(req.body || {});
    res.json({ status: "ok", success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getChatbotConfig,
  postChatbotMessage,
};
