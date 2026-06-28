const CreditTransaction = require('../models/CreditTransaction');
const Outlet = require('../models/Outlet');
const PurchaseHistory = require('../models/PurchaseHistory');

/**
 * @desc    Get all credit transactions (Paginated, filterable, and searched)
 * @route   GET /gehnaDekho/credit-transactions
 * @access  Private (Admin or Outlet Owner)
 */
const getTransactions = async (req, res) => {
  try {
    const query = { isDeleted: false };
    
    // Authorization: Outlet Owners can only view their own transactions
    if (req.user.role !== 'admin') {
      const outlet = await Outlet.findOne({ owner: req.user._id });
      if (!outlet) {
        return res.status(403).json({ message: 'You do not own an active outlet' });
      }
      query.outletId = outlet._id;
    } else {
      // Admins can filter by specific outlet if provided
      if (req.query.outletId) {
        query.outletId = req.query.outletId;
      }
    }

    // Filters
    if (req.query.transactionType) {
      query.transactionType = req.query.transactionType;
    }
    if (req.query.transactionReason) {
      query.transactionReason = req.query.transactionReason;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Search query matching transactionId, invoiceId, remark, or description
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { transactionId: searchRegex },
        { invoiceId: searchRegex },
        { remark: searchRegex },
        { description: searchRegex }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Execute query with populated references
    const transactions = await CreditTransaction.find(query)
      .populate('outletId', 'name email phone creditWallet status')
      .populate('referenceId') // Dynamic refPath populate
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CreditTransaction.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transactions.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single credit transaction by ID
 * @route   GET /gehnaDekho/credit-transactions/:id
 * @access  Private (Admin or Outlet Owner)
 */
const getTransactionById = async (req, res) => {
  try {
    const transaction = await CreditTransaction.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('outletId', 'name email phone creditWallet status')
      .populate('referenceId');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Access control: Outlet Owners can only view their own transactions
    if (req.user.role !== 'admin') {
      const outlet = await Outlet.findOne({ owner: req.user._id });
      if (!outlet || transaction.outletId._id.toString() !== outlet._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this transaction' });
      }
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create manual credit adjustment transaction (Admin Only)
 *          Automatically updates the Outlet's creditWallet balance.
 * @route   POST /gehnaDekho/credit-transactions
 * @access  Private (Admin Only)
 */
const createManualTransaction = async (req, res) => {
  try {
    const {
      outletId,
      credits,
      transactionType,
      transactionReason,
      invoiceId,
      status,
      remark,
      description,
      referenceModel,
      referenceId,
      amount,
      paymentOption
    } = req.body;

    if (!outletId || credits === undefined || !transactionType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide outletId, credits amount, and transactionType'
      });
    }

    // If it is a credit recharge transaction, validate the manual amount and paymentOption
    if (transactionType === 'credit' && transactionReason === 'recharge') {
      if (amount === undefined || amount === null || amount === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide the payment amount received from the outlet owner'
        });
      }
      if (!paymentOption || !['cash', 'card', 'UPI'].includes(paymentOption)) {
        return res.status(400).json({
          success: false,
          message: 'Please specify a valid payment option (cash, card, or UPI)'
        });
      }
    }

    // Verify outlet exists
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // Calculate new credit wallet balance
    const currentBalance = (outlet.creditWallet && outlet.creditWallet.balance) || 0;
    let newBalance = currentBalance;

    if (transactionType === 'credit') {
      newBalance += Number(credits);
    } else if (transactionType === 'debit') {
      if (currentBalance < Number(credits)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient credits. Outlet balance is ${currentBalance}, cannot deduct ${credits} credits`
        });
      }
      newBalance -= Number(credits);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid transactionType. Must be credit or debit'
      });
    }

    // Atomically update outlet wallet
    outlet.creditWallet.balance = newBalance;
    outlet.creditWallet.lastUpdated = Date.now();
    await outlet.save();

    let finalReferenceModel = referenceModel || 'other';
    let finalReferenceId = referenceId || null;

    // Create the PurchaseHistory record if successful credit recharge
    if (transactionType === 'credit' && transactionReason === 'recharge' && (status || 'success') === 'success') {
      const purchase = await PurchaseHistory.create({
        outletId,
        amount: Number(amount),
        credits: Number(credits),
        paymentOption
      });
      finalReferenceModel = 'PurchaseHistory';
      finalReferenceId = purchase._id;
    }

    // Create the Transaction record
    const transaction = await CreditTransaction.create({
      outletId,
      credits,
      balance: newBalance,
      transactionType,
      transactionReason: transactionReason || 'other',
      invoiceId: invoiceId || '',
      status: status || 'success',
      remark: remark || '',
      description: description || '',
      referenceModel: finalReferenceModel,
      referenceId: finalReferenceId
    });

    const populatedTx = await CreditTransaction.findById(transaction._id)
      .populate('outletId', 'name email phone creditWallet status')
      .populate('referenceId');

    res.status(201).json({
      success: true,
      message: 'Credit adjustment successfully executed and logged',
      data: populatedTx
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update pending transaction status (Admin Only)
 *          Automatically handles wallet balance syncing for status shifts.
 * @route   PUT /gehnaDekho/credit-transactions/:id/status
 * @access  Private (Admin Only)
 */
const updateTransactionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: 'Please provide status to update' });
    }

    const transaction = await CreditTransaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === status) {
      return res.status(200).json({ success: true, message: `Status is already ${status}`, data: transaction });
    }

    const outlet = await Outlet.findById(transaction.outletId);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet associated with this transaction not found' });
    }

    const currentBalance = (outlet.creditWallet && outlet.creditWallet.balance) || 0;
    let newBalance = currentBalance;

    // Action 1: Transitioning from PENDING to SUCCESS
    if (transaction.status === 'pending' && status === 'success') {
      if (transaction.transactionType === 'credit') {
        newBalance += transaction.credits;
      } else if (transaction.transactionType === 'debit') {
        if (currentBalance < transaction.credits) {
          return res.status(400).json({
            success: false,
            message: `Insufficient credits to finalize debit transaction. Outlet balance is ${currentBalance}, transaction costs ${transaction.credits}`
          });
        }
        newBalance -= transaction.credits;
      }
    }
    
    // Action 2: Reversing a previously successful transaction (REVERSED or CANCELLED)
    else if (transaction.status === 'success' && (status === 'reversed' || status === 'cancelled')) {
      if (transaction.transactionType === 'credit') {
        // Reverse top-up (deduct credits)
        if (currentBalance < transaction.credits) {
          return res.status(400).json({
            success: false,
            message: `Cannot reverse credit. Outlet only has ${currentBalance} credits left, reversal needs to deduct ${transaction.credits}`
          });
        }
        newBalance -= transaction.credits;
      } else if (transaction.transactionType === 'debit') {
        // Refund spent credits
        newBalance += transaction.credits;
      }
    }

    // Save updated wallet
    outlet.creditWallet.balance = newBalance;
    outlet.creditWallet.lastUpdated = Date.now();
    await outlet.save();

    // Update transaction audit snapshot
    transaction.status = status;
    transaction.balance = newBalance;
    await transaction.save();

    res.status(200).json({
      success: true,
      message: `Transaction status updated to ${status} and wallet synced successfully`,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get Outlet Wallet stats & aggregated summary
 * @route   GET /gehnaDekho/credit-transactions/outlet/:outletId/stats
 * @access  Private (Admin or Outlet Owner)
 */
const getOutletStats = async (req, res) => {
  try {
    const { outletId } = req.params;

    // Access control check
    if (req.user.role !== 'admin') {
      const outlet = await Outlet.findOne({ owner: req.user._id });
      if (!outlet || outlet._id.toString() !== outletId) {
        return res.status(403).json({ success: false, message: 'Not authorized to view stats for this outlet' });
      }
    }

    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // Calculate aggregated metrics using MongoDB aggregation pipeline
    const mongoose = require('mongoose');
    const stats = await CreditTransaction.aggregate([
      { $match: { outletId: new mongoose.Types.ObjectId(outletId), status: 'success', isDeleted: false } },
      {
        $group: {
          _id: '$transactionType',
          totalCredits: { $sum: '$credits' },
          count: { $sum: 1 }
        }
      }
    ]);

    const reasons = await CreditTransaction.aggregate([
      { $match: { outletId: new mongoose.Types.ObjectId(outletId), status: 'success', isDeleted: false } },
      {
        $group: {
          _id: '$transactionReason',
          totalSpent: { $sum: '$credits' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      outletId,
      currentBalance: (outlet.creditWallet && outlet.creditWallet.balance) || 0,
      summary: stats,
      reasonsBreakdown: reasons
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createManualTransaction,
  updateTransactionStatus,
  getOutletStats
};
