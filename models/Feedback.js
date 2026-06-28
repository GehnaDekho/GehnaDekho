const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate a customer user sending this feedback'],
      index: true
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate the target outlet for this feedback'],
      index: true
    },
    feedbackText: {
      type: String,
      required: [true, 'Please provide private feedback text content'],
      trim: true
    },
    status: {
      type: String,
      enum: ['unread', 'read'],
      default: 'unread'
    },
    isUnlocked: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Pre-save validation ensuring outlet owners cannot leave private feedback
feedbackSchema.pre('save', async function (next) {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(this.user);
    if (!user) {
      return next(new Error('User account not found'));
    }

    if (user.role === 'outlet_owner' || user.outletId) {
      return next(new Error('Outlet owners are not permitted to leave ratings, reviews, or private feedback'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
