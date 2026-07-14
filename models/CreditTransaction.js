const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    // ==========================================
    // ACCOUNT REFERENCE
    // ==========================================
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate an outlet with this transaction'],
      index: true
    },

    // ==========================================
    // TRANSACTION VALUE & WALLET STATUS
    // ==========================================
    credits: {
      type: Number,
      required: [true, 'Please specify the number of credits transacted'],
      min: [0, 'Credits transacted cannot be negative']
    },

    balance: {
      type: Number,
      required: [true, 'Please specify the leftover balance after transaction'],
      min: [0, 'Balance cannot be negative']
    },

    // ==========================================
    // TRANSACTION CLASSIFICATION
    // ==========================================
    transactionType: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },

    transactionReason: {
      type: String,
      enum: [
        'recharge',
        'jewellery_upload',
        'jewellery_feature',
        'try_on_activation',
        'reel_post',
        'feedback_unlock_fee',
        'slot_booking',
        'booking_reveal_fee',
        'other'
      ],
      default: 'other'
    },

    // ==========================================
    // BILLING & METADATA
    // ==========================================
    invoiceId: {
      type: String,
      trim: true,
      default: ''
    },

    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled', 'reversed'],
      default: 'success'
    },

    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    remark: {
      type: String,
      trim: true,
      default: ''
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    // ==========================================
    // POLYMORPHIC REFERENCE
    // ==========================================
    referenceModel: {
      type: String,
      enum: [
        'Jewellery',
        'FeaturedJewelleryHistory',
        'RechargeHistory',
        'Feedback',
        'Reel',
        'ServiceRequest',
        'Slot',
        'PurchaseHistory',
        'Booking',
        'other'
      ],
      default: 'other'
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceModel',
      default: null
    },

    // ==========================================
    // SOFT DELETE
    // ==========================================
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// ==========================================
// AUTO GENERATE TRANSACTION ID
// ==========================================
creditTransactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    const timestamp = Date.now().toString(36).toUpperCase();

    const randomSuffix = Math.floor(
      1000 + Math.random() * 9000
    )
      .toString(36)
      .toUpperCase();

    this.transactionId = `TXN-${timestamp}-${randomSuffix}`;
  }

  next();
});

module.exports = mongoose.model(
  'CreditTransaction',
  creditTransactionSchema
);