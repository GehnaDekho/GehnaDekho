const Admin = require('../models/Admin');
const Outlet = require('../models/Outlet');
const User = require('../models/User');
const Jewellery = require('../models/Jewellery');
const CreditTransaction = require('../models/CreditTransaction');
const ServiceRequest = require('../models/ServiceRequest');
const PurchaseHistory = require('../models/PurchaseHistory');
const { generateToken } = require('../utils/jwtToken');

/**
 * @desc    Register initial Admin (Setup / Seed)
 * @route   POST /api/admin/register
 * @access  Public
 */
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists with this email' });
    }

    const hashedPassword = Admin.hashPassword(password);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword
    });

    if (admin) {
      const token = generateToken({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET);
      res.status(201).json({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        token
      });
    } else {
      res.status(400).json({ message: 'Invalid admin data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Admin Login
 * @route   POST /api/admin/login
 * @access  Public
 */
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: 'Admin account is deactivated' });
    }

    const isMatch = admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET);

    res.status(200).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get current admin profile
 * @route   GET /api/admin/profile
 * @access  Private/Admin
 */
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.status(200).json(admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update admin profile
 * @route   PUT /api/admin/profile
 * @access  Private/Admin
 */
const updateAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const { name, email, password } = req.body;

    // Email unique check
    if (email && email !== admin.email) {
      const emailExists = await Admin.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already registered by another admin' });
      }
      admin.email = email;
    }

    if (name) admin.name = name;
    if (password) {
      admin.password = Admin.hashPassword(password);
    }

    const updatedAdmin = await admin.save();

    res.status(200).json({
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: updatedAdmin.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get ERP-style aggregated dashboard stats
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res) => {
  try {
    const { economyStart, economyEnd } = req.query;
    
    // Construct date match for economy filters
    const dateMatch = {};
    if (economyStart || economyEnd) {
      dateMatch.createdAt = {};
      if (economyStart) dateMatch.createdAt.$gte = new Date(economyStart);
      if (economyEnd) {
        const end = new Date(economyEnd);
        end.setHours(23, 59, 59, 999);
        dateMatch.createdAt.$lte = end;
      }
    }

    const [
      activeOutlets,
      pendingOutlets,
      totalCustomers,
      totalJewelleries,
      pendingServices,
      recentTransactions,
      financials,
      revenueStats
    ] = await Promise.all([
      Outlet.countDocuments({ status: 'approved' }),
      Outlet.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'customer' }),
      Jewellery.countDocuments({}),
      ServiceRequest.countDocuments({ status: 'pending' }),
      CreditTransaction.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('outletId', 'name phone'),
      CreditTransaction.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            totalRecharged: {
              $sum: {
                $cond: [{ $eq: ['$transactionType', 'credit'] }, '$credits', 0]
              }
            },
            totalSpent: {
              $sum: {
                $cond: [{ $eq: ['$transactionType', 'debit'] }, '$credits', 0]
              }
            }
          }
        }
      ]),
      PurchaseHistory.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const financialData = financials.length > 0 ? financials[0] : { totalRecharged: 0, totalSpent: 0 };
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;
    financialData.totalRevenue = totalRevenue;

    res.status(200).json({
      success: true,
      data: {
        activeOutlets,
        pendingOutlets,
        totalCustomers,
        totalJewelleries,
        pendingServices,
        recentTransactions,
        financials: financialData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  getDashboardStats
};
