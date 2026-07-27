const User = require("../models/User");
const OtpSession = require("../models/OtpSession");
const { generateToken } = require("../utils/jwtToken");
const { sendMsg91Otp } = require("../utils/msg91");

/**
 * @desc    Register a new user
 * @route   POST /api/users/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, phone, profilePhoto, role, city } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({
          message: "Please add all required fields (name, email, phone)",
        });
    }

    // Check if user already exists (by email or phone number)
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      const field = userExists.email === email ? "Email" : "Phone number";
      return res.status(400).json({ message: `${field} already registered` });
    }

    // Create the user
    const user = await User.create({
      name,
      email,
      phone,
      profilePhoto: profilePhoto || "default.jpg",
      role: role || "customer",
      city: city || null,
    });

    if (user) {
      // Issue a JWT token upon successful registration
      const token = generateToken(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
      );

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        rewardPoints: user.rewardPoints,
        city: user.city,
        token,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Login via OTP (Generate & Mock OTP)
 * @route   POST /api/users/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Please provide a phone number" });
    }

    // Generate a 4-digit random OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Set expiration to 5 minutes from now
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    // Save or update OTP in OtpSession
    await OtpSession.findOneAndUpdate(
      { phone },
      { otp, otpExpires },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Log the OTP on the console for backend test accessibility
    console.log(`\n==============================================`);
    console.log(`[OTP SYSTEM]`);
    console.log(`User Phone: ${phone}`);
    console.log(`4-Digit OTP Code: ${otp}`);
    console.log(`Expires: ${otpExpires.toLocaleTimeString()}`);
    console.log(`==============================================\n`);

    // Try to send the OTP via MSG91
    try {
      if (process.env.ENABLE_OTP_BYPASS !== "true") {
        await sendMsg91Otp(phone, otp);
      }
    } catch (err) {
      console.error("Failed to send OTP via SMS Gateway:", err);
      // We don't fail the request here, but log it. In production, you might want to return an error.
    }

    // Respond to user
    res.status(200).json({
      message: "OTP sent successfully",
      phone,
      // For development/bypass, return mockOtp
      mockOtp: process.env.ENABLE_OTP_BYPASS === "true" ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Verify OTP and return JWT token
 * @route   POST /api/users/verify-otp
 * @access  Public
 */
const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ message: "Please provide phone and 4-digit OTP" });
    }

    // TODO: Remove OTP Bypass once SMS Gateway is integrated
    const isBypassMode = process.env.ENABLE_OTP_BYPASS === "true";

    // Find active OTP session
    const session = await OtpSession.findOne({ phone });
    if (!isBypassMode && !session) {
      return res
        .status(400)
        .json({
          message: "OTP has expired or is invalid. Please request a new one.",
        });
    }

    // Verify OTP
    if (!isBypassMode && session.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // Check if expired (in case TTL index hasn't run yet)
    if (!isBypassMode && new Date() > session.otpExpires) {
      await OtpSession.deleteOne({ phone });
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Clear session upon successful verification
    if (session) {
      await OtpSession.deleteOne({ phone });
    }

    // Check if user exists in the database
    const user = await User.findOne({ phone });
    if (!user) {
      // User is new; return verified flag and phone number for registration redirect
      return res.status(200).json({
        isNewUser: true,
        phone,
        message: "Verification successful. Please register.",
      });
    }

    // Existing user; generate JWT token and return profile
    const token = generateToken(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
    );

    res.status(200).json({
      isNewUser: false,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      rewardPoints: user.rewardPoints,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all users with Pagination and Search Filters
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const query = {};

    // Filter by role (customer, outlet_owner)
    if (req.query.role) {
      query.role = req.query.role;
    }

    // Search filter: searches case-insensitively in name, email, or phone
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Count matching users
    const totalUsers = await User.countDocuments(query);

    // Retrieve matching users, excluding sensitive fields, sorted by creation date
    const users = await User.find(query)
      .select("-otp -otpExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Fetch aggregate totals for administrative dashboard overview
    const totalCount = await User.countDocuments({});
    const ownersCount = await User.countDocuments({ role: "outlet_owner" });
    const customersCount = await User.countDocuments({ role: "customer" });

    res.status(200).json({
      users,
      counts: {
        total: totalCount,
        owners: ownersCount,
        customers: customersCount,
      },
      pagination: {
        total: totalUsers,
        page,
        limit,
        pages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get a single user by ID
 * @route   GET /api/users/:id
 * @access  Private (Self or Admin)
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-otp -otpExpires")
      .populate("outletId");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Authorization check: only Admin or the user themselves can retrieve this profile
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this profile" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update a user profile
 * @route   PUT /api/users/:id
 * @access  Private (Self or Admin)
 */
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Authorization check: only Admin or the user themselves can update this profile
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this profile" });
    }

    const { name, email, phone, profilePhoto, role, rewardPoints } = req.body;

    // Check if the new email or phone is already registered by another user
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res
          .status(400)
          .json({ message: "Email is already registered by another user" });
      }
      user.email = email;
    }

    if (phone && phone !== user.phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res
          .status(400)
          .json({
            message: "Phone number is already registered by another user",
          });
      }
      user.phone = phone;
    }

    // Apply updates
    if (name) user.name = name;
    if (profilePhoto) user.profilePhoto = profilePhoto;

    // Restricted fields: Only admins can alter role and rewardPoints
    if (req.user.role === "admin") {
      if (role) user.role = role;
      if (typeof rewardPoints === "number") user.rewardPoints = rewardPoints;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      rewardPoints: updatedUser.rewardPoints,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update user's device token for Push Notifications
 * @route   POST /api/users/update-device
 * @access  Private
 */
const updateDeviceToken = async (req, res) => {
  try {
    const { token, platform, deviceId, appVersion } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ message: "Device token is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if device already exists
    const existingDeviceIndex = user.devices.findIndex(d => d.token === token || (deviceId && d.deviceId === deviceId));

    if (existingDeviceIndex !== -1) {
      // Update existing device
      user.devices[existingDeviceIndex].token = token;
      user.devices[existingDeviceIndex].platform = platform || user.devices[existingDeviceIndex].platform;
      user.devices[existingDeviceIndex].appVersion = appVersion || user.devices[existingDeviceIndex].appVersion;
      user.devices[existingDeviceIndex].active = true;
      user.devices[existingDeviceIndex].lastSeen = new Date();
    } else {
      // Add new device
      user.devices.push({
        token,
        platform,
        deviceId,
        appVersion,
        active: true,
        lastSeen: new Date()
      });
    }

    await user.save();
    res.status(200).json({ success: true, message: "Device token updated" });
  } catch (error) {
    console.error("updateDeviceToken Error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateDeviceToken,
};
