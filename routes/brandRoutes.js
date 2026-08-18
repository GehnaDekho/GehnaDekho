const express = require('express');
const router = express.Router();
const {
  getBrands,
  getAdminBrands,
  getHomeBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand
} = require('../controllers/brandController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getBrands);
router.get('/home', getHomeBrands);
router.get('/:id', getBrandById);

// Admin-only routes
router.get('/admin/list', protect, authorize('admin'), getAdminBrands);
router.post('/', protect, authorize('admin'), createBrand);
router.put('/:id', protect, authorize('admin'), updateBrand);
router.delete('/:id', protect, authorize('admin'), deleteBrand);

module.exports = router;
