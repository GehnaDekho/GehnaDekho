const mongoose = require('mongoose');

const otpSessionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Please add a phone number'],
      unique: true,
      trim: true,
    },
    otp: {
      type: String,
      required: [true, 'Please add an OTP code'],
    },
    otpExpires: {
      type: Date,
      required: true,
      expires: 0, // TTL index: documents automatically delete when this date matches current time (after 5 minutes)
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OtpSession', otpSessionSchema);
