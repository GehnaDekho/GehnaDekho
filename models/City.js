const mongoose = require('mongoose');

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a city name'],
      trim: true,
      unique: true, // usually city names are unique
    },
    state: {
      type: String,
      required: [true, 'Please provide a state name'],
      trim: true,
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

module.exports = mongoose.model('City', citySchema);
