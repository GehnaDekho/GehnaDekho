const mongoose = require('mongoose');

const purchaseHistorySchema = new mongoose.Schema(
  {
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate an outlet with this purchase record'],
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Please specify the amount received from the owner'],
      min: [0, 'Purchase amount cannot be negative']
    },
    credits: {
      type: Number,
      required: [true, 'Please specify the number of credits recharged'],
      min: [1, 'Credits recharged must be at least 1']
    },
    paymentOption: {
      type: String,
      required: [true, 'Please specify the payment option used (cash, card, UPI)'],
      enum: {
        values: ['cash', 'card', 'UPI'],
        message: 'Payment option must be cash, card, or UPI'
      }
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

module.exports = mongoose.model('PurchaseHistory', purchaseHistorySchema);
