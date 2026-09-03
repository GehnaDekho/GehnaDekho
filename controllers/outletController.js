const Outlet = require('../models/Outlet');
const User = require('../models/User');
const Jewellery = require('../models/Jewellery');
const FeaturedJewelleryHistory = require('../models/FeaturedJewelleryHistory');
const Feedback = require('../models/Feedback');
const Review = require('../models/Review');
const CreditTransaction = require('../models/CreditTransaction');
const Reel = require('../models/Reel');
const PurchaseHistory = require('../models/PurchaseHistory');
const ServiceRequest = require('../models/ServiceRequest');
const mongoose = require('mongoose');
const notificationService = require('../services/notification.service');

/**
 * @desc    Submit an onboarding application for an outlet
 * @route   POST /api/outlets
 * @access  Private (Authenticated users)
 */
const createOutlet = async (req, res) => {
  try {
    const { name, address, phone, email, location, kycDetails, city, googleMapLink, brand } = req.body;

    // Validate required fields
    if (!name || !address || !phone || !city) {
      return res.status(400).json({ message: 'Please provide all required fields (name, address, phone, city)' });
    }

    // Verify if user already has a pending or approved outlet request
    const outletExists = await Outlet.findOne({ 
      owner: req.user._id, 
      status: { $in: ['pending', 'approved'] } 
    });
    if (outletExists) {
      return res.status(400).json({ message: 'You have already applied for or registered an active outlet' });
    }

    // Verify phone uniqueness across pending or approved outlets
    const phoneExists = await Outlet.findOne({ 
      phone, 
      status: { $in: ['pending', 'approved'] } 
    });
    if (phoneExists) {
      return res.status(400).json({ message: 'An active outlet is already registered with this phone number' });
    }

    const outlet = await Outlet.create({
      owner: req.user._id,
      name,
      address,
      phone,
      email: email || '',
      location: location || { lat: null, lng: null },
      kycDetails: kycDetails || { gstNumber: '', panNumber: '', documentUrl: '' },
      city,
      brand: brand || null,
      googleMapLink: googleMapLink || ''
    });

    res.status(201).json(outlet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Directly create an outlet owner (registers user, sets role, creates approved outlet)
 * @route   POST /api/outlets/direct
 * @access  Private (Admin Only)
 */
const createOutletOwnerDirectly = async (req, res) => {
  let createdUser = null;
  try {
    // Support both flat fields and nested objects in payload
    const ownerName = req.body.ownerName || (req.body.owner && req.body.owner.name);
    const ownerEmail = req.body.ownerEmail || (req.body.owner && req.body.owner.email);
    const ownerPhone = req.body.ownerPhone || (req.body.owner && req.body.owner.phone);

    const outletName = req.body.name || req.body.outletName || (req.body.outlet && req.body.outlet.name);
    const address = req.body.address || req.body.outletAddress || (req.body.outlet && req.body.outlet.address);
    const outletPhone = req.body.phone || req.body.outletPhone || (req.body.outlet && req.body.outlet.phone);
    const outletEmail = req.body.email || req.body.outletEmail || (req.body.outlet && req.body.outlet.email) || '';
    const location = req.body.location || (req.body.outlet && req.body.outlet.location) || { lat: null, lng: null };
    const kycDetails = req.body.kycDetails || (req.body.outlet && req.body.outlet.kycDetails) || { gstNumber: '', panNumber: '', documentUrl: '' };
    const city = req.body.city || (req.body.outlet && req.body.outlet.city);
    const googleMapLink = req.body.googleMapLink || (req.body.outlet && req.body.outlet.googleMapLink) || '';

    // 1. Validate required fields
    if (!ownerName || !ownerEmail || !ownerPhone) {
      return res.status(400).json({ message: 'Please provide all owner fields (ownerName, ownerEmail, ownerPhone)' });
    }
    if (!outletName || !address || !outletPhone || !city) {
      return res.status(400).json({ message: 'Please provide all outlet fields (name, address, phone, city)' });
    }

    // 2. Verify owner constraints
    const userExists = await User.findOne({ $or: [{ email: ownerEmail }, { phone: ownerPhone }] });
    if (userExists) {
      const field = userExists.email === ownerEmail ? 'Email' : 'Phone number';
      return res.status(400).json({ message: `${field} is already registered to a user` });
    }

    // 3. Verify phone uniqueness across active outlets
    const phoneExists = await Outlet.findOne({ 
      phone: outletPhone, 
      status: { $in: ['pending', 'approved'] } 
    });
    if (phoneExists) {
      return res.status(400).json({ message: 'An active outlet is already registered with this contact number' });
    }

    // 4. Create Owner User first
    createdUser = await User.create({
      name: ownerName,
      email: ownerEmail,
      phone: ownerPhone,
      role: 'outlet_owner'
    });

    // 5. Create Outlet linked to owner
    const outlet = await Outlet.create({
      owner: createdUser._id,
      name: outletName,
      address,
      phone: outletPhone,
      email: outletEmail,
      location,
      kycDetails,
      status: 'approved',
      kycStatus: 'approved',
      city,
      googleMapLink
    });

    // 6. Link Outlet back to Owner User
    createdUser.outletId = outlet._id;
    await createdUser.save();

    // 7. Return populated outlet details
    const populatedOutlet = await Outlet.findById(outlet._id)
      .populate('owner', 'name email phone profilePhoto role outletId rewardPoints');

    res.status(201).json(populatedOutlet);
  } catch (error) {
    // Transaction Rollback: Clean up orphaned User document if outlet creation failed
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all outlets (Paginated, filtered by KYC, with cross-collection owner searching)
 * @route   GET /api/outlets
 * @access  Public
 */
const getOutlets = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by KYC status
    if (req.query.kycStatus) {
      query.kycStatus = req.query.kycStatus;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.city) {
      query.city = req.query.city;
    }

    // Advanced search logic across Outlet details AND Owner details
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');

      // 1. Search User collection for owners matching search parameters (owner name, phone, email)
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');

      const matchingUserIds = matchingUsers.map(user => user._id);

      // 2. Query Outlet: name, contact phone, contact email OR matching owner IDs
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { owner: { $in: matchingUserIds } }
      ];
    }

    const totalOutlets = await Outlet.countDocuments(query);

    const counts = {
      pending: await Outlet.countDocuments({ kycStatus: 'pending' }),
      approved: await Outlet.countDocuments({ kycStatus: 'approved' }),
      rejected: await Outlet.countDocuments({ kycStatus: 'rejected' })
    };

    let sortObj = { createdAt: -1 };
    if (req.query.sortBy === 'qualityIndex') {
      sortObj = { qualityIndex: -1, rating: -1, createdAt: 1 };
    }

    const outlets = await Outlet.find(query)
      .populate('owner', 'name email phone profilePhoto role rewardPoints')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      outlets,
      counts,
      pagination: {
        total: totalOutlets,
        page,
        limit,
        pages: Math.ceil(totalOutlets / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get details of a single outlet by ID
 * @route   GET /api/outlets/:id
 * @access  Public
 */
const getOutletById = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id)
      .populate('owner', 'name email phone profilePhoto role rewardPoints')
      .populate('brand', 'name logo')
      .lean();

    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    const Review = require('../models/Review');
    const totalReviews = await Review.countDocuments({ outlet: req.params.id });
    
    outlet.totalReviews = totalReviews;

    res.status(200).json(outlet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update details of an outlet
 * @route   PUT /api/outlets/:id
 * @access  Private (Owner or Admin)
 */
const updateOutlet = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    // Authorization checks
    const isOwner = req.user._id.toString() === outlet.owner.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to modify this outlet profile' });
    }

    const {
      name,
      address,
      phone,
      email,
      location,
      kycDetails,
      kycStatus,
      adminMessage,
      freeUploadsLimit,
      creditWallet,
      city,
      googleMapLink,
      images,
      description,
      openingTime,
      closingTime,
      closedDays,
      website,
      instagram,
      facebook,
      specializations,
      establishedYear,
      brand,
      status
    } = req.body;

    // Contact number unique check
    if (phone && phone !== outlet.phone) {
      const phoneExists = await Outlet.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({ message: 'An outlet is already registered with this phone number' });
      }
      outlet.phone = phone;
    }

    // Apply updates allowed for owners
    if (name) outlet.name = name;
    if (address) outlet.address = address;
    if (email !== undefined) outlet.email = email;
    if (location) outlet.location = location;
    if (city) outlet.city = city;
    if (googleMapLink !== undefined) outlet.googleMapLink = googleMapLink;
    if (images !== undefined) outlet.images = images;
    if (description !== undefined) outlet.description = description;
    if (openingTime !== undefined) outlet.openingTime = openingTime;
    if (closingTime !== undefined) outlet.closingTime = closingTime;
    if (closedDays !== undefined) outlet.closedDays = closedDays;
    if (website !== undefined) outlet.website = website;
    if (instagram !== undefined) outlet.instagram = instagram;
    if (facebook !== undefined) outlet.facebook = facebook;
    if (specializations !== undefined) outlet.specializations = specializations;
    if (establishedYear !== undefined) outlet.establishedYear = establishedYear;
    if (brand !== undefined) outlet.brand = brand || null;
    if (kycDetails) {
      outlet.kycDetails = {
        gstNumber: kycDetails.gstNumber !== undefined ? kycDetails.gstNumber : outlet.kycDetails.gstNumber,
        panNumber: kycDetails.panNumber !== undefined ? kycDetails.panNumber : outlet.kycDetails.panNumber,
        documentUrl: kycDetails.documentUrl !== undefined ? kycDetails.documentUrl : outlet.kycDetails.documentUrl
      };
    }

    // Apply administrative updates (Admins only)
    if (isAdmin) {
      if (status) {
        outlet.status = status;
        outlet.kycStatus = status;
        if (status === 'approved') {
          await User.findByIdAndUpdate(outlet.owner, { role: 'outlet_owner', outletId: outlet._id });
        } else if (status === 'rejected') {
          await User.findByIdAndUpdate(outlet.owner, { role: 'customer', outletId: null });
        }
      } else if (kycStatus) {
        outlet.kycStatus = kycStatus;
        if (kycStatus === 'approved') {
          outlet.status = 'approved';
          await User.findByIdAndUpdate(outlet.owner, { role: 'outlet_owner', outletId: outlet._id });
        } else if (kycStatus === 'rejected') {
          outlet.status = 'rejected';
          await User.findByIdAndUpdate(outlet.owner, { role: 'customer', outletId: null });
        }
      }
      if (adminMessage !== undefined) outlet.adminMessage = adminMessage;
      if (typeof freeUploadsLimit === 'number') outlet.freeUploadsLimit = freeUploadsLimit;
      if (creditWallet && typeof creditWallet.balance === 'number') {
        outlet.creditWallet = {
          balance: creditWallet.balance,
          lastUpdated: Date.now()
        };
      }
    }

    const updatedOutlet = await outlet.save();
    
    // Fetch newly saved outlet populated with owner details
    const populatedUpdated = await Outlet.findById(updatedOutlet._id)
      .populate('owner', 'name email phone profilePhoto role rewardPoints');

    res.status(200).json(populatedUpdated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete an outlet
 * @route   DELETE /api/outlets/:id
 * @access  Private/Admin
 */
const deleteOutlet = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id);

    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    // Automatically demote the owner role back to 'customer' and clear outletId upon outlet removal
    await User.findByIdAndUpdate(outlet.owner, { role: 'customer', outletId: null });

    await Outlet.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: 'Outlet deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Approve or Reject an outlet onboarding request
 * @route   PUT /api/outlets/:id/status
 * @access  Private (Admin Only)
 */
const reviewOutletRequest = async (req, res) => {
  try {
    const { status, adminMessage } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Please provide a valid status (approved or rejected)' });
    }

    const outlet = await Outlet.findById(req.params.id);
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet request not found' });
    }

    outlet.status = status;
    outlet.kycStatus = status; // Keep KYC and onboarding status aligned

    if (status === 'approved') {
      outlet.adminMessage = adminMessage || 'Your outlet onboarding request has been approved.';
      
      // Update the owner's role to 'outlet_owner' and associate their outletId
      await User.findByIdAndUpdate(outlet.owner, {
        role: 'outlet_owner',
        outletId: outlet._id
      });

      await notificationService.createAndSend({
        title: 'Outlet Approved',
        message: `Congratulations! Your outlet "${outlet.name}" has been approved.`,
        receiver: outlet.owner,
        receiverType: 'user',
        targetMode: 'outlet',
        notificationType: 'OUTLET_UPDATE',
        eventId: outlet._id,
      }).catch(err => console.error('Notification Error:', err));
      
    } else if (status === 'rejected') {
      if (!adminMessage) {
        return res.status(400).json({ message: 'Please provide an adminMessage explaining the rejection reason' });
      }
      outlet.adminMessage = adminMessage;

      // Reset owner role to customer and clear outletId
      await User.findByIdAndUpdate(outlet.owner, {
        role: 'customer',
        outletId: null
      });

      await notificationService.createAndSend({
        title: 'Outlet Update',
        message: `Unfortunately, your outlet application was rejected. Reason: ${adminMessage}`,
        receiver: outlet.owner,
        receiverType: 'user',
        notificationType: 'OUTLET_UPDATE',
        eventId: outlet._id,
      }).catch(err => console.error('Notification Error:', err));
    }

    const updatedOutlet = await outlet.save();
    
    // Return populated results
    const populatedOutlet = await Outlet.findById(updatedOutlet._id)
      .populate('owner', 'name email phone profilePhoto role outletId rewardPoints');

    res.status(200).json(populatedOutlet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get comprehensive stats for an outlet (Owner or Admin Only)
 * @route   GET /api/outlets/:id/stats
 * @access  Private (Owner or Admin)
 */
const getOutletStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // 1. Fetch the target outlet
    const outlet = await Outlet.findById(id);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // 2. Authorization check: Requester must be Admin or the Outlet Owner
    if (req.user.role !== 'admin' && outlet.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view statistics for this outlet'
      });
    }

    // 3. Build dynamic range filters based on provided start/end dates
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const historyDateFilter = {};
    if (startDate || endDate) {
      historyDateFilter.date = {};
      if (startDate) historyDateFilter.date.$gte = new Date(startDate);
      if (endDate) historyDateFilter.date.$lte = new Date(endDate);
    }

    // 4. Catalog Upload and Showcase Stats
    const jewelleriesUploaded = await Jewellery.countDocuments({
      outlet: outlet._id,
      ...dateFilter
    });

    const jewelleriesFeatured = await FeaturedJewelleryHistory.countDocuments({
      outlet: outlet._id,
      ...historyDateFilter
    });

    const reelsUploaded = await Reel.countDocuments({
      outlet: outlet._id,
      ...dateFilter
    });

    // Query service requests count from ServiceRequest model
    const servicesRequested = await ServiceRequest.countDocuments({
      outlet: outlet._id,
      ...dateFilter
    });

    // 5. Public Reviews and Overall Average Rating Stats
    const matchCriteria = {
      outlet: outlet._id,
      isActive: { $ne: false }
    };
    if (dateFilter.createdAt) {
      matchCriteria.createdAt = dateFilter.createdAt;
    }

    const reviewStats = await Review.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$averageScore' },
          count: { $sum: 1 }
        }
      }
    ]);

    const reviewsCount = reviewStats.length > 0 ? reviewStats[0].count : 0;
    const overallRating = reviewStats.length > 0 ? Number(reviewStats[0].avgRating.toFixed(2)) : 0;

    // 6. Direct Private Customer Feedback Stats
    const totalFeedback = await Feedback.countDocuments({
      outlet: outlet._id,
      isDeleted: false,
      ...dateFilter
    });

    const viewedFeedback = await Feedback.countDocuments({
      outlet: outlet._id,
      isDeleted: false,
      isUnlocked: true,
      ...dateFilter
    });

    // 7. Credit Wallet & Usage Ledger Breakdowns
    const matchTx = {
      outletId: outlet._id,
      status: 'success',
      isDeleted: false
    };
    if (dateFilter.createdAt) {
      matchTx.createdAt = dateFilter.createdAt;
    }

    const txStats = await CreditTransaction.aggregate([
      { $match: matchTx },
      {
        $group: {
          _id: { type: '$transactionType', reason: '$transactionReason' },
          totalCredits: { $sum: '$credits' }
        }
      }
    ]);

    let totalCreditsPurchased = 0;
    let totalCreditsUsed = 0;
    let creditsUsedToFeature = 0;
    let creditsSpentToViewFeedback = 0;
    let creditsSpentToUploadJewellery = 0;
    let creditsSpentOther = 0;

    txStats.forEach(stat => {
      const type = stat._id.type;
      const reason = stat._id.reason;
      const amount = stat.totalCredits;

      if (type === 'credit') {
        totalCreditsPurchased += amount;
      } else if (type === 'debit') {
        totalCreditsUsed += amount;
        if (reason === 'jewellery_feature') {
          creditsUsedToFeature += amount;
        } else if (reason === 'feedback_view') {
          creditsSpentToViewFeedback += amount;
        } else if (reason === 'jewellery_upload') {
          creditsSpentToUploadJewellery += amount;
        } else {
          creditsSpentOther += amount;
        }
      }
    });

    const transactions = await CreditTransaction.find(matchTx).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        outletId: outlet._id,
        outletName: outlet.name,
        currentWalletBalance: (outlet.creditWallet && outlet.creditWallet.balance) || 0,
        activity: {
          jewelleriesUploaded,
          jewelleriesFeatured,
          reelsUploaded,
          servicesRequested
        },
        credits: {
          totalCreditsPurchased,
          totalCreditsUsed,
          creditsUsedToFeature,
          creditsSpentToViewFeedback,
          creditsSpentToUploadJewellery,
          creditsSpentOther
        },
        reviewsAndFeedback: {
          reviewsCount,
          feedbackCount: totalFeedback,
          viewedFeedbackCount: viewedFeedback,
          overallRating
        },
        transactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get paginated purchase history list of an outlet with date filter and cumulative stats
 * @route   GET /api/outlets/:id/purchases
 * @access  Private (Admin or Outlet Owner)
 */
