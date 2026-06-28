const User = require('../models/User');
const Admin = require('../models/Admin');
const { verifyToken } = require('../utils/jwtToken');

/**
 * Protect routes - only authenticated users/admins with valid JWT token can proceed
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = verifyToken(token, process.env.JWT_SECRET);
      if (!decoded) {
        return res.status(401).json({ message: 'Not authorized, token failed' });
      }

      // Check role and fetch from the correct collection
      if (decoded.role === 'admin') {
        req.user = await Admin.findById(decoded.id).select('-password');
      } else {
        req.user = await User.findById(decoded.id).select('-otp -otpExpires');
      }

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

/**
 * Authorize roles - restricts route to specified roles
 * @param {...String} roles - List of allowed roles (e.g., 'admin', 'outlet_owner')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user ? req.user.role : 'anonymous'}' is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
