const Notification = require('../models/Notification');
const notificationService = require('../services/notification.service');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private (User)
exports.getUserNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Fetch user-specific notifications and general broadcast/topic notifications they are subscribed to
    // For simplicity, we fetch receiver=userId OR receiverType='all-users'
    // A robust system might also check topic subscriptions here.
    
    const targetMode = req.query.targetMode || 'user'; // 'user' or 'outlet'

    const query = {
      $and: [
        {
          $or: [
            { receiver: req.user.id },
            { receiverType: 'all-users' }
          ]
        },
        {
          targetMode: targetMode
        }
      ]
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      page,
      pages: Math.ceil(total / limit),
      data: notifications,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (User)
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private (User)
exports.markAllAsRead = async (req, res) => {
  try {
    const targetMode = req.query.targetMode || 'user';
    await Notification.updateMany(
      { receiver: req.user.id, targetMode: targetMode, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Send notification from Admin Panel
// @route   POST /api/notifications/admin/send
// @access  Private (Admin)
exports.sendAdminNotification = async (req, res) => {
  try {
    const { receiverType, receiver, topic, title, message, image, deepLink, priority, notificationType } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required' });
    }

    const payload = {
      sender: req.user.id, // Assumes authMiddleware sets req.user
      receiverType: receiverType || 'all-users',
      title,
      message,
      image,
      deepLink,
      priority,
      notificationType: notificationType || 'PROMOTIONAL',
      metadata: req.body.metadata || {}
    };

    if (receiverType === 'user') payload.receiver = receiver;
    if (receiverType === 'topic') payload.topic = topic;

    const result = await notificationService.createAndSend(payload);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
