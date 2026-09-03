const express = require('express');
const router = express.Router();
const {
  createSlot,
  getSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
  getAvailableSlots
} = require('../controllers/slotController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Main configurations
router.route('/')
  .post(protect, authorize('admin'), createSlot)
  .get(getSlots);

router.route('/available')
  .get(protect, getAvailableSlots);

router.route('/:id')
  .get(getSlotById)
  .put(protect, authorize('admin'), updateSlot)
  .delete(protect, authorize('admin'), deleteSlot);

module.exports = router;
