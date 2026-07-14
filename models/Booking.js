const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    jewelleryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jewellery',
      required: [true, 'Jewellery ID is required']
    },
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Outlet ID is required']
    },
    preferredDate: {
      type: Date,
      required: [true, 'Preferred visit date is required']
    },
    status: {
      type: String,
      enum: ['not_visited', 'visited'],
      default: 'not_visited'
    },
    remark: {
      type: String,
      trim: true,
      default: ''
    },
    visitedAt: {
      type: Date,
      default: null
    },
    revealed: {
      type: Boolean,
      default: false
    },
    revealedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient outlet dashboard querying
bookingSchema.index({ outletId: 1, preferredDate: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
