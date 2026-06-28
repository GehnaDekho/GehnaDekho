const Slot = require('../models/Slot');
const FeaturedJewelleryHistory = require('../models/FeaturedJewelleryHistory');

/**
 * @desc    Create a new featured slot
 * @route   POST /gehnaDekho/slots
 * @access  Private (Admin Only)
 */
const createSlot = async (req, res) => {
  try {
    const { slotNumber, price, description } = req.body;

    if (slotNumber === undefined || price === undefined) {
      return res.status(400).json({ message: 'Please provide both slotNumber and credit price' });
    }

    const targetSlot = Number(slotNumber);
    const isNewActive = req.body.isActive !== undefined ? !!req.body.isActive : true;

    // If new configuration is active, deactivate the currently active configuration for this slot
    if (isNewActive) {
      await Slot.updateMany(
        { slotNumber: targetSlot, isActive: true },
        { isActive: false }
      );
    }

    const slot = await Slot.create({
      slotNumber: targetSlot,
      price: Number(price),
      description: description || '',
      isActive: isNewActive
    });

    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all configured slots
 * @route   GET /gehnaDekho/slots
 * @access  Public
 */
const getSlots = async (req, res) => {
  try {
    const slots = await Slot.find({}).sort({ slotNumber: 1 });
    res.status(200).json(slots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get configured slot by ID
 * @route   GET /gehnaDekho/slots/:id
 * @access  Public
 */
const getSlotById = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    res.status(200).json(slot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update slot configuration
 * @route   PUT /gehnaDekho/slots/:id
 * @access  Private (Admin Only)
 */
const updateSlot = async (req, res) => {
  try {
    const { price, description, isActive } = req.body;
    const slot = await Slot.findById(req.params.id);

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    if (price !== undefined) slot.price = price;
    if (description !== undefined) slot.description = description;
    if (isActive !== undefined) slot.isActive = isActive;

    const updatedSlot = await slot.save();
    res.status(200).json(updatedSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a slot configuration
 * @route   DELETE /gehnaDekho/slots/:id
 * @access  Private (Admin Only)
 */
const deleteSlot = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    await Slot.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get available slots for today (not yet booked/featured)
 * @route   GET /gehnaDekho/slots/available/today
 * @access  Private (Admin & Outlet Owner)
 */
const getAvailableSlotsForToday = async (req, res) => {
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

    // 2. Find all histories booked for today in IST date bounds
    const bookedHistories = await FeaturedJewelleryHistory.find({
      date: {
        $gte: startOfISTDay,
        $lte: endOfISTDay
      }
    });

    const bookedSlotIds = bookedHistories.map(history => history.slot.toString());

    // 3. Find all active slots not present in bookedSlotIds
    const availableSlots = await Slot.find({
      _id: { $nin: bookedSlotIds },
      isActive: true
    }).sort({ slotNumber: 1 });

    res.status(200).json({
      success: true,
      timezone: 'Asia/Kolkata (IST)',
      dateBounds: {
        start: startOfISTDay.toISOString(),
        end: endOfISTDay.toISOString()
      },
      count: availableSlots.length,
      data: availableSlots
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createSlot,
  getSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
  getAvailableSlotsForToday
};
