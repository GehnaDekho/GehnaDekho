const Review = require('../models/Review');
const Outlet = require('../models/Outlet');
const RatingCriteria = require('../models/RatingCriteria');
const { awardVoucherPoints } = require('../utils/voucherHelper');

/**
 * @desc    Submit reviews and ratings for an outlet (Customer Only)
 *          Automatically resolves config rules and awards voucher points.
 * @route   POST /gehnaDekho/reviews
 * @access  Private (Customer Only)
 */
const createReview = async (req, res) => {
  try {
    const { outletId, reviewText, ratings } = req.body;

    if (!outletId || !ratings || !Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide outletId and ratings array with at least one criteria score',
      });
    }

    // Verify outlet exists
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // Find and delete any existing reviews by this user for this outlet
    const existingReview = await Review.findOne({ user: req.user._id, outlet: outletId });
    if (existingReview) {
      // Use findOneAndDelete to trigger any necessary hooks (like recalculating average if needed)
      await Review.findOneAndDelete({ _id: existingReview._id });
    }

    // Create review (pre-save hook in Review model handles average ratings calculations and owner check)
    const review = await Review.create({
      user: req.user._id,
      outlet: outletId,
      reviewText: reviewText ? reviewText.trim() : '',
      ratings,
    });

    // Check if user submitted review text or just ratings to choose the award action configuration
    const hasText = reviewText && reviewText.trim().length > 0;
    const actionName = hasText ? 'review' : 'rating';

    // Award voucher points using the reusable helper
    const awardResult = await awardVoucherPoints(
      req.user._id,
      actionName,
      'Review',
      review._id,
      `Awarded points for submitting a shop ${actionName}`
    );

    res.status(201).json({
      success: true,
      message: `Review submitted successfully. Mapped action: '${actionName}'.`,
      pointsAwarded: awardResult ? awardResult.points : 0,
      newPointsBalance: awardResult ? awardResult.newBalance : req.user.rewardPoints,
      data: review,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get reviews for a specific outlet
 * @route   GET /gehnaDekho/reviews/outlet/:outletId
 * @access  Public
 */
const getOutletReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments({ outlet: req.params.outletId, isActive: true });

    const reviews = await Review.find({ outlet: req.params.outletId, isActive: true })
      .populate('user', 'name profilePhoto')
      .populate('ratings.criteria', 'name category weightage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createReview,
  getOutletReviews,
};
