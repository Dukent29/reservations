"use strict";

const chatbotConfig = require("../config/chatbotConfig");

const MAX_MESSAGE_LENGTH = 700;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeMessage(value) {
  return String(value || "").trim().slice(0, MAX_MESSAGE_LENGTH);
}

function parseAmount(raw) {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value) return null;
  value = value.replace(/\s/g, "").replace(/[^0-9,.\-]/g, "");
  if (!value) return null;
  if (value.includes(",") && !value.includes(".")) {
    const lastComma = value.lastIndexOf(",");
    value =
      value.slice(0, lastComma).replace(/[,\.]/g, "") +
      "." +
      value.slice(lastComma + 1).replace(/[,\.]/g, "");
  } else {
    value = value.replace(/,/g, "");
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function getContext(payload = {}) {
  const context = payload.context && typeof payload.context === "object" ? payload.context : {};
  const bookingSummary =
    context.bookingSummary && typeof context.bookingSummary === "object"
      ? context.bookingSummary
      : {};
  const bookingAmount = parseAmount(
    bookingSummary?.summary?.pricing?.total_amount ??
      bookingSummary?.pricing?.total_amount ??
      bookingSummary?.summary?.room?.price ??
      bookingSummary?.room?.price,
  );
  return {
    routeName: String(context.routeName || ""),
    path: String(context.path || ""),
    hotelName: String(context.hotelName || bookingSummary?.hotel?.name || ""),
    partnerOrderId: String(context.partnerOrderId || bookingSummary?.partner_order_id || ""),
    roomMeal: String(context.roomMeal || bookingSummary?.room?.meal || ""),
    roomName: String(context.roomName || bookingSummary?.room?.name || ""),
    bookingAmount,
  };
}

function answerCancellationPolicy(context) {
  const answer =
    context.routeName === "hotel-detail"
      ? "Les conditions d'annulation sont affichées sur chaque option de chambre. Cherchez les mentions annulation gratuite, tarif remboursable ou tarif non remboursable avant de choisir."
      : "Les conditions d'annulation dépendent du tarif choisi. Elles sont visibles sur la fiche hôtel et dans le récapitulatif avant paiement.";

  return {
    answer,
    highlights: [
      {
        tone: "warning",
        label: "Important",
        text: "Vérifiez toujours les conditions avant paiement : certains tarifs sont non remboursables.",
      },
    ],
  };
}

function answerPaymentInfo() {
  return {
    answer:
      "Le paiement se fait de façon sécurisée pendant l'étape de réservation. Selon les options disponibles, certains paiements peuvent être redirigés vers un prestataire comme Systempay, Floa ou Cofidis.",
    highlights: [
      { tone: "success", label: "Sécurisé", text: "Le paiement est validé avant la création finale de la réservation." },
      { tone: "info", label: "Options", text: "Systempay, Floa ou Cofidis peuvent être proposés selon le dossier." },
    ],
  };
}

function answerBestDestinations() {
  return {
    answer:
      "Si vous ne savez pas encore où partir, ouvrez le blog BedTrip. Vous y trouverez des idées de destinations, des périodes de voyage et des conseils pour choisir plus facilement.",
    highlights: [
      { tone: "info", label: "Conseil", text: "Commencez par le blog, puis lancez une recherche quand une destination vous intéresse." },
    ],
    links: [
      {
        label: "Voir les destinations",
        href: chatbotConfig.links?.blog || "/blog",
        icon: "pi pi-map-marker",
      },
    ],
  };
}

function answerContactSupport() {
  const phoneLabel = chatbotConfig.contact?.phoneLabel || "02 35 08 22 49";
  const email = chatbotConfig.contact?.email || "kotanvoyages@outlook.com";
  return {
    answer:
      "Pour contacter BedTrip, utilisez le téléphone pour une demande urgente ou l'email pour une demande écrite. Gardez votre référence de réservation si vous en avez une.",
    highlights: [
      { tone: "info", label: "Téléphone", text: phoneLabel, href: chatbotConfig.contact?.phoneHref || "tel:+33235082249" },
      { tone: "success", label: "Email", text: email, href: `mailto:${email}` },
      { tone: "warning", label: "Réservation", text: "Ajoutez votre référence partenaire pour accélérer le traitement." },
    ],
  };
}

function answerBookingHelp(context) {
  if (context.partnerOrderId) {
    return {
      answer: `Votre référence partenaire visible dans cette session est ${context.partnerOrderId}. Gardez-la pour toute demande au support.`,
      highlights: [
        { tone: "info", label: "Référence", text: context.partnerOrderId },
        { tone: "warning", label: "À garder", text: "Cette référence est utile pour toute demande de modification ou de suivi." },
      ],
    };
  }
  return {
    answer:
      "Pour modifier une réservation, utilisez votre référence de réservation et contactez le support. Certaines modifications dépendent du tarif et du fournisseur hôtelier.",
    highlights: [
      { tone: "warning", label: "Important", text: "La modification dépend du tarif réservé et du fournisseur hôtelier." },
    ],
  };
}

function answerBookingConfirmation(context) {
  if (context.partnerOrderId) {
    return {
      answer: `Votre référence partenaire est ${context.partnerOrderId}. Si vous n'avez pas reçu l'email, vérifiez les spams puis contactez le support avec cette référence.`,
      highlights: [
        { tone: "info", label: "Référence", text: context.partnerOrderId },
        { tone: "warning", label: "Email", text: "Vérifiez les spams si la confirmation n'arrive pas." },
      ],
    };
  }
  return {
    answer:
      "La confirmation et le bon hôtel sont envoyés après validation du paiement et de la réservation fournisseur. Vérifiez aussi vos spams si l'email n'arrive pas.",
    highlights: [
      { tone: "success", label: "Après paiement", text: "La confirmation arrive après validation du paiement et de la réservation fournisseur." },
      { tone: "warning", label: "Email", text: "Vérifiez aussi vos spams." },
    ],
  };
}

function answerHotelInfo(context, _message, normalizedMessage) {
  if (
    normalizedMessage.includes("check in") ||
    normalizedMessage.includes("checkin") ||
    normalizedMessage.includes("heure arrivee") ||
    normalizedMessage.includes("arrival time")
  ) {
    return {
      answer:
        "L'heure de check-in dépend de chaque hôtel. Sur la fiche hôtel, regardez la section arrivée et départ. Si l'information n'est pas visible, vérifiez votre bon de réservation ou contactez le support.",
      highlights: [
        { tone: "info", label: "Check-in", text: "L'heure exacte dépend de l'hôtel sélectionné." },
      ],
    };
  }

  const meal = normalizeText(context.roomMeal);
  if (meal.includes("breakfast") || meal.includes("petit dejeuner") || meal === "bb") {
    return {
      answer: `Oui, le petit-déjeuner semble inclus pour cette option (${context.roomMeal}). Vérifiez toujours le détail de la chambre avant paiement.`,
      highlights: [
        { tone: "success", label: "Petit-déjeuner", text: "Semble inclus pour l'option sélectionnée." },
      ],
    };
  }
  if (context.roomName || context.roomMeal) {
    return {
      answer:
        "Le petit-déjeuner n'est pas indiqué comme inclus pour l'option actuellement sélectionnée. Choisissez une chambre avec la mention petit-déjeuner inclus si vous en avez besoin.",
      highlights: [
        { tone: "warning", label: "À vérifier", text: "Choisissez une offre avec la mention petit-déjeuner inclus." },
      ],
    };
  }
  if (context.routeName === "hotel-detail") {
    return {
      answer:
        "Sur la page hôtel, regardez les badges et détails de chaque chambre. Si une offre inclut le petit-déjeuner, elle doit l'indiquer dans les informations de repas.",
      highlights: [
        { tone: "info", label: "Fiche hôtel", text: "Les badges de chambre indiquent les repas inclus." },
      ],
    };
  }
  return {
    answer:
      "Le petit-déjeuner dépend de la chambre choisie. Ouvrez un hôtel puis vérifiez les détails de l'offre avant de réserver.",
    highlights: [
      { tone: "info", label: "Repas", text: "Le petit-déjeuner dépend de l'offre de chambre." },
    ],
  };
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function getPromoStatus(promo, now = new Date()) {
  const startDate = promo.start_date ? new Date(promo.start_date) : null;
  const endDate = promo.end_date ? new Date(promo.end_date) : null;
  const usedCount = Number(promo.used_count || 0);
  const maxUses = Number(promo.max_uses || 0);

  if (!promo.is_active) return { key: "inactive", label: "Inactif", usable: false };
  if (startDate && Number.isFinite(startDate.getTime()) && startDate > now) {
    return { key: "upcoming", label: "À venir", usable: false };
  }
  if (endDate && Number.isFinite(endDate.getTime()) && endDate < now) {
    return { key: "expired", label: "Expiré", usable: false };
  }
  if (maxUses > 0 && usedCount >= maxUses) {
    return { key: "exhausted", label: "Épuisé", usable: false };
  }
  return { key: "active", label: "Actif", usable: true };
}

function getDiscountPreview(promo, bookingAmount) {
  const amount = Number(bookingAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (promo.min_amount != null && amount < Number(promo.min_amount)) return null;

  const discount =
    promo.type === "percentage"
      ? amount * (Number(promo.value || 0) / 100)
      : Number(promo.value || 0);
  if (!Number.isFinite(discount) || discount <= 0) return null;

  return Math.min(amount, Math.round(discount * 100) / 100);
}

function describePromo(promo, status, bookingAmount = null) {
  const parts = [];
  if (promo.type === "percentage") {
    parts.push(`-${Number(promo.value || 0)}% sur le total`);
  } else {
    parts.push(`-${formatMoney(promo.value) || `${promo.value} EUR`} sur le total`);
  }

  const previewDiscount = getDiscountPreview(promo, bookingAmount);
  if (previewDiscount != null) {
    parts.push(`réduction estimée ${formatMoney(previewDiscount)}`);
  }

  if (promo.min_amount != null) {
    parts.push(`minimum ${formatMoney(promo.min_amount) || `${promo.min_amount} EUR`}`);
  }

  const endDate = formatDate(promo.end_date);
  if (status.key === "expired" && endDate) {
    parts.push(`expiré le ${endDate}`);
  } else if (endDate) {
    parts.push(`valable jusqu'au ${endDate}`);
  }

  const maxUses = Number(promo.max_uses || 0);
  if (maxUses > 0) {
    const remaining = Math.max(0, maxUses - Number(promo.used_count || 0));
    parts.push(`${remaining} utilisation${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`);
  }

  return parts.join(" · ");
}

async function answerPromoCodes(context = {}) {
  const promoCodeModel = require("../models/promoCodeModel");
  const result = await promoCodeModel.listPromoCodes({ limit: 20, offset: 0 });
  const promoCodes = (result.promo_codes || []).map((promo) => {
    const status = getPromoStatus(promo);
    return {
      id: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      status: status.key,
      statusLabel: status.label,
      isUsable: status.usable,
      description: describePromo(promo, status, context.bookingAmount),
      expiresAt: promo.end_date,
      maxUses: promo.max_uses,
      usedCount: promo.used_count,
      remainingUses: Math.max(0, Number(promo.max_uses || 0) - Number(promo.used_count || 0)),
    };
  });

  if (!promoCodes.length) {
    return {
      answer: "Aucune disponible pour le moment.",
      promoCodes: [],
    };
  }

  const activeCount = promoCodes.filter((promo) => promo.isUsable).length;
  return {
    answer: activeCount
      ? "Voici les codes promo disponibles. Vous pouvez copier le code puis l'appliquer avant le paiement."
      : "Il y a des codes promo, mais aucun n'est utilisable pour le moment.",
    highlights: [
      activeCount
        ? { tone: "success", label: "Disponible", text: `${activeCount} code${activeCount > 1 ? "s" : ""} utilisable${activeCount > 1 ? "s" : ""} maintenant.` }
        : { tone: "warning", label: "Indisponible", text: "Les codes existent, mais ils sont expirés, inactifs, à venir ou épuisés." },
    ],
    promoCodes,
  };
}

const responseHandlers = {
  greeting: () => chatbotConfig.widget.greeting,
  hotelInfo: answerHotelInfo,
  cancellationPolicy: answerCancellationPolicy,
  paymentInfo: answerPaymentInfo,
  bestDestinations: answerBestDestinations,
  bookingHelp: answerBookingHelp,
  bookingConfirmation: answerBookingConfirmation,
  promoCodes: answerPromoCodes,
  contactSupport: answerContactSupport,
};

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function maxAllowedDistance(token) {
  if (token.length < 4) return 0;
  if (token.length <= 6) return 1;
  return 2;
}

function tokenMatchScore(messageToken, keywordToken) {
  if (!messageToken || !keywordToken) return 0;
  if (messageToken === keywordToken) return 1;
  const allowedDistance = maxAllowedDistance(keywordToken);
  if (!allowedDistance) return 0;
  if (Math.abs(messageToken.length - keywordToken.length) > allowedDistance) return 0;
  const distance = editDistance(messageToken, keywordToken);
  if (distance > allowedDistance) return 0;
  return distance === 1 ? 0.82 : 0.68;
}

function bestTokenScore(messageTokens, keywordToken) {
  let best = 0;
  for (const token of messageTokens) {
    best = Math.max(best, tokenMatchScore(token, keywordToken));
    if (best === 1) break;
  }
  return best;
}

function phraseMatchScore(messageTokens, keywordTokens) {
  if (!keywordTokens.length) return 0;
  const scores = keywordTokens.map((token) => bestTokenScore(messageTokens, token));
  const matched = scores.filter((score) => score >= 0.68).length;
  if (matched !== keywordTokens.length) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scoreIntent(normalizedMessage, rule) {
  let score = 0;
  const messageTokens = normalizedMessage.split(" ").filter(Boolean);
  const messageTokenSet = new Set(messageTokens);
  const seenKeywords = new Set();
  for (const keyword of rule.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) continue;
    if (seenKeywords.has(normalizedKeyword)) continue;
    seenKeywords.add(normalizedKeyword);
    if (normalizedMessage === normalizedKeyword) score += 5;
    else if (normalizedKeyword.includes(" ")) {
      if (normalizedMessage.includes(normalizedKeyword)) {
        score += 4;
      } else {
        const keywordTokens = normalizedKeyword.split(" ").filter(Boolean);
        const phraseScore = phraseMatchScore(messageTokens, keywordTokens);
        if (phraseScore >= 0.68) score += 2.5 * phraseScore;
      }
    } else if (messageTokenSet.has(normalizedKeyword)) {
      score += 2;
    } else {
      const fuzzyScore = bestTokenScore(messageTokens, normalizedKeyword);
      if (fuzzyScore >= 0.68) score += 1.4 * fuzzyScore;
    }
  }
  return score ? score + rule.priority / 10 : 0;
}

function buildQuickReplies(ids = []) {
  return ids.map((id) => chatbotConfig.quickReplies?.[id]).filter(Boolean).slice(0, 4);
}

function getPublicConfig() {
  return {
    enabled: chatbotConfig.enabled,
    widget: chatbotConfig.widget,
  };
}

async function answerMessage(payload = {}) {
  const message = safeMessage(payload.message);
  const normalizedMessage = normalizeText(message);
  const context = getContext(payload);

  if (!normalizedMessage) {
    return {
      intent: "empty",
      confidence: 1,
      answer: "Écrivez votre question ou choisissez une action rapide.",
      quickReplies: chatbotConfig.widget.quickActions,
    };
  }

  let best = null;
  for (const rule of chatbotConfig.intents || []) {
    const score = scoreIntent(normalizedMessage, rule);
    if (!score) continue;
    if (!best || score > best.score) {
      best = { rule, score };
    }
  }

  if (!best) {
    return {
      intent: "fallback",
      confidence: 0,
      answer: chatbotConfig.fallback.message,
      quickReplies: chatbotConfig.fallback.quickReplies,
      escalation: chatbotConfig.escalation,
    };
  }

  const handlerResult =
    best.rule.responseHandler && responseHandlers[best.rule.responseHandler]
      ? await responseHandlers[best.rule.responseHandler](context, message, normalizedMessage)
      : best.rule.response;
  const result =
    handlerResult && typeof handlerResult === "object" && !Array.isArray(handlerResult)
      ? handlerResult
      : { answer: handlerResult };

  return {
    intent: best.rule.name,
    confidence: Math.min(0.95, Math.round(best.score * 10) / 100),
    answer: result.answer || chatbotConfig.fallback.message,
    quickReplies: buildQuickReplies(best.rule.quickReplies),
    escalation: best.rule.name === "contact_support" ? chatbotConfig.escalation : null,
    ...result,
  };
}

module.exports = {
  answerMessage,
  getPublicConfig,
};
