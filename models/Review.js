const mongoose = require('mongoose');

const subRatingSchema = new mongoose.Schema({
  criteria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RatingCriteria',
    required: [true, 'Please associate a rating criteria']
  },
  score: {
    type: Number,
    required: [true, 'Please provide a rating score between 1 and 5'],
    min: [1, 'Rating score must be at least 1'],
    max: [5, 'Rating score cannot be more than 5']
  }
}, { _id: false });

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate a reviewer user'],
      index: true
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: [true, 'Please associate a target outlet shop'],
      index: true
    },
    reviewText: {
      type: String,
      default: '',
      trim: true
    },
    ratings: {
      type: [subRatingSchema],
      required: true,
      validate: {
        validator: function(val) {
          return val && val.length > 0;
        },
        message: 'A review must contain at least one rating rating score'
      }
    },
    averageScore: {
      type: Number,
      required: true,
      default: 0
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

// Enforce compound index to ensure a customer user can leave exactly ONE review per outlet
reviewSchema.index({ user: 1, outlet: 1 }, { unique: true });

// Pre-save validation and weighted average rating calculation
reviewSchema.pre('save', async function (next) {
  try {
    const User = mongoose.model('User');
    const RatingCriteria = mongoose.model('RatingCriteria');

    // 1. Business Safeguard: Verify reviewer is not an outlet owner
    const reviewer = await User.findById(this.user);
    if (!reviewer) {
      return next(new Error('Reviewer user account not found'));
    }

    if (reviewer.role === 'outlet_owner' || reviewer.outletId) {
      return next(new Error('Outlet owners are not permitted to rate or review shops to maintain platform fairness'));
    }

    // 2. Mathematically calculate the weighted average score
    const criteriaIds = this.ratings.map(r => r.criteria);
    const criteriaList = await RatingCriteria.find({ _id: { $in: criteriaIds } });
    
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const rating of this.ratings) {
      const criteriaObj = criteriaList.find(c => c._id.toString() === rating.criteria.toString());
      const weight = criteriaObj ? criteriaObj.weightage : 1; // Default fallback weightage: 1
      
      totalWeightedScore += (rating.score * weight);
      totalWeight += weight;
    }

    this.averageScore = totalWeight > 0 ? Number((totalWeightedScore / totalWeight).toFixed(2)) : 0;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Review', reviewSchema);
