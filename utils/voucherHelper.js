const VoucherConfig = require('../models/VoucherConfig');
const VoucherTransaction = require('../models/VoucherTransaction');
const User = require('../models/User');

/**
 * Reusable utility to award voucher points for user actions.
 * Fetches the active configuration, increments the user's reward points, and logs a VoucherTransaction.
 * 
 * @param {string} userId - ID of the User receiving points
 * @param {string} actionName - 'rating' | 'review' | 'feedback'
 * @param {string} referenceModel - 'Review' | 'Feedback' | 'other'
 * @param {string} referenceId - Associated document ID
 * @param {string} remark - Custom detail message for the ledger
 * @returns {Promise<object|null>} Allocated details or null if action is not configured/disabled
 */
const awardVoucherPoints = async (userId, actionName, referenceModel, referenceId, remark = '') => {
  try {
    // 1. Fetch the active configuration for the action
    const config = await VoucherConfig.findOne({ actionName, isActive: true });
    if (!config) {
      console.warn(`[Voucher Helper] No active config found for action: "${actionName}". Points skipped.`);
      return null;
    }

    const points = config.pointsAwarded;
    if (points <= 0) {
      console.log(`[Voucher Helper] Configured points for "${actionName}" is 0. Points skipped.`);
      return null;
    }

    // 2. Retrieve user and increment rewardPoints
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User account not found: ${userId}`);
    }

    const currentPoints = user.rewardPoints || 0;
    const newPoints = currentPoints + points;
    user.rewardPoints = newPoints;
    await user.save();

    // 3. Log a success VoucherTransaction
    const transaction = await VoucherTransaction.create({
      user: userId,
      points,
      balance: newPoints,
      transactionType: 'credit',
      transactionReason: actionName,
      status: 'success',
      referenceModel,
      referenceId,
      remark: remark || `Points earned for action '${actionName}'`,
    });

    console.log(`[Voucher Helper] Awarded ${points} points to user ${user.name}. New balance: ${newPoints}. Transaction: ${transaction.transactionId}`);
    
    return {
      points,
      newBalance: newPoints,
      transaction,
    };
  } catch (error) {
    console.error('[Voucher Helper] Error awarding voucher points:', error);
    throw error;
  }
};

module.exports = {
  awardVoucherPoints,
};
