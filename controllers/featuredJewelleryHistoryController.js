const FeaturedJewelleryHistory = require('../models/FeaturedJewelleryHistory');
const Slot = require('../models/Slot');
const Jewellery = require('../models/Jewellery');
const Outlet = require('../models/Outlet');
const CreditTransaction = require('../models/CreditTransaction');

// =======================================================
// CREATE FEATURED JEWELLERY HISTORY LOG
// =======================================================
const createFeaturedHistory = async (req, res) => {
  try {
    const { slot, jewellery, outlet, date } = req.body;

    if (!slot || !jewellery || !outlet) {
      return res.status(400).json({
        success: false,
        message: 'Please provide slot, jewellery, and outlet references'
      });
    }

    // 1. Verify Slot exists
    const slotExists = await Slot.findById(slot);
    if (!slotExists) {
      return res.status(404).json({ success: false, message: 'Slot configuration not found' });
    }

    // 2. Verify Jewellery exists
    const jewelleryExists = await Jewellery.findById(jewellery);
    if (!jewelleryExists) {
      return res.status(404).json({ success: false, message: 'Jewellery item not found' });
    }

    // 3. Verify Outlet exists
    const outletExists = await Outlet.findById(outlet);
    if (!outletExists) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // 4. Access Control Check: Outlet Owner can only log for their own outlet
    if (req.user.role !== 'admin') {
      const ownedOutlet = await Outlet.findOne({ owner: req.user._id });
      if (!ownedOutlet || ownedOutlet._id.toString() !== outlet.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to log featured history for this outlet'
        });
      }
    }

    // ==========================================
    // CREDIT ENFORCEMENT & DEBIT TRANSACTION
    // ==========================================
    const requiredCost = slotExists.price;
    const currentBalance = (outletExists.creditWallet && outletExists.creditWallet.balance) || 0;

    if (currentBalance < requiredCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credit balance to feature this item. Slot #${slotExists.slotNumber} requires ${requiredCost} credits, but your outlet only has ${currentBalance} credits left.`
      });
    }

    // Atomically debit credits from the outlet wallet
    const newBalance = currentBalance - requiredCost;
    outletExists.creditWallet.balance = newBalance;
    outletExists.creditWallet.lastUpdated = Date.now();
    await outletExists.save();

    // Create Featured Jewellery Showcase log
    const history = await FeaturedJewelleryHistory.create({
      slot,
      jewellery,
      outlet,
      date: date || Date.now()
    });

    // Record dynamic Transaction inside CreditTransaction ledger
    await CreditTransaction.create({
      outletId: outletExists._id,
      credits: requiredCost,
      balance: newBalance,
      transactionType: 'debit',
      transactionReason: 'jewellery_feature',
      status: 'success',
      remark: `Featured jewellery in slot #${slotExists.slotNumber}`,
      description: `Featured jewellery '${jewelleryExists.name}' in slot #${slotExists.slotNumber}`,
      referenceModel: 'FeaturedJewelleryHistory',
      referenceId: history._id
    });

    const populatedHistory = await FeaturedJewelleryHistory.findById(history._id)
      .populate('slot')
      .populate('jewellery', 'name price images material weight purity')
      .populate('outlet', 'name email phone creditWallet');

    res.status(201).json({
      success: true,
      message: 'Featured jewellery history record created successfully and credits deducted',
      data: populatedHistory
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =======================================================
// GET ALL FEATURED HISTORY LOGS (FILTERED & PAGINATED)
// =======================================================
const getFeaturedHistory = async (req, res) => {
  try {
    const query = {};

    // ==========================================
    // ACCESS CONTROL
    // ==========================================
    if (req.user.role !== 'admin') {
      const ownedOutlet = await Outlet.findOne({ owner: req.user._id });
      if (!ownedOutlet) {
        return res.status(403).json({
          success: false,
          message: 'You do not own any active outlet'
        });
      }
      query.outlet = ownedOutlet._id;
    } else {
      if (req.query.outlet) {
        query.outlet = req.query.outlet;
      }
    }

    // ==========================================
    // EXTRA FILTERS
    // ==========================================
    if (req.query.slot) {
      query.slot = req.query.slot;
    }
    if (req.query.jewellery) {
      query.jewellery = req.query.jewellery;
    }

    // Date range filtering
    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) {
        query.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.date.$lte = new Date(req.query.endDate);
      }
    }

    // Pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const historyLogs = await FeaturedJewelleryHistory.find(query)
      .populate('slot')
      .populate('jewellery', 'name price images material weight purity')
      .populate('outlet', 'name email phone location')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FeaturedJewelleryHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      count: historyLogs.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: historyLogs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =======================================================
// GET SINGLE HISTORY DETAILS
// =======================================================
const getFeaturedHistoryById = async (req, res) => {
  try {
    const history = await FeaturedJewelleryHistory.findById(req.params.id)
      .populate('slot')
      .populate('jewellery', 'name price images material weight purity')
      .populate('outlet', 'name email phone location creditWallet');

    if (!history) {
      return res.status(404).json({ success: false, message: 'Featured history log not found' });
    }

    // Access control: Owners can only see their own outlet logs
    if (req.user.role !== 'admin') {
      const ownedOutlet = await Outlet.findOne({ owner: req.user._id });
      if (!ownedOutlet || history.outlet._id.toString() !== ownedOutlet._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this history record'
        });
      }
    }

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =======================================================
// INCREMENT CLICK TRACKING COUNTER (PUBLIC VIEW ENGINE)
// =======================================================
const incrementClickCount = async (req, res) => {
  try {
    const history = await FeaturedJewelleryHistory.findById(req.params.id);
    
    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Featured jewellery history record not found'
      });
    }

    history.clickCount += 1;
    await history.save();

    res.status(200).json({
      success: true,
      message: 'Showcase click successfully tracked and logged',
      clickCount: history.clickCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =======================================================
// GET TODAY'S FEATURED JEWELLERIES (IST TIMEZONE COMPATIBLE)
// =======================================================
const getTodayFeatured = async (req, res) => {
  try {
    // 1. Core IST timezone-agnostic boundaries conversion (+05:30)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istTime = new Date(now.getTime() + IST_OFFSET);

    const year = istTime.getUTCFullYear();
    const month = istTime.getUTCMonth();
    const date = istTime.getUTCDate();

    // Start & End of today in Indian Standard Time (converted back to UTC for DB querying)
    const startOfISTDay = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - IST_OFFSET);
    const endOfISTDay = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - IST_OFFSET);

    // 2. Fetch history records falling in Indian Calendar date bounds
    const logs = await FeaturedJewelleryHistory.find({
      date: {
        $gte: startOfISTDay,
        $lte: endOfISTDay
      }
    })
      .populate('slot')
      .populate({
        path: 'jewellery',
        populate: { path: 'category', select: 'name image' }
      })
      .populate('outlet', 'name address phone email location');

    // 3. Filter valid populated models and sort ascending by slotNumber
    const activeShowcase = logs
      .filter(log => log.slot && log.slot.isActive && log.jewellery && log.outlet)
      .sort((a, b) => a.slot.slotNumber - b.slot.slotNumber);

    res.status(200).json({
      success: true,
      timezone: 'Asia/Kolkata (IST)',
      dateBounds: {
        start: startOfISTDay.toISOString(),
        end: endOfISTDay.toISOString()
      },
      count: activeShowcase.length,
      data: activeShowcase
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createFeaturedHistory,
  getFeaturedHistory,
  getFeaturedHistoryById,
  incrementClickCount,
  getTodayFeatured
};
