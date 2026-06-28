const express = require('express');
const router = express.Router();
const {
  getVoucherTransactions,
  getVoucherTransactionById,
} = require('../controllers/voucherTransactionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All ledger routes require authentication

router.route('/')
  .get(getVoucherTransactions);

router.route('/:id')
  .get(getVoucherTransactionById);

module.exports = router;
