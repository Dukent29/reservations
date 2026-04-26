"use strict";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  searchNearby: {
    body: {
      checkin: { type: "string", minLen: 10, maxLen: 10, pattern: datePattern, required: true },
      checkout: { type: "string", minLen: 10, maxLen: 10, pattern: datePattern, required: true },
      guests: { type: "array", minLen: 1, maxLen: 4, items: { type: "object", shape: guestSchema }, required: true },
      latitude: { type: "number", min: -90, max: 90, required: true },
      longitude: { type: "number", min: -180, max: 180, required: true },
      radius: { type: "number", min: 1, max: 70000, optional: true },
      radius_km: { type: "number", min: 1, max: 70, optional: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
      currency: { type: "string", minLen: 3, maxLen: 5, optional: true },
      residency: { type: "string", minLen: 2, maxLen: 5, optional: true },
      filters: { type: "object", optional: true },
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
      request_meta: { type: "object", optional: true },
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
  bookingVoucher: {
    query: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
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
  hotelPois: {
    allowUnknownQuery: false,
    query: {
      id: { type: ["string", "number"], optional: true },
      hid: { type: ["string", "number"], optional: true },
      subtype: { type: "string", minLen: 1, maxLen: 80, optional: true },
      max_distance_m: { type: ["string", "number"], optional: true },
      limit: { type: ["string", "number"], optional: true },
      featured: { type: ["string", "number"], optional: true },
    },
    custom: (req, errors) => {
      const query = req.query || {};
      if (!query.id && !query.hid) {
        errors.push({ path: "query.id|query.hid", message: "id or hid is required" });
      }
    },
  },
  hotelPoisBatch: {
    allowUnknownBody: false,
    body: {
      hids: {
        type: "array",
        minLen: 1,
        maxLen: 100,
        items: { type: ["string", "number"] },
        optional: true,
      },
      ids: {
        type: "array",
        minLen: 1,
        maxLen: 100,
        items: { type: ["string", "number"] },
        optional: true,
      },
      subtype: { type: "string", minLen: 1, maxLen: 80, optional: true },
      max_distance_m: { type: "number", min: 1, max: 100000, optional: true },
      limit_per_hotel: { type: "number", min: 1, max: 12, optional: true },
      featured: { type: ["string", "number", "boolean"], optional: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      const hasHids = Array.isArray(body.hids) && body.hids.length > 0;
      const hasIds = Array.isArray(body.ids) && body.ids.length > 0;
      if (!hasHids && !hasIds) {
        errors.push({ path: "body.hids|body.ids", message: "hids or ids is required" });
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

const contactTopicValues = [
  "reservation",
  "payment",
  "cancellation",
  "general",
  "partnership",
];

const contactReservationReasonValues = [
  "information",
  "modify_booking",
  "cancel_refund",
  "voucher_confirmation",
  "payment_invoice",
  "arrival_time",
  "other",
];

const contactSchemas = {
  contactRequest: {
    allowUnknownBody: false,
    body: {
      topic: { type: "string", minLen: 3, maxLen: 40, enum: contactTopicValues, required: true },
      reservation_reason: { type: "string", minLen: 3, maxLen: 60, enum: contactReservationReasonValues, optional: true },
      reservation_reference: { type: "string", minLen: 0, maxLen: 120, optional: true },
      name: { type: "string", minLen: 2, maxLen: 120, required: true },
      email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, required: true },
      phone: { type: "string", minLen: 0, maxLen: 40, optional: true },
      subject: { type: "string", minLen: 0, maxLen: 160, optional: true },
      message: { type: "string", minLen: 10, maxLen: 3000, required: true },
      consent: { type: "boolean", required: true },
    },
    custom: (req, errors) => {
      const body = req.body || {};
      if (body.topic === "reservation" && !body.reservation_reason) {
        errors.push({ path: "body.reservation_reason", message: "is required for reservation requests" });
      }
      if (body.consent !== true) {
        errors.push({ path: "body.consent", message: "must be accepted" });
      }
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
  paypalOrderCreate: {
    allowUnknownBody: false,
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 120, required: true },
      customer_email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, optional: true },
      conditions_acceptance: {
        type: "object",
        required: true,
        shape: {
          accepted: { type: ["boolean", "string"], required: true },
          conditions_version: { type: "string", minLen: 1, maxLen: 80, optional: true },
          privacy_policy_accepted: { type: ["boolean", "string"], required: true },
          privacy_policy_version: { type: "string", minLen: 1, maxLen: 80, optional: true },
          accepted_at_client: { type: "string", minLen: 10, maxLen: 80, optional: true },
        },
      },
    },
  },
  systempayCreateOrder: {
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 80, required: true },
      customerEmail: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, optional: true },
      customerFirstName: { type: "string", minLen: 1, maxLen: 80, optional: true },
      customerLastName: { type: "string", minLen: 1, maxLen: 80, optional: true },
      customerPhone: { type: "string", minLen: 3, maxLen: 40, optional: true },
      customerCivility: { type: "string", minLen: 1, maxLen: 16, optional: true },
    },
  },
  kotanExternCreate: {
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 120, required: true },
      conditions_acceptance: {
        type: "object",
        optional: true,
        shape: {
          accepted: { type: ["boolean", "string"], required: true },
          conditions_version: { type: "string", minLen: 1, maxLen: 80, optional: true },
          privacy_policy_accepted: { type: ["boolean", "string"], required: true },
          privacy_policy_version: { type: "string", minLen: 1, maxLen: 80, optional: true },
          accepted_at_client: { type: "string", minLen: 10, maxLen: 80, optional: true },
        },
      },
      customer: {
        type: "object",
        required: true,
        shape: {
          civility: { type: "string", minLen: 1, maxLen: 16, required: true },
          firstName: { type: "string", minLen: 1, maxLen: 80, required: true },
          lastName: { type: "string", minLen: 1, maxLen: 80, required: true },
          email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, required: true },
          phone: { type: "string", minLen: 3, maxLen: 40, required: true },
          addressLine1: { type: "string", minLen: 1, maxLen: 200, optional: true },
          postalCode: { type: "string", minLen: 1, maxLen: 20, optional: true },
          city: { type: "string", minLen: 1, maxLen: 120, optional: true },
          company: { type: "string", minLen: 1, maxLen: 120, optional: true },
          birthdate: { type: "string", minLen: 4, maxLen: 40, optional: true },
        },
      },
      passengers: { type: "array", minLen: 1, maxLen: 12, items: { type: "object" }, optional: true },
      services: { type: "array", maxLen: 50, items: { type: "object" }, optional: true },
      checkoutData: { type: "object", optional: true },
      productType: { type: "string", minLen: 2, maxLen: 40, optional: true },
    },
  },
  kotanExternInfo: {
    query: {
      ref: { type: "string", minLen: 3, maxLen: 120, required: true },
    },
  },
};

