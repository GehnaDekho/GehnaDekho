const express = require('express');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  sendAdminNotification
} = require('../controllers/notification.controller');

// Import authentication middlewares
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// User Routes
router.get('/', protect, getUserNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);

// Admin Routes
router.post('/admin/send', protect, authorize('admin'), sendAdminNotification);

module.exports = router;
