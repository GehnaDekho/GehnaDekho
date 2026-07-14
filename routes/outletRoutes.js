const express = require('express');
const router = express.Router();
const {
  createOutlet,
  createOutletOwnerDirectly,
  getOutlets,
  getOutletById,
  updateOutlet,
  deleteOutlet,
  reviewOutletRequest,
  getOutletStats,
  getOutletPurchases,
  getFeaturedOutlets,
  getTopRankedOutlets
} = require('../controllers/outletController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Direct outlet owner creation (Admin only)
router.route('/direct')
  .post(protect, authorize('admin'), createOutletOwnerDirectly);

// Featured outlets for Home Screen (Public — must be before /:id)
router.route('/featured-home')
  .get(getFeaturedOutlets);

// Top ranked outlets by Quality Index for Home Screen (Public — must be before /:id)
router.route('/top-ranked')
  .get(getTopRankedOutlets);

// Route for creating an outlet (protected) and listing outlets (public)
router.route('/')
  .post(protect, createOutlet)
  .get(getOutlets);

// Administrative review status route
router.route('/:id/status')
  .put(protect, authorize('admin'), reviewOutletRequest);

// Route for getting outlet stats
router.route('/:id/stats')
  .get(protect, getOutletStats);

// Route for getting outlet purchases
router.route('/:id/purchases')
  .get(protect, getOutletPurchases);

// Routes for getting single outlet, updating (owner/admin), or deleting (admin only)
router.route('/:id')
  .get(getOutletById)
  .put(protect, updateOutlet)
  .delete(protect, authorize('admin'), deleteOutlet);

module.exports = router;
