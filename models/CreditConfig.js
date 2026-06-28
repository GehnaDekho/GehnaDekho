const mongoose = require('mongoose');

const creditConfigSchema = new mongoose.Schema(
  {
    actionName: {
      type: String,
      required: [true, 'Please provide an action name'],
      trim: true
    },
    creditsRequired: {
      type: Number,
      required: [true, 'Please specify the required credits for this action'],
      min: [0, 'Credits required cannot be negative'],
      default: 0
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Define partial unique index for active configurations
creditConfigSchema.index(
  { actionName: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('CreditConfig', creditConfigSchema);