const promoSchemas = {
  validatePromo: {
    allowUnknownBody: false,
    body: {
      code: { type: "string", minLen: 3, maxLen: 40, required: true },
      partner_order_id: { type: "string", minLen: 6, maxLen: 120, required: true },
      user_email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, optional: true },
      user_id: { type: "string", minLen: 1, maxLen: 120, optional: true },
    },
  },
  clearPromo: {
    allowUnknownBody: false,
    body: {
      partner_order_id: { type: "string", minLen: 6, maxLen: 120, required: true },
    },
  },
  adminListPromoCodes: {
    allowUnknownQuery: false,
    query: {
      limit: { type: ["string", "number"], optional: true },
      offset: { type: ["string", "number"], optional: true },
    },
  },
  adminPromoCodeId: {
    allowUnknownParams: false,
    params: {
      id: { type: "string", minLen: 1, maxLen: 24, required: true },
    },
  },
  adminCreatePromoCode: {
    allowUnknownBody: false,
    body: {
      code: { type: "string", minLen: 3, maxLen: 40, required: true },
      type: { type: "string", minLen: 5, maxLen: 10, enum: ["percentage", "fixed"], required: true },
      value: { type: ["number", "string"], required: true },
      min_amount: { type: ["number", "string"], optional: true },
      max_uses: { type: ["number", "string"], optional: true },
      per_user_limit: { type: ["number", "string"], optional: true },
      start_date: { type: "string", minLen: 10, maxLen: 80, required: true },
      end_date: { type: "string", minLen: 10, maxLen: 80, required: true },
      is_active: { type: ["boolean", "string"], optional: true },
    },
  },
  adminUpdatePromoCode: {
    allowUnknownParams: false,
    allowUnknownBody: false,
    params: {
      id: { type: "string", minLen: 1, maxLen: 24, required: true },
    },
    body: {
      code: { type: "string", minLen: 3, maxLen: 40, required: true },
      type: { type: "string", minLen: 5, maxLen: 10, enum: ["percentage", "fixed"], required: true },
      value: { type: ["number", "string"], required: true },
      min_amount: { type: ["number", "string"], optional: true },
      max_uses: { type: ["number", "string"], optional: true },
      per_user_limit: { type: ["number", "string"], optional: true },
      start_date: { type: "string", minLen: 10, maxLen: 80, required: true },
      end_date: { type: "string", minLen: 10, maxLen: 80, required: true },
      is_active: { type: ["boolean", "string"], optional: true },
    },
  },
};

