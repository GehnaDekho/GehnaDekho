const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    required: true,
  },
  offerType: {
    type: String,
    enum: ['discount', 'freebie', 'cashback', 'event', 'seasonal', 'other'],
    required: true,
  },
  discountValue: {
    type: String,
  },
  termsAndConditions: {
    type: String,
  },
  priority: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

// Compound index to optimize active offers query
offerSchema.index({ city: 1, isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Offer', offerSchema);
