"use strict";

const {
  insuranceCatalog,
  insuranceContractCode,
} = require("../config/insurance");

const catalogById = new Map(
  insuranceCatalog.map((item) => [item.id, item])
);

function normalizeSelectedIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id || "").trim()).filter(Boolean);
  }
  if (typeof raw === "object") {
    if (Array.isArray(raw.selected)) {
      return raw.selected.map((id) => String(id || "").trim()).filter(Boolean);
    }
  }
  return [];
}

function buildInsuranceSummary(rawSelection) {
  const selectedIds = normalizeSelectedIds(rawSelection);
  const items = [];
  const extensionsCodes = [];
  let total = 0;

  selectedIds.forEach((id) => {
    const entry = catalogById.get(id);
    if (!entry) return;
    items.push({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      price: entry.price,
      extensionCode: entry.extensionCode || null,
    });
    if (entry.extensionCode) {
      extensionsCodes.push(entry.extensionCode);
    }
    total += Number(entry.price || 0);
  });

  return {
    selectedIds,
    items,
    extensionsCodes,
    total,
    contractCode: insuranceContractCode,
  };
}

module.exports = {
  buildInsuranceSummary,
};
