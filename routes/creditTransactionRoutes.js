const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createManualTransaction,
  updateTransactionStatus,
  getOutletStats
} = require('../controllers/creditTransactionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Main routes for transactions
router.route('/')
  .get(protect, getTransactions)
  .post(protect, authorize('admin'), createManualTransaction);

// Stats route
router.route('/outlet/:outletId/stats')
  .get(protect, getOutletStats);

// Single transaction routes
router.route('/:id')
  .get(protect, getTransactionById);

router.route('/:id/status')
  .put(protect, authorize('admin'), updateTransactionStatus);

module.exports = router;
