"use strict";

const httpError = require("../src/utils/httpError");
const {
  isContactMailConfigured,
  sendContactRequest,
} = require("../services/contactEmailService");

async function postContactRequest(req, res, next) {
  try {
    if (!isContactMailConfigured()) {
      throw httpError(503, "contact_mail_not_configured");
    }

    const result = await sendContactRequest(req.body || {});

    res.status(202).json({
      status: "ok",
      success: true,
      message: "contact_request_sent",
      message_id: result?.messageId || null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postContactRequest,
};
