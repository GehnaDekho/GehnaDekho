const express = require('express');
const router = express.Router();
const {
  createFeaturedHistory,
  getFeaturedHistory,
  getFeaturedHistoryById,
  incrementClickCount,
  getTodayFeatured
} = require('../controllers/featuredJewelleryHistoryController');
const { protect } = require('../middleware/authMiddleware');

// Public route to fetch today's active autoscroll slider items in IST timezone
router.route('/today')
  .get(getTodayFeatured);

// Main routes
router.route('/')
  .post(protect, createFeaturedHistory)
  .get(protect, getFeaturedHistory);

// Click tracking is public so that any mobile application user clicks can be logged dynamically
router.route('/:id/click')
  .post(incrementClickCount);

// Single resource fetch
router.route('/:id')
  .get(protect, getFeaturedHistoryById);

module.exports = router;
