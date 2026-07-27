const mongoose = require('mongoose');

const metalSchema = new mongoose.Schema(
  {
    metalName: {
      type: String,
      required: [true, 'Please add a metal name'],
      unique: true,
      trim: true
    },
    image: {
      type: String,
      required: [true, 'Please add a metal image URL']
    },
    description: {
      type: String,
      default: ''
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

module.exports = mongoose.model('Metal', metalSchema);
