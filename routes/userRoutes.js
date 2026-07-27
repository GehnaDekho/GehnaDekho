const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  verifyOTP,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateDeviceToken
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public auth routes
router.route('/register').post(registerUser);
router.route('/login').post(loginUser);
router.route('/verify-otp').post(verifyOTP);

// Protected User routes
router.route('/update-device').post(protect, updateDeviceToken);

// Admin-only and protected CRUD routes
router.route('/')
  .get(protect, authorize('admin'), getUsers);

router.route('/:id')
  .get(protect, getUserById)
  .put(protect, updateUser)
  .delete(protect, authorize('admin'), deleteUser);

module.exports = router;
