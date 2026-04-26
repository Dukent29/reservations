"use strict";

const nodemailer = require("nodemailer");

const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
  SMTP_PORT === 465;
const MAIL_FROM = String(
  process.env.MAIL_FROM ||
    process.env.VOUCHER_EMAIL_FROM ||
    process.env.KOTAN_MERCHANT_EMAIL ||
    "",
).trim();
const CONTACT_RECIPIENT_CANDIDATES = [
  ["CONTACT_EMAIL_TO", process.env.CONTACT_EMAIL_TO],
  ["SUPPORT_EMAIL", process.env.SUPPORT_EMAIL],
  ["MAIL_TO", process.env.MAIL_TO],
  ["MAIL_REPLY_TO", process.env.MAIL_REPLY_TO],
  ["KOTAN_MERCHANT_EMAIL", process.env.KOTAN_MERCHANT_EMAIL],
  ["MAIL_FROM", process.env.MAIL_FROM],
];
const CONTACT_EMAIL_TO_ENTRY =
  CONTACT_RECIPIENT_CANDIDATES.find(([, value]) => String(value || "").trim()) ||
  [];
const CONTACT_EMAIL_TO_SOURCE = CONTACT_EMAIL_TO_ENTRY[0] || "";
const CONTACT_EMAIL_TO = String(CONTACT_EMAIL_TO_ENTRY[1] || "").trim();
const DEFAULT_REPLY_TO = String(process.env.MAIL_REPLY_TO || MAIL_FROM || "").trim();
const SUBJECT_PREFIX = String(
  process.env.CONTACT_EMAIL_SUBJECT_PREFIX || "[BedTrip contact]",
).trim();

const TOPIC_LABELS = {
  reservation: "A propos d'une reservation",
  payment: "Paiement ou facture",
  cancellation: "Annulation ou remboursement",
  general: "Question generale",
  partnership: "Professionnels et partenaires",
};

const RESERVATION_REASON_LABELS = {
  information: "Informations sur une reservation",
  modify_booking: "Modifier une reservation",
  cancel_refund: "Annulation ou remboursement",
  voucher_confirmation: "Voucher ou confirmation",
  payment_invoice: "Paiement ou facture",
  arrival_time: "Arrivee tardive ou check-in",
  other: "Autre demande",
};

let transporterInstance = null;

function isContactMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && MAIL_FROM && CONTACT_EMAIL_TO);
}

function getTransporter() {
  if (!isContactMailConfigured()) {
    throw new Error("contact_mail_transport_not_configured");
  }
  if (transporterInstance) return transporterInstance;

  const transportConfig = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
  };

  if (SMTP_USER || SMTP_PASS) {
    transportConfig.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS,
    };
  }

  transporterInstance = nodemailer.createTransport(transportConfig);
  return transporterInstance;
}

function cleanText(value, maxLength) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!Number.isFinite(maxLength) || normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength).trim();
}

