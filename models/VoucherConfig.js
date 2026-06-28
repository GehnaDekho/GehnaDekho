const mongoose = require('mongoose');

const voucherConfigSchema = new mongoose.Schema(
  {
    actionName: {
      type: String,
      required: [true, 'Please provide the action name'],
      enum: ['rating', 'review', 'feedback'],
      trim: true,
    },
    pointsAwarded: {
      type: Number,
      required: [true, 'Please specify the points awarded for this action'],
      min: [0, 'Points awarded cannot be negative'],
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Define partial unique index for active configurations
voucherConfigSchema.index(
  { actionName: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('VoucherConfig', voucherConfigSchema);
