"use strict";

const db = require("../utils/db");
const httpError = require("../src/utils/httpError");
const { fetchVoucherForBooking } = require("./bookingController");
const {
  ensurePaymentsSchema,
  ensureBookingsSchema,
  ensureAdminNotificationsSchema,
  listAdminNotifications,
  markAdminNotificationRead,
} = require("../utils/repo");
const {
  ensureUsersRoleSchema,
  countUsers,
  listUsers,
  updateUserRole,
} = require("../models/userModel");
const { enrichReservationRows } = require("./adminHelpers");

function normalizeLimit(rawValue, fallback = 20, max = 200) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeOffset(rawValue, fallback = 0) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeDateInput(rawValue) {
  const value = String(rawValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value;
}

function diffDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function sanitizeFilename(filename, fallback) {
  return String(filename || fallback || "voucher.pdf").replace(/["\r\n]/g, "_");
}

function isMissingRelation(error) {
  return String(error?.code || "") === "42P01";
}

async function safeQueryRows(queryText, params = []) {
  try {
    const result = await db.query(queryText, params);
    return result.rows || [];
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

async function safeQueryFirstRow(queryText, params = [], fallback = {}) {
  const rows = await safeQueryRows(queryText, params);
  return rows[0] || fallback;
}

async function getOverview(_req, res, next) {
  try {
    await Promise.all([
      ensureUsersRoleSchema(),
      ensurePaymentsSchema(),
      ensureBookingsSchema(),
      ensureAdminNotificationsSchema(),
    ]);

    const period = String(_req.query?.period || "week").trim().toLowerCase();
    const startDate = normalizeDateInput(_req.query?.start);
    const endDate = normalizeDateInput(_req.query?.end);
    const hasCustomRange = startDate && endDate && startDate <= endDate;
    const customRangeDays = hasCustomRange ? diffDaysInclusive(startDate, endDate) : 0;
    const chartPeriodConfig =
      hasCustomRange
        ? customRangeDays > 92
          ? {
              bookingSeriesSql: `
                WITH months AS (
                  SELECT generate_series(
                    date_trunc('month', $1::date),
                    date_trunc('month', $2::date),
                    INTERVAL '1 month'
                  )::date AS point
                ),
                latest_bookings AS (
                  SELECT DISTINCT ON (partner_order_id) *
                    FROM bookings
                   ORDER BY partner_order_id, id DESC
                )
                SELECT TO_CHAR(months.point, 'Mon YY') AS label,
                       COALESCE(COUNT(lb.id), 0)::int AS value
                  FROM months
                  LEFT JOIN latest_bookings lb
                    ON date_trunc('month', lb.created_at) = months.point::timestamp
                   AND DATE(lb.created_at) BETWEEN $1::date AND $2::date
                 GROUP BY months.point
                 ORDER BY months.point`,
              revenueSeriesSql: `
                WITH months AS (
                  SELECT generate_series(
                    date_trunc('month', $1::date),
                    date_trunc('month', $2::date),
                    INTERVAL '1 month'
                  )::date AS point
                )
                SELECT TO_CHAR(months.point, 'Mon YY') AS label,
                       COALESCE(SUM(p.amount) FILTER (WHERE lower(p.status) IN ('paid', 'success')), 0)::numeric AS value
                  FROM months
                  LEFT JOIN payments p
                    ON date_trunc('month', p.created_at) = months.point::timestamp
                   AND DATE(p.created_at) BETWEEN $1::date AND $2::date
                 GROUP BY months.point
                 ORDER BY months.point`,
              providersSql: `
                SELECT COALESCE(NULLIF(provider, ''), 'unknown') AS label,
                       COUNT(*)::int AS value
                  FROM payments
                 WHERE DATE(created_at) BETWEEN $1::date AND $2::date
                 GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
                 ORDER BY value DESC
                 LIMIT 6`,
              params: [startDate, endDate],
              resolvedPeriod: "custom",
              startDate,
              endDate,
            }
          : {
              bookingSeriesSql: `
                WITH days AS (
                  SELECT generate_series(
                    $1::date,
                    $2::date,
                    INTERVAL '1 day'
                  )::date AS point
                ),
                latest_bookings AS (
                  SELECT DISTINCT ON (partner_order_id) *
                    FROM bookings
                   ORDER BY partner_order_id, id DESC
                )
                SELECT TO_CHAR(days.point, 'DD Mon') AS label,
                       COALESCE(COUNT(lb.id), 0)::int AS value
                  FROM days
                  LEFT JOIN latest_bookings lb
                    ON DATE(lb.created_at) = days.point
                 GROUP BY days.point
                 ORDER BY days.point`,
              revenueSeriesSql: `
                WITH days AS (
                  SELECT generate_series(
                    $1::date,
                    $2::date,
                    INTERVAL '1 day'
                  )::date AS point
                )
                SELECT TO_CHAR(days.point, 'DD Mon') AS label,
                       COALESCE(SUM(p.amount) FILTER (WHERE lower(p.status) IN ('paid', 'success')), 0)::numeric AS value
                  FROM days
                  LEFT JOIN payments p
                    ON DATE(p.created_at) = days.point
                 GROUP BY days.point
                 ORDER BY days.point`,
              providersSql: `
                SELECT COALESCE(NULLIF(provider, ''), 'unknown') AS label,
                       COUNT(*)::int AS value
                  FROM payments
                 WHERE DATE(created_at) BETWEEN $1::date AND $2::date
                 GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
                 ORDER BY value DESC
                 LIMIT 6`,
              params: [startDate, endDate],
              resolvedPeriod: "custom",
              startDate,
              endDate,
            }
        : period === "month"
        ? {
            bookingSeriesSql: `
              WITH days AS (
                SELECT generate_series(
                  CURRENT_DATE - INTERVAL '29 day',
                  CURRENT_DATE,
                  INTERVAL '1 day'
                )::date AS point
              ),
              latest_bookings AS (
                SELECT DISTINCT ON (partner_order_id) *
                  FROM bookings
                 ORDER BY partner_order_id, id DESC
              )
              SELECT TO_CHAR(days.point, 'DD Mon') AS label,
                     COALESCE(COUNT(lb.id), 0)::int AS value
                FROM days
                LEFT JOIN latest_bookings lb
                  ON DATE(lb.created_at) = days.point
               GROUP BY days.point
               ORDER BY days.point`,
            revenueSeriesSql: `
              WITH days AS (
                SELECT generate_series(
                  CURRENT_DATE - INTERVAL '29 day',
                  CURRENT_DATE,
                  INTERVAL '1 day'
                )::date AS point
              )
              SELECT TO_CHAR(days.point, 'DD Mon') AS label,
                     COALESCE(SUM(p.amount) FILTER (WHERE lower(p.status) IN ('paid', 'success')), 0)::numeric AS value
                FROM days
                LEFT JOIN payments p
                  ON DATE(p.created_at) = days.point
               GROUP BY days.point
               ORDER BY days.point`,
            providersSql: `
              SELECT COALESCE(NULLIF(provider, ''), 'unknown') AS label,
                     COUNT(*)::int AS value
                FROM payments
               WHERE created_at >= CURRENT_DATE - INTERVAL '29 day'
               GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
               ORDER BY value DESC
               LIMIT 6`,
            params: [],
            resolvedPeriod: "month",
            startDate: "",
            endDate: "",
          }
        : period === "year"
          ? {
              bookingSeriesSql: `
                WITH months AS (
                  SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - INTERVAL '11 month',
                    date_trunc('month', CURRENT_DATE),
                    INTERVAL '1 month'
                  )::date AS point
                ),
                latest_bookings AS (
                  SELECT DISTINCT ON (partner_order_id) *
                    FROM bookings
                   ORDER BY partner_order_id, id DESC
                )
                SELECT TO_CHAR(months.point, 'Mon YY') AS label,
                       COALESCE(COUNT(lb.id), 0)::int AS value
                  FROM months
                  LEFT JOIN latest_bookings lb
                    ON date_trunc('month', lb.created_at) = months.point::timestamp
                 GROUP BY months.point
                 ORDER BY months.point`,
              revenueSeriesSql: `
                WITH months AS (
                  SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - INTERVAL '11 month',
                    date_trunc('month', CURRENT_DATE),
                    INTERVAL '1 month'
                  )::date AS point
                )
                SELECT TO_CHAR(months.point, 'Mon YY') AS label,
                       COALESCE(SUM(p.amount) FILTER (WHERE lower(p.status) IN ('paid', 'success')), 0)::numeric AS value
                  FROM months
                  LEFT JOIN payments p
                    ON date_trunc('month', p.created_at) = months.point::timestamp
                 GROUP BY months.point
                 ORDER BY months.point`,
              providersSql: `
                SELECT COALESCE(NULLIF(provider, ''), 'unknown') AS label,
                       COUNT(*)::int AS value
                  FROM payments
                 WHERE created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 month'
                 GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
                 ORDER BY value DESC
                 LIMIT 6`,
              params: [],
              resolvedPeriod: "year",
              startDate: "",
              endDate: "",
            }
          : {
              bookingSeriesSql: `
                WITH days AS (
                  SELECT generate_series(
                    CURRENT_DATE - INTERVAL '6 day',
                    CURRENT_DATE,
                    INTERVAL '1 day'
                  )::date AS point
                ),
                latest_bookings AS (
                  SELECT DISTINCT ON (partner_order_id) *
                    FROM bookings
                   ORDER BY partner_order_id, id DESC
                )
                SELECT TO_CHAR(days.point, 'DD Mon') AS label,
                       COALESCE(COUNT(lb.id), 0)::int AS value
                  FROM days
                  LEFT JOIN latest_bookings lb
                    ON DATE(lb.created_at) = days.point
                 GROUP BY days.point
                 ORDER BY days.point`,
              revenueSeriesSql: `
                WITH days AS (
                  SELECT generate_series(
                    CURRENT_DATE - INTERVAL '6 day',
                    CURRENT_DATE,
                    INTERVAL '1 day'
                  )::date AS point
                )
                SELECT TO_CHAR(days.point, 'DD Mon') AS label,
                       COALESCE(SUM(p.amount) FILTER (WHERE lower(p.status) IN ('paid', 'success')), 0)::numeric AS value
                  FROM days
                  LEFT JOIN payments p
                    ON DATE(p.created_at) = days.point
                 GROUP BY days.point
                 ORDER BY days.point`,
              providersSql: `
                SELECT COALESCE(NULLIF(provider, ''), 'unknown') AS label,
                       COUNT(*)::int AS value
                  FROM payments
                 WHERE created_at >= CURRENT_DATE - INTERVAL '6 day'
                 GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
                 ORDER BY value DESC
                 LIMIT 6`,
              params: [],
              resolvedPeriod: "week",
              startDate: "",
              endDate: "",
            };

    const [
      bookingTotals,
      paymentTotals,
      userTotals,
      blogTotals,
      bookingsByDayRows,
      revenueByDayRows,
      paymentsByProviderRows,
      unreadNotifications,
    ] = await Promise.all([
      safeQueryFirstRow(
        `SELECT COUNT(*)::int AS total_bookings,
                COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed', 'ok'))::int AS confirmed_bookings,
                COUNT(*) FILTER (WHERE voucher_status = 'ready')::int AS ready_vouchers
           FROM (
             SELECT DISTINCT ON (partner_order_id) *
               FROM bookings
              ORDER BY partner_order_id, id DESC
           ) latest_bookings`
      ),
      safeQueryFirstRow(
        `SELECT COUNT(*)::int AS total_payments,
                COALESCE(SUM(amount) FILTER (WHERE lower(status) IN ('paid', 'success')), 0)::numeric AS paid_revenue
           FROM payments`
      ),
      safeQueryFirstRow(`SELECT COUNT(*)::int AS total_users FROM public.users`),
      safeQueryFirstRow(
        `SELECT COUNT(*)::int AS total_posts,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published_posts
           FROM blog_posts`
      ),
      safeQueryRows(chartPeriodConfig.bookingSeriesSql, chartPeriodConfig.params),
      safeQueryRows(chartPeriodConfig.revenueSeriesSql, chartPeriodConfig.params),
      safeQueryRows(chartPeriodConfig.providersSql, chartPeriodConfig.params),
      safeQueryFirstRow(
        `SELECT COUNT(*)::int AS unread
           FROM admin_notifications
          WHERE read_at IS NULL`
      ),
    ]);

    return res.json({
      status: "ok",
      metrics: {
        totalBookings: Number(bookingTotals.total_bookings || 0),
        confirmedBookings: Number(bookingTotals.confirmed_bookings || 0),
        readyVouchers: Number(bookingTotals.ready_vouchers || 0),
        totalPayments: Number(paymentTotals.total_payments || 0),
        paidRevenue: Number(paymentTotals.paid_revenue || 0),
        totalUsers: Number(userTotals.total_users || 0),
        totalPosts: Number(blogTotals.total_posts || 0),
        publishedPosts: Number(blogTotals.published_posts || 0),
        unreadNotifications: Number(unreadNotifications.unread || 0),
      },
      charts: {
        activity: bookingsByDayRows.map((row) => ({
          label: row.label,
          value: Number(row.value || 0),
        })),
        revenue: revenueByDayRows.map((row) => ({
          label: row.label,
          value: Number(row.value || 0),
        })),
        paymentProviders: paymentsByProviderRows.map((row) => ({
          label: row.label,
          value: Number(row.value || 0),
        })),
      },
      period: chartPeriodConfig.resolvedPeriod,
      range: {
        start: chartPeriodConfig.startDate,
        end: chartPeriodConfig.endDate,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getPayments(req, res, next) {
  try {
    await ensurePaymentsSchema();
    const limit = normalizeLimit(req.query?.limit, 15, 50);
    const offset = normalizeOffset(req.query?.offset, 0);
    const [payments, totals] = await Promise.all([
      safeQueryRows(
      `SELECT id,
              partner_order_id,
              provider,
              status,
              amount,
              currency_code,
              external_reference,
              systempay_order_id,
              created_at
         FROM payments
        ORDER BY created_at DESC, id DESC
        LIMIT $1
        OFFSET $2`,
        [limit, offset]
      ),
      safeQueryFirstRow(`SELECT COUNT(*)::int AS total FROM payments`),
    ]);
    return res.json({
      status: "ok",
      payments,
      pagination: { total: Number(totals.total || 0), limit, offset },
    });
  } catch (error) {
    return next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const limit = normalizeLimit(req.query?.limit, 15, 50);
    const offset = normalizeOffset(req.query?.offset, 0);
    const [users, total] = await Promise.all([
      listUsers(limit, offset),
      countUsers(),
    ]);
    return res.json({
      status: "ok",
      users,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    return next(error);
  }
}

async function changeUserRole(req, res, next) {
  try {
    const currentRole = String(req.adminAuth?.user?.role || "").toLowerCase();
    if (currentRole !== "admin") {
      return next(httpError(403, "forbidden"));
    }

    const userId = String(req.params?.id || "").trim();
    const role = String(req.body?.role || "").trim().toLowerCase();
    if (!userId || !role) {
      return next(httpError(400, "missing_user_role_payload"));
    }
    if (String(req.adminAuth?.user?.id || "") === userId) {
      return next(httpError(400, "cannot_update_own_role"));
    }

    const updatedUser = await updateUserRole(userId, role);
    if (!updatedUser) {
      return next(httpError(404, "user_not_found"));
    }

    return res.json({ status: "ok", user: updatedUser });
  } catch (error) {
    return next(error);
  }
}

async function getReservations(req, res, next) {
  try {
    await Promise.all([ensurePaymentsSchema(), ensureBookingsSchema()]);

    const limit = normalizeLimit(req.query?.limit, 15, 50);
    const offset = normalizeOffset(req.query?.offset, 0);
    const search = String(req.query?.q || "").trim().toLowerCase();
    const filterValues = [];
    let filterSql = "";

    if (search) {
      filterValues.push(`%${search}%`);
      filterSql = `
        WHERE LOWER(COALESCE(lb.partner_order_id, '')) LIKE $1
           OR LOWER(COALESCE(lb.user_email, '')) LIKE $1
           OR LOWER(COALESCE(lb.user_name, '')) LIKE $1
           OR LOWER(COALESCE(lb.raw #>> '{debug,request,rooms,0,guests,0,first_name}', '')) LIKE $1
           OR LOWER(COALESCE(lb.raw #>> '{debug,request,rooms,0,guests,0,last_name}', '')) LIKE $1
           OR LOWER(COALESCE(lb.raw #>> '{debug,request,supplier_data,first_name_original}', '')) LIKE $1
           OR LOWER(COALESCE(lb.raw #>> '{debug,request,supplier_data,last_name_original}', '')) LIKE $1
           OR LOWER(
             TRIM(
               CONCAT_WS(
                 ' ',
                 COALESCE(
                   lb.raw #>> '{debug,request,rooms,0,guests,0,first_name}',
                   lb.raw #>> '{debug,request,supplier_data,first_name_original}',
                   ''
                 ),
                 COALESCE(
                   lb.raw #>> '{debug,request,rooms,0,guests,0,last_name}',
                   lb.raw #>> '{debug,request,supplier_data,last_name_original}',
                   ''
                 )
               )
             )
           ) LIKE $1
      `;
    }

    const listValues = [...filterValues, limit, offset];
    const [reservations, totals] = await Promise.all([
      safeQueryRows(
      `WITH latest_bookings AS (
         SELECT DISTINCT ON (partner_order_id) *
           FROM bookings
          ORDER BY partner_order_id, id DESC
       )
       SELECT lb.id,
              lb.partner_order_id,
              lb.prebook_token,
              lb.etg_order_id,
              lb.status,
              lb.user_email,
              lb.user_phone,
              lb.user_name,
              lb.raw AS booking_raw,
              lb.amount,
              lb.currency_code,
              lb.voucher_status,
              lb.voucher_attempts,
              lb.voucher_last_error,
              lb.voucher_filename,
              lb.voucher_ready_at,
              lb.created_at,
              payment.provider AS payment_provider,
              payment.status AS payment_status,
              payment.amount AS payment_amount,
              payment.currency_code AS payment_currency_code,
              form.form AS booking_form
         FROM latest_bookings lb
         LEFT JOIN LATERAL (
           SELECT p.provider, p.status, p.amount, p.currency_code
             FROM payments p
            WHERE p.partner_order_id = lb.partner_order_id
            ORDER BY p.id DESC
            LIMIT 1
         ) payment ON TRUE
         LEFT JOIN LATERAL (
           SELECT bf.form
             FROM booking_forms bf
            WHERE bf.partner_order_id = lb.partner_order_id
            ORDER BY bf.id DESC
            LIMIT 1
         ) form ON TRUE
         ${filterSql}
        ORDER BY lb.created_at DESC, lb.id DESC
        LIMIT $${filterValues.length + 1}
        OFFSET $${filterValues.length + 2}`,
      listValues
    ),
      safeQueryFirstRow(
        `WITH latest_bookings AS (
           SELECT DISTINCT ON (partner_order_id) *
             FROM bookings
            ORDER BY partner_order_id, id DESC
         )
         SELECT COUNT(*)::int AS total
           FROM latest_bookings lb
           ${filterSql}`,
        filterValues
      ),
    ]);

    const enrichedReservations = await enrichReservationRows(reservations);

    return res.json({
      status: "ok",
      reservations: enrichedReservations,
      pagination: { total: Number(totals.total || 0), limit, offset },
    });
  } catch (error) {
    return next(error);
  }
}

async function getNotifications(req, res, next) {
  try {
    await ensureAdminNotificationsSchema();
    const notifications = await listAdminNotifications(
      normalizeLimit(req.query?.limit, 12, 50),
    );
    return res.json({
      status: "ok",
      notifications,
      unread: notifications.filter((item) => !item.read_at).length,
    });
  } catch (error) {
    return next(error);
  }
}

async function readNotification(req, res, next) {
  try {
    await ensureAdminNotificationsSchema();
    const notification = await markAdminNotificationRead(req.params?.id);
    if (!notification) {
      return next(httpError(404, "notification_not_found"));
    }
    return res.json({ status: "ok", notification });
  } catch (error) {
    return next(error);
  }
}

async function downloadReservationVoucher(req, res, next) {
  try {
    const partnerOrderId = String(req.params?.partnerOrderId || "").trim();
    const language = String(req.query?.language || "fr").trim() || "fr";
    const voucher = await fetchVoucherForBooking(partnerOrderId, { language });

    res.setHeader("Content-Type", voucher.contentType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizeFilename(
        voucher.filename,
        `bedtrip-voucher-${partnerOrderId}.pdf`
      )}"`
    );

    return res.send(voucher.buffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOverview,
  getPayments,
  getUsers,
  changeUserRole,
  getReservations,
  downloadReservationVoucher,
  getNotifications,
  readNotification,
};
