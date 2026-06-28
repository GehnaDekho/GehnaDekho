const mongoose = require('mongoose');
const crypto = require('crypto');

const voucherTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate a target user account'],
      index: true,
    },
    points: {
      type: Number,
      required: [true, 'Please specify the points amount for this transaction'],
      min: [0, 'Points cannot be negative'],
    },
    balance: {
      type: Number,
      required: [true, 'Please specify the resulting user points balance snapshot'],
      min: [0, 'User points balance snapshot cannot be negative'],
    },
    transactionType: {
      type: String,
      required: [true, 'Please specify transaction classification type'],
      enum: ['credit', 'debit'],
    },
    transactionReason: {
      type: String,
      required: [true, 'Please specify the transaction reason'],
      enum: ['rating', 'review', 'feedback', 'redemption', 'refund', 'admin_adjustment'],
    },
    status: {
      type: String,
      required: [true, 'Please specify the transaction status'],
      enum: ['success', 'hold', 'failed', 'cancelled'],
      default: 'success',
    },
    referenceModel: {
      type: String,
      enum: ['Review', 'Feedback', 'RedeemRequest', 'other'],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceModel',
    },
    remark: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to auto-generate a unique readable transaction ID
voucherTransactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.transactionId = `VTXN-${dateStr}-${randomSuffix}`;
  }
  next();
});

module.exports = mongoose.model('VoucherTransaction', voucherTransactionSchema);
