const mongoose = require('mongoose');

const jewellerySchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate a jewellery item with an outlet']
    },
    name: {
      type: String,
      required: [true, 'Please add a jewellery name'],
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a category for this jewellery']
    },
    metal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Metal',
      required: [true, 'Please select a metal type for this jewellery']
    },
    images: {
      type: [String],
      required: [true, 'Please add at least one image of the jewellery'],
      validate: {
        validator: function(val) {
          return val && val.length > 0;
        },
        message: 'A jewellery item must have at least one image'
      }
    },
    description: {
      type: String,
      default: ''
    },
    material: {
      type: String,
      required: [true, 'Please add a material (e.g. Gold, Silver, Platinum, Diamond)'],
      trim: true
    },
    weight: {
      type: Number,
      required: [true, 'Please add the weight of the jewellery in grams']
    },
    purity: {
      type: String,
      required: [true, 'Please specify the purity (e.g. 22K, 18K, 925 Silver)']
    },
    price: {
      type: Number,
      required: [true, 'Please add the price of the jewellery']
    },
    rating: {
      type: Number,
      default: 0
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    is3DTryOnAvailable: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    views: {
      type: Number,
      default: 0
    },
    tryOnInteractions: {
      type: Number,
      default: 0
    },
    wishlistAdditions: {
      type: Number,
      default: 0
    },
    wishlistCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Jewellery', jewellerySchema);
