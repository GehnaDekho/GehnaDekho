const ServiceRequest = require("../models/ServiceRequest");
const Service = require("../models/Service");
const Outlet = require("../models/Outlet");
const CreditTransaction = require("../models/CreditTransaction");

/**
 * @desc    Submit a service request (Outlet Owner Only)
 *          Deducts credits, updates wallet balance, and logs credit transactions.
 * @route   POST /gehnaDekho/service-requests
 * @access  Private (Outlet Owner Only)
 */
const createServiceRequest = async (req, res) => {
  try {
    const { serviceId, description, outletId } = req.body;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Please specify the service configuration ID",
      });
    }

    // 1. Resolve active outlet belonging to this owner
    const outlet = await Outlet.findOne({
      owner: req.user._id,
      status: "approved",
    });
    if (!outlet) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You do not own an active outlet",
      });
    }

    // 2. Fetch the target service cost configuration
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Support service configuration not found",
      });
    }

    if (!service.isActive) {
      return res.status(400).json({
        success: false,
        message: `Service '${service.name}' is currently deactivated or unavailable`,
      });
    }

    // 3. Create ServiceRequest document
    const requestDoc = await ServiceRequest.create({
      outlet: outlet._id,
      service: serviceId,
      description: description || "",
    });

    const populatedRequest = await ServiceRequest.findById(requestDoc._id)
      .populate("service")
      .populate("outlet", "name email phone creditWallet");

    res.status(201).json({
      success: true,
      message: "Service request submitted successfully",
      data: populatedRequest,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get service requests (Outlet Owner & Admin Only)
 * @route   GET /gehnaDekho/service-requests
 * @access  Private (Owner or Admin)
 */
const getServiceRequests = async (req, res) => {
  try {
    const query = {};

    // ==========================================
    // ACCESS CONTROL
    // ==========================================
    if (req.user.role !== "admin") {
      const outlet = await Outlet.findOne({
        owner: req.user._id,
        status: "approved",
      });
      if (!outlet) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not own an active outlet",
        });
      }
      query.outlet = outlet._id;
    } else {
      if (req.query.outletId) {
        query.outlet = req.query.outletId;
      }
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const requests = await ServiceRequest.find(query)
      .populate("service")
      .populate("outlet", "name email phone location creditWallet")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ServiceRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      count: requests.length,
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
 * @desc    Get single service request details
 * @route   GET /gehnaDekho/service-requests/:id
 * @access  Private (Owner or Admin)
 */
const getServiceRequestById = async (req, res) => {
  try {
    const requestDoc = await ServiceRequest.findById(req.params.id)
      .populate("service")
      .populate("outlet", "name email phone location creditWallet");

    if (!requestDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Service request not found" });
    }

    // Access control
    if (req.user.role !== "admin") {
      const outlet = await Outlet.findOne({ owner: req.user._id });
      if (
        !outlet ||
        requestDoc.outlet._id.toString() !== outlet._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this request details",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: requestDoc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Approve, modify status, or cancel service request (Admin Only)
 *          Automatically handles credit refunds when a request is cancelled.
 * @route   PUT /gehnaDekho/service-requests/:id/status
 * @access  Private (Admin Only)
 */
const reviewServiceRequest = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    if (
      !status ||
      !["pending", "in_progress", "resolved", "cancelled"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid status (pending, in_progress, resolved, or cancelled)",
      });
    }

    const requestDoc = await ServiceRequest.findById(req.params.id)
      .populate("service")
      .populate("outlet");
    if (!requestDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Service request not found" });
    }

    // If already in target status, return immediately
    if (requestDoc.status === status) {
      if (adminNotes !== undefined) {
        requestDoc.adminNotes = adminNotes;
        await requestDoc.save();
      }
      return res.status(200).json({
        success: true,
        message: `Status is already ${status}`,
        data: requestDoc,
      });
    }

    // No credit refund since requesting a service does not charge credits.

    // Update fields
    requestDoc.status = status;
    if (adminNotes !== undefined) {
      requestDoc.adminNotes = adminNotes;
    }

    await requestDoc.save();

    res.status(200).json({
      success: true,
      message: `Service request status successfully updated to ${status}`,
      data: requestDoc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  reviewServiceRequest,
};
