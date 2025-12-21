"use strict";

const router = require("express").Router();
const paymentController = require("../controllers/paymentController");
const { validate } = require("../src/middlewares/validateRequest");
const { paymentSchemas } = require("../src/middlewares/requestSchemas");

router.post("/payments/floa/simulate", validate(paymentSchemas.floaSimulate), paymentController.simulatePlan);
router.post("/payments/floa/deal", validate(paymentSchemas.floaDeal), paymentController.createDeal);
router.post("/payments/floa/hotel/deal", validate(paymentSchemas.floaHotelDeal), paymentController.createHotelDeal);
router.post(
  "/payments/floa/deal/:dealReference/finalize",
  validate(paymentSchemas.floaFinalize),
  paymentController.finalizeDeal
);
router.get(
  "/payments/floa/deal/:dealReference",
  validate(paymentSchemas.floaGet),
  paymentController.getInstallment
);
router.post(
  "/payments/floa/deal/:dealReference/cancel",
  validate(paymentSchemas.floaCancel),
  paymentController.cancelDeal
);
router.post("/payments/payota/init", validate(paymentSchemas.payotaInit), paymentController.createCreditCardToken);

module.exports = router;
