const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Please add a phone number'],
      unique: true,
    },
    profilePhoto: {
      type: String,
      default: 'default.jpg',
    },
    role: {
      type: String,
      enum: ['customer', 'outlet_owner'],
      default: 'customer',
    },
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      default: null,
    },
    rewardPoints: {
      type: Number,
      default: 0,
    },
    wishlistAdditions: {
      type: Number,
      default: 0,
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
