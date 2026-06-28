const express = require('express');
const router = express.Router();
const {
  createRedeemRequest,
  getRedeemRequests,
  reviewRedeemRequest,
} = require('../controllers/redeemRequestController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('customer'), createRedeemRequest)
  .get(protect, getRedeemRequests);

router.route('/:id/review')
  .put(protect, authorize('admin'), reviewRedeemRequest);

module.exports = router;
