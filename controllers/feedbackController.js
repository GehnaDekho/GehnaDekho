const Feedback = require('../models/Feedback');
const Outlet = require('../models/Outlet');
const CreditConfig = require('../models/CreditConfig');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { awardVoucherPoints } = require('../utils/voucherHelper');

/**
 * @desc    Submit private feedback for an outlet (Customer Only)
 * @route   POST /gehnaDekho/feedback
 * @access  Private (Customer Only)
 */
const createFeedback = async (req, res) => {
  try {
    const { outletId, feedbackText } = req.body;

    if (!outletId || !feedbackText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide outletId and feedbackText'
      });
    }

    // Verify target outlet exists
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // Create feedback (Feedback Schema pre-save hook will block if requester is an outlet owner)
    const feedback = await Feedback.create({
      user: req.user._id,
      outlet: outletId,
      feedbackText: feedbackText.trim()
    });

    // Award voucher points using the reusable helper
    const awardResult = await awardVoucherPoints(
      req.user._id,
      'feedback',
      'Feedback',
      feedback._id,
      'Awarded points for submitting private feedback'
    );

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      pointsAwarded: awardResult ? awardResult.points : 0,
      newPointsBalance: awardResult ? awardResult.newBalance : req.user.rewardPoints,
      data: feedback
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all feedbacks for the owner's outlet (Outlet Owner Only)
 *          Masks the feedback text unless the feedback has been unlocked.
 * @route   GET /gehnaDekho/feedback/outlet
 * @access  Private (Outlet Owner Only)
 */
const getOutletFeedbacks = async (req, res) => {
  try {
    // 1. Resolve active outlet belonging to this owner
    const outlet = await Outlet.findOne({ owner: req.user._id });
    if (!outlet) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own an active outlet'
      });
    }

    // 2. Fetch all feedbacks targeting this outlet (populated with customer details)
    const feedbacks = await Feedback.find({ outlet: outlet._id, isDeleted: false })
      .populate('user', 'name phone profilePhoto')
      .sort({ createdAt: -1 });

    // 3. Mask the feedback text if not unlocked
    const processedFeedbacks = feedbacks.map(item => {
      const doc = item.toObject();
      if (!doc.isUnlocked) {
        doc.feedbackText = '[LOCKED - Requires credit deduction to unlock and view content]';
      }
      return doc;
    });

    res.status(200).json({
      success: true,
      count: processedFeedbacks.length,
      data: processedFeedbacks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Unlock and view a specific private feedback (Outlet Owner Only)
 *          Deducts credits, updates wallet balance, and registers a transaction ledger.
 * @route   POST /gehnaDekho/feedback/:id/unlock
 * @access  Private (Outlet Owner Only)
 */
const unlockFeedback = async (req, res) => {
  try {
    const feedbackId = req.params.id;

    // 1. Fetch the feedback
    const feedback = await Feedback.findOne({ _id: feedbackId, isDeleted: false })
      .populate('user', 'name phone');
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    // 2. Verify requester owns the target outlet of this feedback
    const outlet = await Outlet.findOne({ owner: req.user._id });
    if (!outlet || feedback.outlet.toString() !== outlet._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to unlock feedback for this outlet'
      });
    }

    // 3. If already unlocked, return the full feedback details immediately
    if (feedback.isUnlocked) {
      // Mark as read if not already
      if (feedback.status === 'unread') {
        feedback.status = 'read';
        await feedback.save();
      }
      return res.status(200).json({
        success: true,
        message: 'Feedback is already unlocked',
        data: feedback
      });
    }

    // 4. Fetch the credit configuration cost for feedback viewing
    const config = await CreditConfig.findOne({
      actionName: 'feedback_unlock_fee',
      isActive: true
    });
    if (!config) {
      return res.status(400).json({
        success: false,
        message: "System Error: The credit cost for action 'feedback_unlock_fee' is not configured by the administrator."
      });
    }

    // 5. Verify sufficient credit balance
    const currentBalance = (outlet.creditWallet && outlet.creditWallet.balance) || 0;
    const requiredCost = config.creditsRequired;

    if (currentBalance < requiredCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credit balance. Unlocking this feedback requires ${requiredCost} credits, but your outlet only has ${currentBalance} credits left.`
      });
    }

    // 6. Deduct credits and update the outlet's wallet atomically
    const newBalance = currentBalance - requiredCost;
    outlet.creditWallet.balance = newBalance;
    outlet.creditWallet.lastUpdated = Date.now();
    await outlet.save();

    // 7. Update the Feedback state to unlocked and read
    feedback.isUnlocked = true;
    feedback.status = 'read';
    await feedback.save();

    // 8. Record the Transaction history inside CreditTransaction ledger
    const transaction = await CreditTransaction.create({
      outletId: outlet._id,
      credits: requiredCost,
      balance: newBalance,
      transactionType: 'debit',
      transactionReason: 'feedback_unlock_fee',
      status: 'success',
      remark: 'Unlocked private customer feedback',
      description: `Viewed private feedback from customer: ${feedback.user ? feedback.user.name : 'Unknown Customer'}`,
      referenceModel: 'Feedback',
      referenceId: feedback._id
    });

    res.status(200).json({
      success: true,
      message: 'Feedback unlocked successfully',
      creditsDeducted: requiredCost,
      newWalletBalance: newBalance,
      data: feedback,
      transaction: {
        transactionId: transaction.transactionId,
        credits: transaction.credits,
        balance: transaction.balance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createFeedback,
  getOutletFeedbacks,
  unlockFeedback
};
