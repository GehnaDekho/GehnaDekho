const express = require('express');
const router = express.Router();
const {
  createMetal,
  getMetals,
  getMetalById,
  updateMetal,
  deleteMetal
} = require('../controllers/metalController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('admin'), createMetal)
  .get(getMetals);

router.route('/:id')
  .get(getMetalById)
  .put(protect, authorize('admin'), updateMetal)
  .delete(protect, authorize('admin'), deleteMetal);

module.exports = router;
