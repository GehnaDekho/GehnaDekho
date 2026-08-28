const express = require("express");
const router = express.Router();
const {
  createBooking,
  getBookingById,
  getOutletBookings,
  updateBookingStatus,
  revealBookingDetails,
  getAdminBookings,
  getUserBookings,
  cancelBooking,
  editAdminBooking,
} = require("../controllers/bookingController");
const { protect, authorize } = require("../middleware/authMiddleware");

// @route   POST /gehnaDekho/bookings
// @desc    Create a new booking (Customer)
router.post("/", protect, authorize("customer", "outlet_owner"), createBooking);

// @route   GET /gehnaDekho/bookings/user/list
// @desc    Get paginated bookings for a customer (Customer)
router.get(
  "/user/list",
  protect,
  authorize("customer", "outlet_owner"),
  getUserBookings,
);

// @route   PATCH /gehnaDekho/bookings/user/:id/cancel
// @desc    Cancel a booking (Customer)
router.patch(
  "/user/:id/cancel",
  protect,
  authorize("customer", "outlet_owner"),
  cancelBooking
);

// @route   GET /gehnaDekho/bookings/admin/list
// @desc    Get all bookings (Admin)
router.get("/admin/list", protect, authorize("admin"), getAdminBookings);

// @route   PATCH /gehnaDekho/bookings/admin/:id
// @desc    Edit booking details (Admin)
router.patch("/admin/:id", protect, authorize("admin"), editAdminBooking);

// @route   GET /gehnaDekho/bookings/outlet/list
// @desc    Get paginated bookings for an outlet (Outlet Owner)
router.get(
  "/outlet/list",
  protect,
  authorize("outlet_owner"),
  getOutletBookings,
);

// @route   GET /gehnaDekho/bookings/:id
// @desc    Get single booking by ID
router.get("/:id", protect, getBookingById);

// @route   PATCH /gehnaDekho/bookings/outlet/:id/status
// @desc    Mark booking as visited (Outlet Owner)
router.patch(
  "/outlet/:id/status",
  protect,
  authorize("outlet_owner"),
  updateBookingStatus,
);

// @route   POST /gehnaDekho/bookings/outlet/:id/reveal
// @desc    Reveal customer details (Outlet Owner)
router.post(
  "/outlet/:id/reveal",
  protect,
  authorize("outlet_owner"),
  revealBookingDetails,
);

module.exports = router;
