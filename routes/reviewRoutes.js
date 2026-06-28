const express = require('express');
const router = express.Router();
const {
  createReview,
  getOutletReviews,
} = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('customer'), createReview);

router.route('/outlet/:outletId')
  .get(getOutletReviews);

module.exports = router;
