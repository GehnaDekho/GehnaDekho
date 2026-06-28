const mongoose = require('mongoose');

const ratingCriteriaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a criteria name'],
      trim: true
    },
    category: {
      type: String,
      enum: {
        values: ['Highly Impacted', 'Manageable', 'Can be Improved'],
        message: '{VALUE} is not a valid criteria category'
      },
      required: [true, 'Please specify the criteria category']
    },
    weightage: {
      type: Number,
      required: [true, 'Please specify the criteria weightage'],
      min: [1, 'Weightage must be at least 1'],
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Define partial unique index for active criteria
ratingCriteriaSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('RatingCriteria', ratingCriteriaSchema);
