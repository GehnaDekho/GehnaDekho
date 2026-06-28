const mongoose = require('mongoose');

const featuredJewelleryHistorySchema = new mongoose.Schema(
  {
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      required: [true, 'Please associate a Slot configuration']
    },
    jewellery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Jewellery',
      required: [true, 'Please associate a Jewellery catalogue item']
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate an Outlet shop']
    },
    date: {
      type: Date,
      default: Date.now,
      required: [true, 'Please specify the feature booking date']
    },
    clickCount: {
      type: Number,
      default: 0,
      min: [0, 'Click count cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

// Add optimized compound indexing for fast lookups
featuredJewelleryHistorySchema.index({ outlet: 1, date: -1 });
featuredJewelleryHistorySchema.index({ jewellery: 1 });
featuredJewelleryHistorySchema.index({ slot: 1 });

module.exports = mongoose.model('FeaturedJewelleryHistory', featuredJewelleryHistorySchema);
