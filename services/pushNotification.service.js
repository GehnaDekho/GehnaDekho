const firebaseService = require('./firebase.service');
const User = require('../models/User');

class PushNotificationService {
  
  /**
   * Send a notification to a specific device token
   * @param {string} token 
   * @param {object} payload 
   */
  async sendToDevice(token, payload) {
    try {
      const messaging = firebaseService.getMessaging();
      const message = {
        token,
        ...this._formatPayload(payload)
      };
      const response = await messaging.send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('PushNotificationService sendToDevice error:', error);
      this._handleFirebaseError(error, token);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a notification to multiple device tokens
   * @param {Array<string>} tokens 
   * @param {object} payload 
   */
  async sendMulticast(tokens, payload) {
    if (!tokens || tokens.length === 0) return { success: false, error: 'No tokens provided' };
    
    try {
      const messaging = firebaseService.getMessaging();
      const message = {
        tokens,
        ...this._formatPayload(payload)
      };
      
      const response = await messaging.sendEachForMulticast(message);
      
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            this._handleFirebaseError(resp.error, tokens[idx]);
          }
        });
        console.log(`Multicast sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);
      }
      
      return { success: true, response };
    } catch (error) {
      console.error('PushNotificationService sendMulticast error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a notification to a specific topic
   * @param {string} topic 
   * @param {object} payload 
   */
  async sendToTopic(topic, payload) {
    try {
      const messaging = firebaseService.getMessaging();
      const message = {
        topic,
        ...this._formatPayload(payload)
      };
      const response = await messaging.send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('PushNotificationService sendToTopic error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format payload to match FCM requirements
   * @param {object} payload 
   */
  _formatPayload(payload) {
    const { title, body, data, image } = payload;
    
    // Convert all values in data to strings (FCM requirement)
    const stringifiedData = {};
    if (data) {
      for (const key in data) {
        if (data[key] !== null && data[key] !== undefined) {
          stringifiedData[key] = typeof data[key] === 'object' 
            ? JSON.stringify(data[key]) 
            : String(data[key]);
        }
      }
    }

    return {
      notification: {
        title,
        body,
        ...(image && { imageUrl: image })
      },
      data: stringifiedData,
      android: {
        priority: payload.priority === 'high' ? 'high' : 'normal',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            'mutable-content': 1
          }
        },
        fcm_options: {
          ...(image && { image })
        }
      }
    };
  }

  /**
   * Handle invalid tokens and remove them from User records
   * @param {Error} error 
   * @param {string} token 
   */
  async _handleFirebaseError(error, token) {
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log(`Removing invalid token: ${token}`);
      try {
        // Remove this token from any user that has it
        await User.updateMany(
          { "devices.token": token },
          { $pull: { devices: { token } } }
        );
      } catch (dbError) {
        console.error('Error removing invalid token from database:', dbError);
      }
    }
  }
}

module.exports = new PushNotificationService();
