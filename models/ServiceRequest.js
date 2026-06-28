const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate an outlet with this service request'],
      index: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Please specify the service being requested'],
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'in_progress', 'resolved', 'cancelled'],
        message: '{VALUE} is not a valid request status'
      },
      default: 'pending',
      index: true
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