function cleanSingleLine(value, maxLength) {
  return cleanText(value, maxLength).replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function buildDetailRow(label, value, options = {}) {
  const displayValue = value || "Non renseigne";
  const valueHtml = options.isHtml ? displayValue : escapeHtml(displayValue);

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;width:34%;vertical-align:top">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:15px;font-weight:600;vertical-align:top">
        ${valueHtml}
      </td>
    </tr>
  `;
}

function formatSubmittedAt() {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString();
  }
}

function getTopicLabel(topic) {
  return TOPIC_LABELS[topic] || TOPIC_LABELS.general;
}

function getReservationReasonLabel(reason) {
  return RESERVATION_REASON_LABELS[reason] || RESERVATION_REASON_LABELS.other;
}

function normalizeContactPayload(payload = {}) {
  const topic = cleanSingleLine(payload.topic, 40) || "general";
  const reservationReason = cleanSingleLine(payload.reservation_reason, 60);

  return {
    topic,
    topicLabel: getTopicLabel(topic),
    reservationReason,
    reservationReasonLabel: getReservationReasonLabel(reservationReason),
    reservationReference: cleanSingleLine(payload.reservation_reference, 120),
    name: cleanSingleLine(payload.name, 120),
    email: cleanSingleLine(payload.email, 320).toLowerCase(),
    phone: cleanSingleLine(payload.phone, 40),
    subject: cleanSingleLine(payload.subject, 160),
    message: cleanText(payload.message, 3000),
  };
}

function buildSubject(contact) {
  const reason =
    contact.topic === "reservation"
      ? contact.reservationReasonLabel
      : contact.topicLabel;
  const customSubject = contact.subject ? ` - ${contact.subject}` : "";
  return `${SUBJECT_PREFIX} ${reason}${customSubject}`;
}

function buildTextBody(contact) {
  const lines = [
    "Nouvelle demande de contact BedTrip",
    "",
    `Type: ${contact.topicLabel}`,
  ];

  if (contact.topic === "reservation") {
    lines.push(`Raison: ${contact.reservationReasonLabel}`);
    lines.push(
      `Reference reservation: ${contact.reservationReference || "Non renseignee"}`,
    );
  }

  lines.push(
    `Nom: ${contact.name}`,
    `Email: ${contact.email}`,
    `Telephone: ${contact.phone || "Non renseigne"}`,
    `Sujet: ${contact.subject || "Non renseigne"}`,
    "",
    "Message:",
    contact.message,
  );

  return lines.join("\n");
}

function buildHtmlBody(contact) {
  const safeEmail = escapeHtml(contact.email);
  const safePhone = escapeHtml(contact.phone || "");
  const phoneHref = escapeHtml(String(contact.phone || "").replace(/[^\d+]/g, ""));
  const replySubject = encodeURIComponent(`Re: ${buildSubject(contact)}`);
  const submittedAt = formatSubmittedAt();
  const reasonLabel =
    contact.topic === "reservation"
      ? contact.reservationReasonLabel
      : contact.topicLabel;
  const reservationRows =
    contact.topic === "reservation"
      ? [
          buildDetailRow("Raison", contact.reservationReasonLabel),
          buildDetailRow(
            "Reference reservation",
            contact.reservationReference || "Non renseignee",
          ),
        ].join("")
      : "";
  const phoneButton = contact.phone
    ? `
      <td style="padding:0 0 10px 10px">
        <a href="tel:${phoneHref}" style="display:inline-block;background:#ffffff;color:#a5141e;border:1px solid #f0b5ba;border-radius:8px;padding:12px 16px;text-decoration:none;font-size:14px;font-weight:800">
          Appeler
        </a>
      </td>
    `
    : "";

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
          Nouvelle demande ${escapeHtml(reasonLabel)} de ${escapeHtml(contact.name || "client BedTrip")}.
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f6fb">
          <tr>
            <td align="center" style="padding:32px 16px">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;max-width:720px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 46px rgba(15,23,42,.10)">
                <tr>
                  <td style="height:6px;background:#a5141e;font-size:1px;line-height:1px">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 30px 22px;background:#ffffff">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
                      <tr>
                        <td style="vertical-align:top">
                          <div style="display:inline-block;background:#a5141e;color:#ffffff;border-radius:8px;padding:8px 10px;font-size:16px;font-weight:900;letter-spacing:.02em">
                            BedTrip
                          </div>
                        </td>
                        <td align="right" style="vertical-align:top;color:#64748b;font-size:13px;line-height:1.4">
                          ${escapeHtml(submittedAt)}<br>
                          <span style="color:#94a3b8">Formulaire contact</span>
                        </td>
                      </tr>
                    </table>

                    <h1 style="margin:28px 0 10px;color:#111827;font-size:28px;line-height:1.15;font-weight:800">
                      Nouvelle demande de contact
                    </h1>
                    <p style="margin:0;color:#475569;font-size:15px;line-height:1.6">
                      ${escapeHtml(contact.name)} a envoye une demande depuis la page contact BedTrip.
                    </p>

                    <div style="margin-top:18px">
                      <span style="display:inline-block;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:800">
                        ${escapeHtml(reasonLabel)}
                      </span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 30px 10px">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                      <tr>
                        <td style="padding:0 0 10px 0">
                          <a href="mailto:${safeEmail}?subject=${replySubject}" style="display:inline-block;background:#111827;color:#ffffff;border:1px solid #111827;border-radius:8px;padding:12px 16px;text-decoration:none;font-size:14px;font-weight:800">
                            Repondre par email
                          </a>
                        </td>
                        ${phoneButton}
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 30px 28px">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
                      <tr>
                        <td style="padding:22px 22px 8px">
                          <h2 style="margin:0 0 4px;color:#111827;font-size:16px;line-height:1.35;font-weight:900">
                            Informations client
                          </h2>
                          <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5">
                            Donnees envoyees par le formulaire public.
                          </p>
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
                            ${buildDetailRow("Type", contact.topicLabel)}
                            ${reservationRows}
                            ${buildDetailRow("Nom", contact.name)}
                            ${buildDetailRow(
                              "Email",
                              `<a href="mailto:${safeEmail}?subject=${replySubject}" style="color:#a5141e;text-decoration:none">${safeEmail}</a>`,
                              { isHtml: true },
                            )}
                            ${buildDetailRow("Telephone", safePhone || "Non renseigne", {
                              isHtml: true,
                            })}
                            ${buildDetailRow("Sujet", contact.subject || "Non renseigne")}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 30px 34px">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px">
                      <tr>
                        <td style="padding:22px">
                          <div style="color:#a5141e;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">
                            Message
                          </div>
                          <div style="color:#111827;font-size:16px;line-height:1.65;font-weight:500">
                            ${nl2br(contact.message)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 30px;background:#0f172a;color:#cbd5e1;font-size:12px;line-height:1.5">
                    Email automatique BedTrip. Le bouton de reponse utilise l'adresse saisie par le client.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendContactRequest(payload) {
  const contact = normalizeContactPayload(payload);
  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: MAIL_FROM,
    to: CONTACT_EMAIL_TO,
    replyTo: contact.email || DEFAULT_REPLY_TO,
    subject: buildSubject(contact),
    text: buildTextBody(contact),
    html: buildHtmlBody(contact),
  });

  const acceptedCount = Array.isArray(result?.accepted) ? result.accepted.length : 0;
  const rejectedCount = Array.isArray(result?.rejected) ? result.rejected.length : 0;
  const pendingCount = Array.isArray(result?.pending) ? result.pending.length : 0;

  console.log(
    "[contact-email] SMTP send result",
    JSON.stringify({
      messageId: result?.messageId || null,
      recipientSource: CONTACT_EMAIL_TO_SOURCE || null,
      acceptedCount,
      rejectedCount,
      pendingCount,
      response: result?.response || null,
    }),
  );

  if (rejectedCount > 0 && acceptedCount === 0 && pendingCount === 0) {
    const error = new Error("contact_mail_rejected");
    error.http = 502;
    error.debug = {
      recipientSource: CONTACT_EMAIL_TO_SOURCE || null,
      response: result?.response || null,
    };
    throw error;
  }

  return result;
}

module.exports = {
  isContactMailConfigured,
  sendContactRequest,
};
