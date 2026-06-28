const mongoose = require('mongoose');

const outletSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate a user as the owner of the outlet']
    },
    name: {
      type: String,
      required: [true, 'Please add an outlet shop name'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Please add an outlet address']
    },
    phone: {
      type: String,
      required: [true, 'Please add an outlet contact phone number'],
      trim: true
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid outlet email',
      ],
      trim: true,
      default: ''
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },
    images: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    kycStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'on_hold'],
      default: 'pending'
    },
    kycDetails: {
      gstNumber: { type: String, default: '' },
      panNumber: { type: String, default: '' },
      documentUrl: { type: String, default: '' }
    },
    adminMessage: {
      type: String,
      default: ''
    },
    freeUploadsLimit: {
      type: Number,
      default: 10
    },
    isFeaturedHome: {
      type: Boolean,
      default: false
    },
    featuredPriority: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    creditWallet: {
      balance: {
        type: Number,
        default: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Outlet', outletSchema);
