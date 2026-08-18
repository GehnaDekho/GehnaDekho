const express = require('express');
const router = express.Router();
const {
  getMetalRates,
  createMetalRate,
  updateMetalRate,
  deleteMetalRate
} = require('../controllers/metalRateController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(getMetalRates)
  .post(protect, authorize('admin'), createMetalRate);

router.route('/:id')
  .put(protect, authorize('admin'), updateMetalRate)
  .delete(protect, authorize('admin'), deleteMetalRate);

module.exports = router;
