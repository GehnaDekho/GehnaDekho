const express = require('express');
const router = express.Router();
const {
  createRatingCriteria,
  getRatingCriteria,
  updateRatingCriteria,
  deleteRatingCriteria,
} = require('../controllers/ratingCriteriaController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('admin'), createRatingCriteria)
  .get(protect, getRatingCriteria);

router.route('/:id')
  .put(protect, authorize('admin'), updateRatingCriteria)
  .delete(protect, authorize('admin'), deleteRatingCriteria);

module.exports = router;
