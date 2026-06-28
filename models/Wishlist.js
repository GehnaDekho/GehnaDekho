const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate a customer user with this wishlist item'],
      index: true
    },
    jewellery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jewellery',
      required: [true, 'Please specify the wishlisted jewellery item'],
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index to prevent duplicate additions
wishlistSchema.index({ user: 1, jewellery: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
