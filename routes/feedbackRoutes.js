const express = require('express');
const router = express.Router();
const {
  createFeedback,
  getOutletFeedbacks,
  unlockFeedback
} = require('../controllers/feedbackController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Customer submits private feedback
router.route('/')
  .post(protect, authorize('customer'), createFeedback);

// Outlet owner reads feedback catalog targeting their outlet
router.route('/outlet')
  .get(protect, authorize('outlet_owner'), getOutletFeedbacks);

// Outlet owner spends credits to unlock and view full feedback text
router.route('/:id/unlock')
  .post(protect, authorize('outlet_owner'), unlockFeedback);

module.exports = router;
