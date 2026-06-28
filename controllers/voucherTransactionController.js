const VoucherTransaction = require('../models/VoucherTransaction');

/**
 * @desc    Get voucher point transactions ledger list
 *          Customers see their own; Admins can see all or filter by user.
 * @route   GET /gehnaDekho/voucher-transactions
 * @access  Private
 */
const getVoucherTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let query = {};

    // Enforce permission checks: Customers can only query their own transactions
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    } else if (req.query.userId) {
      // Admin can filter transactions by user ID
      query.user = req.query.userId;
    }

    if (req.query.transactionType) {
      query.transactionType = req.query.transactionType; // 'credit' or 'debit'
    }

    if (req.query.transactionReason) {
      query.transactionReason = req.query.transactionReason;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const total = await VoucherTransaction.countDocuments(query);
    
    const transactions = await VoucherTransaction.find(query)
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
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get a single voucher point transaction detail by ID
 * @route   GET /gehnaDekho/voucher-transactions/:id
 * @access  Private
 */
const getVoucherTransactionById = async (req, res) => {
  try {
    const transaction = await VoucherTransaction.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('referenceId');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Voucher transaction not found' });
    }

    // Permission check
    if (req.user.role !== 'admin' && transaction.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this transaction record',
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getVoucherTransactions,
  getVoucherTransactionById,
};