const getOutletPurchases = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const outlet = await Outlet.findById(id);
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet not found' });
    }

    // Authorization check: Requester must be Admin or the Outlet Owner
    if (req.user.role !== 'admin' && outlet.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view purchase history for this outlet'
      });
    }

    // Build filter for paginated list
    const filter = { outletId: id };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Fetch purchases
    const purchases = await PurchaseHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PurchaseHistory.countDocuments(filter);

    // Compute cumulative metrics (Till Date, regardless of active date filter)
    const cumulativeStats = await PurchaseHistory.aggregate([
      { $match: { outletId: outlet._id } },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$credits' },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalCreditsPurchased = cumulativeStats.length > 0 ? cumulativeStats[0].totalCredits : 0;
    const totalAmountGiven = cumulativeStats.length > 0 ? cumulativeStats[0].totalAmount : 0;

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      data: {
        purchases,
        totalCreditsPurchased,
        totalAmountGiven
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get featured outlets for Home Screen display
 * @route   GET /outlets/featured-home
 * @access  Public
 */
const getFeaturedOutlets = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const query = {
      isFeaturedHome: true,
      status: 'approved',
      kycStatus: 'approved'
    };

    if (req.query.city) {
      query.city = req.query.city;
    }

    const outlets = await Outlet.find(query)
      .populate('owner', 'name phone')
      .select('name address phone email images location rating featuredPriority')
      .sort({ featuredPriority: 1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      count: outlets.length,
      data: outlets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get top ranked outlets for Home Screen display (by qualityIndex)
 * @route   GET /api/outlets/top-ranked
 * @access  Public
 */
const getTopRankedOutlets = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const query = {
      status: 'approved',
      kycStatus: 'approved'
    };

    if (req.query.city) {
      query.city = req.query.city;
    }

    const outlets = await Outlet.find(query)
      .populate('owner', 'name phone')
      .select('name address phone email images location rating qualityIndex')
      .sort({ qualityIndex: -1, rating: -1, createdAt: 1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      count: outlets.length,
      data: outlets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOutlet,
  createOutletOwnerDirectly,
  getOutlets,
  getOutletById,
  updateOutlet,
  deleteOutlet,
  reviewOutletRequest,
  getOutletStats,
  getOutletPurchases,
  getFeaturedOutlets,
  getTopRankedOutlets
};
