const express = require('express');
const router = express.Router();
const {
  getCities,
  createCity,
  updateCity,
  deleteCity
} = require('../controllers/cityController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Public route to get cities (often needed for dropdowns in user apps)
router.get('/', getCities);

// Admin only routes
router.use(protect);
router.use(authorize('admin'));

router.post('/', createCity);
router.route('/:id')
  .put(updateCity)
  .delete(deleteCity);

module.exports = router;
