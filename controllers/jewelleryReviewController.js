const mongoose = require('mongoose');
const JewelleryReview = require('../models/JewelleryReview');
const Jewellery = require('../models/Jewellery');

/**
 * @desc    Submit a new rating and review for jewellery
 * @route   POST /gehnaDekho/jewellery/:id/reviews
 * @access  Private (Customer)
 */
exports.addReview = async (req, res) => {
  try {
    const { rating, reviewText } = req.body;
    const jewelleryId = req.params.id;

    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Please provide a valid rating between 1 and 5');
    }

    if (req.user.role === 'outlet_owner') {
      throw new Error('Outlet owners are not permitted to submit reviews');
    }

    // Check if user already reviewed
    const existingReview = await JewelleryReview.findOne({
      user: req.user._id,
      jewellery: jewelleryId
    });

    if (existingReview) {
      const err = new Error('You have already submitted a review for this jewellery');
      err.status = 400;
      throw err;
    }

    // Get jewellery to calculate new average
    const jewellery = await Jewellery.findById(jewelleryId);
    if (!jewellery) {
      const err = new Error('Jewellery not found');
      err.status = 404;
      throw err;
    }

    const currentTotal = jewellery.totalRatings || 0;
    const currentAvg = jewellery.rating || 0;
    
    // Formula: (oldAvg * oldTotal + newRating) / (oldTotal + 1)
    const newTotal = currentTotal + 1;
    const newAvg = ((currentAvg * currentTotal) + Number(rating)) / newTotal;

    // Update jewellery
    jewellery.totalRatings = newTotal;
    jewellery.rating = Number(newAvg.toFixed(1));
    await jewellery.save();

    // Create review
    const review = await JewelleryReview.create({
      user: req.user._id,
      jewellery: jewelleryId,
      rating: Number(rating),
      reviewText: reviewText || ''
    });

    // Populate user details before returning
    const populatedReview = await JewelleryReview.findById(review._id)
      .populate('user', 'name profilePhoto');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: populatedReview
    });
  } catch (error) {
    const status = error.status || 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get paginated reviews for a specific jewellery
 * @route   GET /gehnaDekho/jewellery/:id/reviews
 * @access  Public
 */
exports.getReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const skip = (page - 1) * limit;
    const jewelleryId = req.params.id;

    const query = { jewellery: jewelleryId, isActive: true };

    const reviews = await JewelleryReview.find(query)
      .populate('user', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await JewelleryReview.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reviews.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: reviews
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