const authSchemas = {
  adminLogin: {
    allowUnknownBody: false,
    body: {
      email: { type: "string", minLen: 3, maxLen: 320, pattern: emailPattern, required: true },
      password: { type: "string", minLen: 3, maxLen: 200, required: true },
    },
  },
  adminListUsers: {
    allowUnknownQuery: false,
    query: {
      limit: { type: ["string", "number"], optional: true },
      offset: { type: ["string", "number"], optional: true },
    },
  },
  adminUpdateUserRole: {
    allowUnknownParams: false,
    allowUnknownBody: false,
    params: {
      id: { type: "string", minLen: 1, maxLen: 64, required: true },
    },
    body: {
      role: { type: "string", minLen: 4, maxLen: 10, enum: ["admin", "editor", "viewer"], required: true },
    },
  },
  adminListPayments: {
    allowUnknownQuery: false,
    query: {
      limit: { type: ["string", "number"], optional: true },
      offset: { type: ["string", "number"], optional: true },
    },
  },
  adminListReservations: {
    allowUnknownQuery: false,
    query: {
      limit: { type: ["string", "number"], optional: true },
      offset: { type: ["string", "number"], optional: true },
      q: { type: "string", minLen: 1, maxLen: 120, optional: true },
    },
  },
  adminDownloadVoucher: {
    allowUnknownParams: false,
    params: {
      partnerOrderId: { type: "string", minLen: 6, maxLen: 120, required: true },
    },
    query: {
      language: { type: "string", minLen: 2, maxLen: 10, optional: true },
    },
  },
};

const blogSchemas = {
  adminListPosts: {
    allowUnknownQuery: false,
    query: {
      status: { type: "string", minLen: 5, maxLen: 9, enum: ["draft", "published"], optional: true },
      q: { type: "string", minLen: 1, maxLen: 120, optional: true },
      limit: { type: ["string", "number"], optional: true },
      offset: { type: ["string", "number"], optional: true },
    },
  },
  adminPostId: {
    allowUnknownParams: false,
    params: {
      id: { type: "string", minLen: 1, maxLen: 24, required: true },
    },
  },
  adminCreatePost: {
    allowUnknownBody: false,
    body: {
      title: { type: "string", minLen: 3, maxLen: 200, required: true },
      slug: { type: "string", minLen: 3, maxLen: 200, pattern: slugPattern, optional: true },
      excerpt: { type: "string", minLen: 1, maxLen: 500, optional: true },
      content: { type: "string", minLen: 10, maxLen: 100000, required: true },
      coverImageUrl: { type: "string", minLen: 1, maxLen: 2000, optional: true },
      imageUrls: {
        type: "array",
        minLen: 1,
        maxLen: 24,
        items: { type: "string", minLen: 1, maxLen: 2000 },
        optional: true,
      },
      category: { type: "string", minLen: 1, maxLen: 120, optional: true },
      tags: { type: ["array", "string"], optional: true },
      status: { type: "string", minLen: 5, maxLen: 9, enum: ["draft", "published"], required: true },
    },
  },
  adminUpdatePost: {
    allowUnknownParams: false,
    allowUnknownBody: false,
    params: {
      id: { type: "string", minLen: 1, maxLen: 24, required: true },
    },
    body: {
      title: { type: "string", minLen: 3, maxLen: 200, required: true },
      slug: { type: "string", minLen: 3, maxLen: 200, pattern: slugPattern, optional: true },
      excerpt: { type: "string", minLen: 1, maxLen: 500, optional: true },
      content: { type: "string", minLen: 10, maxLen: 100000, required: true },
      coverImageUrl: { type: "string", minLen: 1, maxLen: 2000, optional: true },
      imageUrls: {
        type: "array",
        minLen: 1,
        maxLen: 24,
        items: { type: "string", minLen: 1, maxLen: 2000 },
        optional: true,
      },
      category: { type: "string", minLen: 1, maxLen: 120, optional: true },
      tags: { type: ["array", "string"], optional: true },
      status: { type: "string", minLen: 5, maxLen: 9, enum: ["draft", "published"], required: true },
    },
  },
  adminUploadCover: {
    allowUnknownBody: false,
    body: {
      fileName: { type: "string", minLen: 3, maxLen: 200, optional: true },
      contentBase64: { type: "string", minLen: 20, maxLen: 10000000, required: true },
    },
  },
};

module.exports = {
  searchSchemas,
  bookingSchemas,
  hotelSchemas,
  contentSchemas,
  contactSchemas,
  paymentSchemas,
  promoSchemas,
  authSchemas,
  blogSchemas,
};
