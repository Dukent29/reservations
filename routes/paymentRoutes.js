"use strict";

const router = require("express").Router();
const paymentController = require("../controllers/paymentController");

router.post("/payments/floa/simulate", paymentController.simulatePlan);
router.post("/payments/floa/deal", paymentController.createDeal);
router.post("/payments/floa/deal/:dealReference/finalize", paymentController.finalizeDeal);
router.get("/payments/floa/deal/:dealReference", paymentController.getInstallment);
router.post("/payments/floa/deal/:dealReference/cancel", paymentController.cancelDeal);
router.post("/payments/payota/init", paymentController.createCreditCardToken);

module.exports = router;
