const Notification = require('../models/Notification');
const User = require('../models/User');
const pushNotificationService = require('./pushNotification.service');

class NotificationService {
  
  /**
   * Core method to create a notification and send push
   * @param {Object} data 
   */
  async createAndSend(data) {
    try {
      // 1. Create DB Record
      const notification = await Notification.create({
        sender: data.sender || null,
        receiver: data.receiver || null,
        receiverType: data.receiverType || 'user',
        targetMode: data.targetMode || 'user',
        topic: data.topic || null,
        title: data.title,
        message: data.message,
        notificationType: data.notificationType || 'SYSTEM',
        eventId: data.eventId || null,
        image: data.image || null,
        deepLink: data.deepLink || null,
        metadata: data.metadata || {},
        priority: data.priority || 'normal',
      });

      // 2. Prepare Push Payload
      const pushPayload = {
        title: data.title,
        body: data.message,
        priority: data.priority || 'normal',
        image: data.image || null,
        data: {
          notificationId: notification._id.toString(),
          notificationType: data.notificationType || 'SYSTEM',
          eventId: data.eventId ? data.eventId.toString() : '',
          deepLink: data.deepLink || '',
          ...data.metadata
        }
      };

      // 3. Send Push Notification based on receiverType
      let pushResult;

      if (data.receiverType === 'user' && data.receiver) {
        // Fetch User's tokens
        const user = await User.findById(data.receiver).select('devices');
        if (user && user.devices && user.devices.length > 0) {
          const activeTokens = user.devices
            .filter(device => device.active && device.token)
            .map(device => device.token);
          
          if (activeTokens.length > 0) {
            pushResult = await pushNotificationService.sendMulticast(activeTokens, pushPayload);
          }
        }
      } else if (data.receiverType === 'topic' && data.topic) {
        pushResult = await pushNotificationService.sendToTopic(data.topic, pushPayload);
      } else if (data.receiverType === 'all-users') {
        // We can send to a default topic 'general' instead of querying all users,
        // or we can batch query all tokens. Topic is preferred.
        pushResult = await pushNotificationService.sendToTopic('general', pushPayload);
      }

      // 4. Update Delivery Status
      if (pushResult && pushResult.success) {
        notification.deliveryStatus = 'sent';
      } else {
        notification.deliveryStatus = 'failed';
        // Note: we still save it in DB so users see it in-app
      }
      await notification.save();

      return { success: true, notification, pushResult };

    } catch (error) {
      console.error('NotificationService createAndSend error:', error);
      throw error;
    }
  }

  /**
   * Helper: Send to a single user
   */
  async sendToUser(userId, title, message, extras = {}) {
    return this.createAndSend({
      receiver: userId,
      receiverType: 'user',
      title,
      message,
      ...extras
    });
  }

  /**
   * Helper: Send to a topic
   */
  async sendToTopic(topicName, title, message, extras = {}) {
    return this.createAndSend({
      receiverType: 'topic',
      topic: topicName,
      title,
      message,
      ...extras
    });
  }

  /**
   * Helper: Broadcast to all users
   */
  async sendBroadcast(title, message, extras = {}) {
    return this.createAndSend({
      receiverType: 'all-users',
      title,
      message,
      ...extras
    });
  }
}

module.exports = new NotificationService();
