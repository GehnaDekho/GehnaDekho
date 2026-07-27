const RedeemRequest = require('../models/RedeemRequest');
const VoucherTransaction = require('../models/VoucherTransaction');
const User = require('../models/User');
const notificationService = require('../services/notification.service');

/**
 * @desc    Submit a request to redeem voucher points (Customer Only)
 *          Deducts points immediately and logs a transaction in HOLD status.
 * @route   POST /gehnaDekho/redeem-requests
 * @access  Private (Customer Only)
 */
const createRedeemRequest = async (req, res) => {
  try {
    const { points } = req.body;

    if (points === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the number of points to redeem',
      });
    }

    const pointsNum = parseInt(points, 10);

    // Business rule: Can only redeem in multiples of 500
    if (isNaN(pointsNum) || pointsNum <= 0 || pointsNum % 500 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Redemption points must be a positive multiple of 500 (e.g. 500, 1000, 1500).',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    // Check sufficiency of user reward points
    if ((user.rewardPoints || 0) < pointsNum) {
      return res.status(400).json({
        success: false,
        message: `Insufficient points. You requested to redeem ${pointsNum} points, but you only have ${user.rewardPoints || 0} points in your vault.`,
      });
    }

    // 1. Deduct points immediately
    user.rewardPoints = (user.rewardPoints || 0) - pointsNum;
    await user.save();

    // 2. Create the pending RedeemRequest
    const redeemRequest = await RedeemRequest.create({
      user: req.user._id,
      points: pointsNum,
      status: 'pending',
    });

    // 3. Create a VoucherTransaction record in HOLD status
    const transaction = await VoucherTransaction.create({
      user: req.user._id,
      points: pointsNum,
      balance: user.rewardPoints,
      transactionType: 'debit',
      transactionReason: 'redemption',
      status: 'hold',
      referenceModel: 'RedeemRequest',
      referenceId: redeemRequest._id,
      remark: 'Voucher points redemption request submitted',
    });

    res.status(201).json({
      success: true,
      message: 'Redemption request submitted successfully and is currently under review.',
      data: redeemRequest,
      transaction: {
        transactionId: transaction.transactionId,
        points: transaction.points,
        status: transaction.status,
        newPointsBalance: user.rewardPoints,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get redemption requests list
 *          Customers see their own; Admins see all.
 * @route   GET /gehnaDekho/redeem-requests
 * @access  Private
 */
const getRedeemRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let query = {};

    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    } else if (req.query.userId) {
      query.user = req.query.userId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const total = await RedeemRequest.countDocuments(query);
    const requests = await RedeemRequest.find(query)
      .populate('user', 'name email phone')
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
      data: requests,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Approve or Reject a voucher redemption request (Admin Only)
 *          Adjusts user points and updates transaction statuses.
 * @route   PUT /gehnaDekho/redeem-requests/:id/review
 * @access  Private (Admin Only)
 */
const reviewRedeemRequest = async (req, res) => {
  try {
    const { status, adminMessage } = req.body;
    const requestId = req.params.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid review status: 'approved' or 'rejected'",
      });
    }

    // Require rejection message
    if (status === 'rejected' && (!adminMessage || !adminMessage.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an administrative reason (adminMessage) for rejecting this request',
      });
    }

    // Fetch the request and populate user to get access to points manipulation
    const redeemRequest = await RedeemRequest.findById(requestId).populate('user');
    if (!redeemRequest) {
      return res.status(404).json({ success: false, message: 'Redemption request not found' });
    }

    // Only allow reviews on pending requests
    if (redeemRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been processed and is marked as '${redeemRequest.status}'`,
      });
    }

    // Find the corresponding hold transaction
    const holdTransaction = await VoucherTransaction.findOne({
      referenceId: requestId,
      referenceModel: 'RedeemRequest',
      status: 'hold',
    });

    if (status === 'approved') {
      // 1. Mark request as approved
      redeemRequest.status = 'approved';
      redeemRequest.adminMessage = adminMessage || 'Redemption request approved';
      redeemRequest.processedAt = Date.now();
      await redeemRequest.save();

      // 2. Transition hold transaction to success
      if (holdTransaction) {
        holdTransaction.status = 'success';
        holdTransaction.remark = 'Redemption request approved by Administrator';
        await holdTransaction.save();
      }

      // 3. Mock Email Logger (As requested: Don't integrate mail part, just keep API / log)
      console.log(
        `[Email Mock] Secure email dispatched to customer: ${redeemRequest.user.email}. Subject: Voucher Redemption Approved. Details: Your request for ${redeemRequest.points} points has been approved.`
      );

      // 4. Send Push Notification to User
      await notificationService.createAndSend({
        title: 'Redeem Request Approved! ✅',
        message: `Your request to redeem ${redeemRequest.points} points has been approved.`,
        receiver: redeemRequest.user._id,
        receiverType: 'user',
        targetMode: 'user',
        notificationType: 'SYSTEM',
        eventId: redeemRequest._id,
      }).catch(err => console.error('Notification Error:', err));

      res.status(200).json({
        success: true,
        message: 'Redemption request approved successfully.',
        data: redeemRequest,
      });
    } else {
      // status === 'rejected'
      // 1. Mark request as rejected
      redeemRequest.status = 'rejected';
      redeemRequest.adminMessage = adminMessage.trim();
      redeemRequest.processedAt = Date.now();
      await redeemRequest.save();

      // 2. Transition hold transaction to cancelled
      if (holdTransaction) {
        holdTransaction.status = 'cancelled';
        holdTransaction.remark = `Redemption request rejected: ${adminMessage.trim()}`;
        await holdTransaction.save();
      }

      // 3. Refund points back to the user
      const user = redeemRequest.user;
      const currentPoints = user.rewardPoints || 0;
      const refundedPoints = currentPoints + redeemRequest.points;
      user.rewardPoints = refundedPoints;
      await user.save();

      // 4. Log a refund credit transaction in ledger
      const refundTransaction = await VoucherTransaction.create({
        user: user._id,
        points: redeemRequest.points,
        balance: refundedPoints,
        transactionType: 'credit',
        transactionReason: 'refund',
        status: 'success',
        referenceModel: 'RedeemRequest',
        referenceId: redeemRequest._id,
        remark: `Refund for rejected redemption request: ${adminMessage.trim()}`,
      });

      // 5. Send Push Notification to User
      await notificationService.createAndSend({
        title: 'Redeem Request Rejected ❌',
        message: `Your request to redeem ${redeemRequest.points} points was rejected. Points refunded. Reason: ${adminMessage.trim()}`,
        receiver: redeemRequest.user._id,
        receiverType: 'user',
        targetMode: 'user',
        notificationType: 'SYSTEM',
        eventId: redeemRequest._id,
      }).catch(err => console.error('Notification Error:', err));

      res.status(200).json({
        success: true,
        message: 'Redemption request rejected and points refunded successfully.',
        data: redeemRequest,
        refund: {
          transactionId: refundTransaction.transactionId,
          refundedPoints: redeemRequest.points,
          newPointsBalance: refundedPoints,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createRedeemRequest,
  getRedeemRequests,
  reviewRedeemRequest,
};
