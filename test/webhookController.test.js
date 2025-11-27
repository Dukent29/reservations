// test/webhookController.test.js
"use strict";

const crypto = require("crypto");
const assert = require("assert");

// Simple test runner without jest
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`✗ ${t.name}`);
      console.error(`  ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Helper to compute HMAC-SHA256
function computeHmac(data, key) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

// Store original env
const originalEnv = process.env.SYSTEMPAY_HMAC_KEY;

// ========== Tests for validateSystempaySignature ==========

test("validateSystempaySignature - valid signature", () => {
  process.env.SYSTEMPAY_HMAC_KEY = "test-hmac-key-12345";

  // Need to clear require cache and reload
  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const krAnswer = JSON.stringify({ orderStatus: "PAID", orderId: "order-123" });
  const hmacKey = process.env.SYSTEMPAY_HMAC_KEY;
  const signature = computeHmac(krAnswer, hmacKey);

  const mockReq = {
    headers: {
      "kr-hash": signature,
      "kr-hash-algorithm": "sha256_hmac",
    },
    body: {
      "kr-answer": krAnswer,
    },
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.message, "signature_valid");
});

test("validateSystempaySignature - invalid signature", () => {
  process.env.SYSTEMPAY_HMAC_KEY = "test-hmac-key-12345";

  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const krAnswer = JSON.stringify({ orderStatus: "PAID", orderId: "order-123" });

  const mockReq = {
    headers: {
      "kr-hash": "invalid-signature-that-does-not-match-at-all",
      "kr-hash-algorithm": "sha256_hmac",
    },
    body: {
      "kr-answer": krAnswer,
    },
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, "signature_mismatch");
});

test("validateSystempaySignature - missing kr-hash header", () => {
  process.env.SYSTEMPAY_HMAC_KEY = "test-hmac-key-12345";

  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const mockReq = {
    headers: {},
    body: {
      "kr-answer": JSON.stringify({ orderStatus: "PAID" }),
    },
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, "missing_kr_hash_header");
});

test("validateSystempaySignature - missing kr-answer in body", () => {
  process.env.SYSTEMPAY_HMAC_KEY = "test-hmac-key-12345";

  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const mockReq = {
    headers: {
      "kr-hash": "some-hash",
    },
    body: {},
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, "missing_kr_answer_in_body");
});

test("validateSystempaySignature - no HMAC key configured (skips validation)", () => {
  delete process.env.SYSTEMPAY_HMAC_KEY;

  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const mockReq = {
    headers: {},
    body: {},
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.message, "no_hmac_key_configured");
});

test("validateSystempaySignature - unsupported hash algorithm", () => {
  process.env.SYSTEMPAY_HMAC_KEY = "test-hmac-key-12345";

  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const krAnswer = JSON.stringify({ orderStatus: "PAID" });

  const mockReq = {
    headers: {
      "kr-hash": "some-hash",
      "kr-hash-algorithm": "md5_hmac",
    },
    body: {
      "kr-answer": krAnswer,
    },
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, false);
  assert.ok(result.message.includes("unsupported_hash_algorithm"));
});

test("validateSystempaySignature - invalid hex format in hash", () => {
  process.env.SYSTEMPAY_HMAC_KEY = "test-hmac-key-12345";

  delete require.cache[require.resolve("../config/systempay")];
  delete require.cache[require.resolve("../controllers/webhookController")];

  const { validateSystempaySignature } = require("../controllers/webhookController");

  const krAnswer = JSON.stringify({ orderStatus: "PAID" });
  // Create a hash with correct length (64 chars for SHA-256 hex) but invalid hex chars
  const invalidHexHash = "zz" + "0".repeat(62);

  const mockReq = {
    headers: {
      "kr-hash": invalidHexHash,
      "kr-hash-algorithm": "sha256_hmac",
    },
    body: {
      "kr-answer": krAnswer,
    },
  };

  const result = validateSystempaySignature(mockReq);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.message, "invalid_hash_format");
});

// Cleanup
test("cleanup - restore env", () => {
  if (originalEnv) {
    process.env.SYSTEMPAY_HMAC_KEY = originalEnv;
  }
});

// Run all tests
runTests();
