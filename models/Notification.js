const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin', // or User, depending on who sends
      default: null,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receiverType: {
      type: String,
      enum: ['user', 'all-users', 'topic'],
      required: true,
      default: 'user',
    },
    targetMode: {
      type: String,
      enum: ['user', 'outlet', 'both'],
      default: 'user',
    },
    topic: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Please provide a title'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Please provide a message'],
    },
    notificationType: {
      type: String,
      default: 'SYSTEM', // e.g., 'SYSTEM', 'PROMOTIONAL', 'ORDER', etc.
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    image: {
      type: String,
      default: null,
    },
    deepLink: {
      type: String,
      default: null,
    },
    metadata: {
      type: Object,
      default: {},
    },
    priority: {
      type: String,
      enum: ['high', 'normal'],
      default: 'normal',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster querying
notificationSchema.index({ receiver: 1, createdAt: -1 });
notificationSchema.index({ receiverType: 1 });
notificationSchema.index({ isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
