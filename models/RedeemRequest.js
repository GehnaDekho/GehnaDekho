const mongoose = require('mongoose');

const redeemRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate the requesting user account'],
      index: true,
    },
    points: {
      type: Number,
      required: [true, 'Please specify the points amount to redeem'],
      validate: {
        validator: function (val) {
          return val > 0 && val % 500 === 0;
        },
        message: 'Redemption points must be a positive multiple of 500 (e.g. 500, 1000, 1500).',
      },
    },
    status: {
      type: String,
      required: [true, 'Please specify request status'],
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminMessage: {
      type: String,
      default: '',
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('RedeemRequest', redeemRequestSchema);
