const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    slotNumber: {
      type: Number,
      required: [true, 'Please add a slot number'],
      min: [1, 'Slot number must be at least 1']
    },
    price: {
      type: Number,
      required: [true, 'Please add a credit price for this slot'],
      min: [0, 'Price cannot be negative']
    },
    description: {
      type: String,
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

// Define partial unique index for active slots
slotSchema.index(
  { slotNumber: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('Slot', slotSchema);
