const mongoose = require('mongoose');

const metalRateSchema = new mongoose.Schema(
  {
    metalType: {
      type: String,
      required: [true, 'Please provide a metal type identifier (e.g. gold, platinum)'],
      unique: true,
      trim: true
    },
    label: {
      type: String,
      required: [true, 'Please provide a display label (e.g. GOLD 24K)']
    },
    price: {
      type: String,
      required: [true, 'Please provide the price (e.g. ₹8,425)']
    },
    change: {
      type: String,
      default: ''
    },
    up: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MetalRate', metalRateSchema);
