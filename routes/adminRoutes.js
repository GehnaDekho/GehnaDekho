const express = require('express');
const router = express.Router();
const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  getDashboardStats
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public authentication routes
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

// Private profile routes
router.route('/profile')
  .get(protect, authorize('admin'), getAdminProfile)
  .put(protect, authorize('admin'), updateAdminProfile);

// ERP Dashboard Stats
router.get('/dashboard', protect, authorize('admin'), getDashboardStats);

module.exports = router;
