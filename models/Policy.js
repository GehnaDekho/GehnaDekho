const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['privacy', 'terms'],
    required: true,
    unique: true
  },
  effectiveDate: {
    type: String,
    default: () => {
      const date = new Date();
      return `${date.getDate()} ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    }
  },
  introduction: {
    type: String,
    default: ''
  },
  sections: [
    {
      title: { type: String, default: '' },
      paragraph: { type: String, default: '' },
      list: [{ type: String }]
    }
  ],
  contactInfo: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Policy', policySchema);
