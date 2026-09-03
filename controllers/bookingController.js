const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Outlet = require('../models/Outlet');
const CreditConfig = require('../models/CreditConfig');
const CreditTransaction = require('../models/CreditTransaction');
const Jewellery = require('../models/Jewellery');
const notificationService = require('../services/notification.service');

/**
 * @desc    Create a new booking (Customer)
 * @route   POST /gehnaDekho/bookings
 * @access  Private (Customer)
 */
exports.createBooking = async (req, res) => {
  try {
    const { jewelleryId, outletId, preferredDate } = req.body;

    if (!jewelleryId || !outletId || !preferredDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const requestedDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      return res.status(400).json({ success: false, message: 'Preferred date cannot be in the past' });
    }

    if (req.user.role === 'outlet_owner') {
      const targetOutlet = await Outlet.findById(outletId);
      if (targetOutlet && targetOutlet.owner.toString() === req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You cannot book jewellery from your own outlet.' });
      }
    }

    const activeBooking = await Booking.findOne({
      userId: req.user._id,
      jewelleryId,
      status: 'scheduled'
    });

    if (activeBooking) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active booking for this jewellery. Go to Bookings screen to see the details.',
        isDuplicate: true
      });
    }

    const booking = await Booking.create({
      userId: req.user._id,
      jewelleryId,
      outletId,
      preferredDate: requestedDate,
      status: 'scheduled'
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('jewelleryId', 'name images price')
      .populate('outletId', 'name address phone owner');

    // Send Notification to Outlet Owner
    if (populatedBooking.outletId && populatedBooking.outletId.owner) {
      await notificationService.createAndSend({
        title: 'New Booking Request',
        message: `A customer has requested to visit your outlet for ${populatedBooking.jewelleryId?.name || 'Jewellery'} on ${requestedDate.toDateString()}.`,
        receiver: populatedBooking.outletId.owner,
        receiverType: 'user',
        targetMode: 'outlet',
        notificationType: 'BOOKING_UPDATE',
        eventId: booking._id,
      }).catch(err => console.error('Notification Error:', err));
    }

    // Send Notification to Customer
    await notificationService.createAndSend({
      title: 'Booking Confirmed',
      message: `Your visit to ${populatedBooking.outletId?.name || 'the outlet'} for ${populatedBooking.jewelleryId?.name || 'Jewellery'} is scheduled for ${requestedDate.toDateString()}.`,
      receiver: req.user._id,
      receiverType: 'user',
      targetMode: 'user',
      notificationType: 'BOOKING_UPDATE',
      eventId: booking._id,
    }).catch(err => console.error('Notification Error:', err));

    res.status(201).json({
      success: true,
      message: 'Booking successfully created',
      data: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get user's bookings (Customer)
 * @route   GET /gehnaDekho/bookings/user/list
 * @access  Private (Customer)
 */
exports.getUserBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { status } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('jewelleryId', 'name images price')
      .populate('outletId', 'name address phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
/**
 * @desc    Get single booking by ID
 * @route   GET /gehnaDekho/bookings/:id
 * @access  Private
 */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('jewelleryId', 'name images price')
      .populate('outletId', 'name address phone')
      .populate('userId', 'name phone email');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Access control: User can see their own, outlet owner can see their outlet's, admin can see all
    if (req.user.role === 'customer' && booking.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }
    
    if (req.user.role === 'outlet_owner') {
      const outlet = await Outlet.findOne({ owner: req.user._id });
      if (!outlet || booking.outletId._id.toString() !== outlet._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
      }
      
      // Mask if not revealed
      if (!booking.revealed) {
        booking.userId.name = null;
        booking.userId.phone = null;
        booking.userId.email = null;
      }
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get paginated bookings for an outlet
 * @route   GET /gehnaDekho/bookings/outlet/list
 * @access  Private (Outlet Owner)
 */
exports.getOutletBookings = async (req, res) => {
  try {
    const outlet = await Outlet.findOne({ owner: req.user._id });
    if (!outlet) {
      return res.status(403).json({ success: false, message: 'You do not own an active outlet' });
    }

    const { page = 1, limit = 7, status, date, search, revealed } = req.query;
    
    // Default filters
    const query = { outletId: outlet._id };
    
    // Apply provided filters, else fall back to default logic
    if (status && status !== 'all') {
      query.status = status;
    } else if (!status && !date && !search && !revealed) {
      // Default view: only show scheduled if no status provided and no other filters
      query.status = 'scheduled';
    }

    if (revealed === 'true') {
      query.revealed = true;
    } else if (revealed === 'false') {
      query.revealed = false;
    }

    if (date) {
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
      query.preferredDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (!status && !date && !search) {
      // Default view: today's bookings if no date provided and no other filters
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      query.preferredDate = { $gte: startOfDay, $lte: endOfDay };
    }

    let matchQuery = query;

    // Search by customer name or phone requires a lookup since it's referenced
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // For search, we need to find matching users first
      const users = await mongoose.model('User').find({
        $or: [{ name: searchRegex }, { phone: searchRegex }]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      matchQuery = { ...query, userId: { $in: userIds } };
    }

    const sortQuery = status === 'all' ? { createdAt: -1 } : { preferredDate: 1, createdAt: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const bookings = await Booking.find(matchQuery)
      .populate('userId', 'name phone profilePhoto')
      .populate('jewelleryId', 'name images')
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(matchQuery);

    // Mask user details based on reveal flag
    const maskedBookings = bookings.map(booking => {
      const b = booking.toObject();
      if (!b.revealed && b.userId) {
        b.userId.name = null;
        b.userId.phone = null;
      }
      return b;
    });

    res.status(200).json({
      success: true,
      count: maskedBookings.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: maskedBookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Mark booking as visited
 * @route   PATCH /gehnaDekho/bookings/outlet/:id/status
 * @access  Private (Outlet Owner)
 */
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status, remark } = req.body;
    
    if (status !== 'visited') {
      return res.status(400).json({ success: false, message: 'Invalid status update' });
    }

    const outlet = await Outlet.findOne({ owner: req.user._id });
    if (!outlet) {
      return res.status(403).json({ success: false, message: 'You do not own an active outlet' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, outletId: outlet._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'visited') {
      return res.status(400).json({ success: false, message: 'Booking already marked as visited' });
    }

    booking.status = 'visited';
    booking.visitedAt = new Date();
    if (remark) booking.remark = remark;

    await booking.save();
    
    const populatedBooking = await Booking.findById(booking._id).populate('userId').populate('jewelleryId').populate('outletId');

    // Notify Customer
    await notificationService.createAndSend({
      title: 'Booking Completed',
      message: `You have successfully completed your visit to ${populatedBooking.outletId?.name || 'the outlet'} for ${populatedBooking.jewelleryId?.name || 'Jewellery'}.`,
      receiver: populatedBooking.userId,
      receiverType: 'user',
      targetMode: 'user',
      notificationType: 'BOOKING_UPDATE',
      eventId: booking._id,
    }).catch(err => console.error('Notification Error:', err));

    res.status(200).json({
      success: true,
      message: 'Booking marked as visited',
      data: booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Reveal customer details (Credit gated)
 * @route   POST /gehnaDekho/bookings/outlet/:id/reveal
 * @access  Private (Outlet Owner)
 */
exports.revealBookingDetails = async (req, res) => {
  // Start a transaction session for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const outlet = await Outlet.findOne({ owner: req.user._id }).session(session);
    if (!outlet) {
      throw new Error('You do not own an active outlet');
    }

    const booking = await Booking.findOne({ _id: req.params.id, outletId: outlet._id })
      .populate('userId', 'name phone')
      .session(session);
      
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Idempotent return if already revealed
    if (booking.revealed) {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'Details already revealed',
        data: {
          name: booking.userId?.name,
          phone: booking.userId?.phone
        }
      });
    }

    // Check config for cost
    const config = await CreditConfig.findOne({ 
      actionName: 'booking_reveal_fee', 
      isActive: true 
    }).session(session);
    
    const cost = config ? config.creditsRequired : 0;

    // If cost is 0, just reveal
    if (cost === 0) {
      booking.revealed = true;
      booking.revealedAt = new Date();
      await booking.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      return res.status(200).json({
        success: true,
        message: 'Details revealed for free',
        data: {
          name: booking.userId?.name,
          phone: booking.userId?.phone
        }
      });
    }

    // Cost > 0, check balance
    const currentBalance = (outlet.creditWallet && outlet.creditWallet.balance) || 0;
    if (currentBalance < cost) {
      const err = new Error('INSUFFICIENT_CREDITS');
      err.status = 400;
      throw err;
    }

    // Deduct credits and log
    outlet.creditWallet.balance = currentBalance - cost;
    outlet.creditWallet.lastUpdated = new Date();
    await outlet.save({ session });

    await CreditTransaction.create([{
      outletId: outlet._id,
      credits: cost,
      balance: outlet.creditWallet.balance,
      transactionType: 'debit',
      transactionReason: 'booking_reveal_fee',
      referenceModel: 'Booking',
      referenceId: booking._id,
      description: `Revealed customer details for booking ${booking._id}`,
      status: 'success'
    }], { session });

    booking.revealed = true;
    booking.revealedAt = new Date();
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Details revealed successfully',
      data: {
        name: booking.userId?.name,
        phone: booking.userId?.phone
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    const status = error.status || 500;
    res.status(status).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * @desc    Get all bookings (Admin)
 * @route   GET /gehnaDekho/bookings/admin/list
 * @access  Private (Admin)
 */
exports.getAdminBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, outletId, status, date, search } = req.query;
    
    let query = {};
    if (outletId) query.outletId = outletId;
    if (status) query.status = status;
    
    if (date) {
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
      query.preferredDate = { $gte: startOfDay, $lte: endOfDay };
    }

    let matchQuery = query;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const users = await mongoose.model('User').find({
        $or: [{ name: searchRegex }, { phone: searchRegex }]
      }).select('_id');
      matchQuery = { ...query, userId: { $in: users.map(u => u._id) } };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const bookings = await Booking.find(matchQuery)
      .populate('userId', 'name phone email')
      .populate('jewelleryId', 'name images')
      .populate('outletId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(matchQuery);

    res.status(200).json({
      success: true,
      count: bookings.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Cancel a booking
 * @route   PATCH /gehnaDekho/bookings/user/:id/cancel
 * @access  Private (Customer)
 */
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    booking.status = 'cancelled';
    await booking.save();
    
    const populatedBooking = await Booking.findById(booking._id).populate('userId').populate('jewelleryId').populate('outletId');

    // Notify Outlet Owner
    if (populatedBooking.outletId && populatedBooking.outletId.owner) {
      await notificationService.createAndSend({
        title: 'Booking Cancelled',
        message: `A booking for ${populatedBooking.jewelleryId?.name || 'Jewellery'} on ${new Date(populatedBooking.preferredDate).toDateString()} was cancelled by the customer.`,
        receiver: populatedBooking.outletId.owner,
        receiverType: 'user',
        targetMode: 'outlet',
        notificationType: 'BOOKING_UPDATE',
        eventId: booking._id,
      }).catch(err => console.error('Notification Error:', err));
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Edit booking details (Admin)
 * @route   PATCH /gehnaDekho/bookings/admin/:id
 * @access  Private (Admin)
 */
exports.editAdminBooking = async (req, res) => {
  try {
    const { status, preferredDate, remark } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    let statusChanged = false;

    if (status && status !== booking.status) {
      booking.status = status;
      statusChanged = true;
      if (status === 'visited' && !booking.visitedAt) {
        booking.visitedAt = new Date();
      }
    }
    
    if (preferredDate) {
      booking.preferredDate = new Date(preferredDate);
    }
    
    if (remark !== undefined) {
      booking.remark = remark;
    }

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id).populate('userId').populate('jewelleryId').populate('outletId');

    // If status changed, notify outlet owner
    if (statusChanged && populatedBooking.outletId && populatedBooking.outletId.owner) {
      await notificationService.createAndSend({
        title: 'Booking Status Updated',
        message: `Admin has updated a booking status to ${status.replace('_', ' ').toUpperCase()} for ${populatedBooking.jewelleryId?.name || 'Jewellery'}.`,
        receiver: populatedBooking.outletId.owner,
        receiverType: 'user',
        targetMode: 'outlet',
        notificationType: 'BOOKING_UPDATE',
        eventId: booking._id,
      }).catch(err => console.error('Notification Error:', err));
    }

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
