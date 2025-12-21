"use strict";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const guestSchema = {
  adults: { type: "number", min: 1, max: 10, required: true },
  children: { type: ["number", "array"], optional: true },
};

const searchSchemas = {
  searchRegions: {
    query: {
      q: { type: "string", minLen: 1, maxLen: 80, optional: true },
      lang: { type: "string", minLen: 2, maxLen: 10, optional: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
    },
  },
  searchSerp: {
    body: {
      checkin: { type: "string", minLen: 10, maxLen: 10, pattern: datePattern, required: true },
      checkout: { type: "string", minLen: 10, maxLen: 10, pattern: datePattern, required: true },
      guests: { type: "array", minLen: 1, maxLen: 4, items: { type: "object", shape: guestSchema }, required: true },
      region_id: { type: ["string", "number"], optional: true },
      ids: { type: "array", minLen: 1, maxLen: 100, items: { type: ["string", "number"] }, optional: true },
      hids: { type: "array", minLen: 1, maxLen: 100, items: { type: ["string", "number"] }, optional: true },
      latitude: { type: "number", min: -90, max: 90, optional: true },
      longitude: { type: "number", min: -180, max: 180, optional: true },
      radius: { type: "number", min: 1, max: 5000, optional: true },
      currency: { type: "string", minLen: 3, maxLen: 5, optional: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
      residency: { type: "string", minLen: 2, maxLen: 5, optional: true },
      query: { type: "string", minLen: 2, maxLen: 80, optional: true },
      filters: { type: "object", optional: true },
    },
  },
  searchHp: {
    body: {
      id: { type: ["string", "number"], optional: true },
      hid: { type: ["string", "number"], optional: true },
      checkin: { type: "string", minLen: 10, maxLen: 10, pattern: datePattern, required: true },
      checkout: { type: "string", minLen: 10, maxLen: 10, pattern: datePattern, required: true },
      guests: { type: "array", minLen: 1, maxLen: 4, items: { type: "object", shape: guestSchema }, required: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
      currency: { type: "string", minLen: 3, maxLen: 5, optional: true },
      residency: { type: "string", minLen: 2, maxLen: 5, optional: true },
    },
    custom: (req, errors) => {
      const { id, hid } = req.body || {};
      if (!id && !hid) {
        errors.push({ path: "body.id|body.hid", message: "id or hid is required" });
      }
    },
  },
};

const bookingSchemas = {
  prebook: {
    body: {
      search_hash: { type: "string", minLen: 2, maxLen: 200, optional: true },
      book_hash: { type: "string", minLen: 2, maxLen: 200, optional: true },
      hash: { type: "string", minLen: 2, maxLen: 200, optional: true },
      offer_id: { type: ["string", "number"], optional: true },
      price_increase_percent: { type: "number", min: 0, max: 100, optional: true },
      hp_context: { type: "object", optional: true },
      meal: { type: "string", minLen: 1, maxLen: 200, optional: true },
      room_name: { type: "string", minLen: 1, maxLen: 200, optional: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      if (!body.search_hash && !body.book_hash && !body.hash && !body.offer_id) {
        errors.push({ path: "body", message: "hash is required (search_hash, book_hash, hash, or offer_id)" });
      }
    },
  },
  bookingForm: {
    body: {
      prebook_token: { type: "string", minLen: 2, maxLen: 200, optional: true },
      token: { type: "string", minLen: 2, maxLen: 200, optional: true },
      book_hash: { type: "string", minLen: 2, maxLen: 200, optional: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      if (!body.prebook_token && !body.token && !body.book_hash) {
        errors.push({ path: "body", message: "prebook_token or book_hash is required" });
      }
    },
  },
  bookingStart: {
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
      user: {
        type: "object",
        required: true,
        shape: {
          email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, required: true },
          phone: { type: "string", minLen: 6, maxLen: 30, required: true },
          first_name: { type: "string", minLen: 1, maxLen: 80, optional: true },
          last_name: { type: "string", minLen: 1, maxLen: 80, optional: true },
        },
      },
      rooms: { type: "array", minLen: 1, maxLen: 10, items: { type: "object" }, required: true },
      payment_type: {
        type: "object",
        required: true,
        shape: {
          currency_code: { type: "string", minLen: 3, maxLen: 5, required: true },
          type: { type: "string", minLen: 2, maxLen: 30, optional: true },
          amount: { type: ["number", "string"], optional: true },
        },
      },
      supplier_data: { type: "object", optional: true },
      upsell_data: { type: "object", optional: true },
      return_path: { type: "string", minLen: 1, maxLen: 200, optional: true },
      arrival_datetime: { type: "string", minLen: 1, maxLen: 40, optional: true },
    },
  },
  bookingCheck: {
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
    },
  },
  bookingStatus: {
    query: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
    },
  },
};

const hotelSchemas = {
  hotelInfo: {
    body: {
      id: { type: ["string", "number"], optional: true },
      hid: { type: ["string", "number"], optional: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      if (!body.id && !body.hid) {
        errors.push({ path: "body.id|body.hid", message: "id or hid is required" });
      }
    },
  },
  hotelImages: {
    body: {
      id: { type: ["string", "number"], optional: true },
      hid: { type: ["string", "number"], optional: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
      limit: { type: "number", min: 1, max: 50, optional: true },
      size: { type: "string", minLen: 2, maxLen: 20, optional: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      if (!body.id && !body.hid) {
        errors.push({ path: "body.id|body.hid", message: "id or hid is required" });
      }
    },
  },
};

const contentSchemas = {
  hotelDump: {
    body: {
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
    },
  },
};

const paymentSchemas = {
  floaSimulate: {
    body: {
      merchantFinancedAmount: { type: "number", min: 1, max: 100000, optional: true },
      currency: { type: "string", minLen: 3, maxLen: 5, optional: true },
      items: { type: "array", minLen: 1, maxLen: 20, items: { type: "object" }, optional: true },
    },
  },
  floaDeal: {
    body: {
      productCode: { type: "string", minLen: 1, maxLen: 32, required: true },
      items: { type: "array", minLen: 1, maxLen: 20, items: { type: "object" }, required: true },
      merchantFinancedAmount: { type: "number", min: 1, max: 100000, optional: true },
      itemCount: { type: "number", min: 1, max: 20, optional: true },
      customer: { type: "object", optional: true },
      customers: { type: "array", minLen: 1, maxLen: 5, items: { type: "object" }, optional: true },
      currency: { type: "string", minLen: 3, maxLen: 5, optional: true },
      device: { type: "string", minLen: 2, maxLen: 30, optional: true },
      shippingAddress: { type: "object", optional: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      const hasCustomer = Boolean(body.customer);
      const hasCustomers = Array.isArray(body.customers) && body.customers.length > 0;
      if (!hasCustomer && !hasCustomers) {
        errors.push({ path: "body.customer|body.customers", message: "customer is required" });
      }
    },
  },
  floaHotelDeal: {
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
      productCode: { type: "string", minLen: 1, maxLen: 32, required: true },
      device: { type: "string", minLen: 2, maxLen: 30, optional: true },
      customer: {
        type: "object",
        required: true,
        shape: {
          civility: { type: "string", minLen: 1, maxLen: 10, required: true },
          firstName: { type: "string", minLen: 1, maxLen: 80, required: true },
          lastName: { type: "string", minLen: 1, maxLen: 80, required: true },
          email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, required: true },
          mobilePhoneNumber: { type: "string", minLen: 6, maxLen: 30, optional: true },
          homeAddress: { type: "object", optional: true },
        },
      },
    },
  },
  floaFinalize: {
    params: {
      dealReference: { type: "string", minLen: 3, maxLen: 120, required: true },
    },
    body: { },
  },
  floaCancel: {
    params: {
      dealReference: { type: "string", minLen: 3, maxLen: 120, required: true },
    },
    body: { },
  },
  floaGet: {
    params: {
      dealReference: { type: "string", minLen: 3, maxLen: 120, required: true },
    },
  },
  payotaInit: {
    body: {
      object_id: { type: "string", minLen: 1, maxLen: 120, required: true },
      pay_uuid: { type: "string", minLen: 1, maxLen: 120, required: true },
      init_uuid: { type: "string", minLen: 1, maxLen: 120, required: true },
      user_first_name: { type: "string", minLen: 1, maxLen: 80, required: true },
      user_last_name: { type: "string", minLen: 1, maxLen: 80, required: true },
      credit_card_data_core: { type: "string", minLen: 1, maxLen: 2000, required: true },
      is_cvc_required: { type: ["boolean", "string"], required: true },
    },
  },
  systempayCreateOrder: {
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
      customerEmail: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, optional: true },
    },
  },
};

module.exports = {
  searchSchemas,
  bookingSchemas,
  hotelSchemas,
  contentSchemas,
  paymentSchemas,
};
