const mongoose = require('mongoose');

const jewelleryReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate a reviewer user'],
      index: true
    },
    jewellery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jewellery',
      required: [true, 'Please associate a target jewellery'],
      index: true
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5']
    },
    reviewText: {
      type: String,
      default: '',
      trim: true
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

// Enforce compound index to ensure a customer can leave exactly ONE review per jewellery
jewelleryReviewSchema.index({ user: 1, jewellery: 1 }, { unique: true });

module.exports = mongoose.model('JewelleryReview', jewelleryReviewSchema);
