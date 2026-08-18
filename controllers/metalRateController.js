const MetalRate = require('../models/MetalRate');

/**
 * @desc    Get all metal rates
 * @route   GET /api/metal-rates
 * @access  Public
 */
const getMetalRates = async (req, res) => {
  try {
    const query = {};
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const rates = await MetalRate.find(query).sort({ metalType: 1 });
    res.status(200).json({ data: rates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Create a metal rate
 * @route   POST /api/metal-rates
 * @access  Private (Admin)
 */
const createMetalRate = async (req, res) => {
  try {
    const { metalType, label, price, change, up, isActive } = req.body;

    if (!metalType || !label || !price) {
      return res.status(400).json({ message: 'Please provide metalType, label, and price' });
    }

    const existingRate = await MetalRate.findOne({ metalType: metalType.trim() });
    if (existingRate) {
      return res.status(400).json({ message: 'A rate for this metalType already exists' });
    }

    const rate = await MetalRate.create({
      metalType: metalType.trim(),
      label,
      price,
      change: change || '',
      up: up !== undefined ? up : true,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user._id : undefined
    });

    res.status(201).json(rate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update a metal rate
 * @route   PUT /api/metal-rates/:id
 * @access  Private (Admin)
 */
const updateMetalRate = async (req, res) => {
  try {
    const { metalType, label, price, change, up, isActive } = req.body;
    let rate = await MetalRate.findById(req.params.id);

    if (!rate) {
      return res.status(404).json({ message: 'Metal rate not found' });
    }

    if (metalType) {
      const typeTrimmed = metalType.trim();
      if (typeTrimmed !== rate.metalType) {
        const existingRate = await MetalRate.findOne({ metalType: typeTrimmed });
        if (existingRate) {
          return res.status(400).json({ message: 'A rate for this metalType already exists' });
        }
        rate.metalType = typeTrimmed;
      }
    }

    if (label !== undefined) rate.label = label;
    if (price !== undefined) rate.price = price;
    if (change !== undefined) rate.change = change;
    if (up !== undefined) rate.up = up;
    if (isActive !== undefined) rate.isActive = isActive;
    
    if (req.user) rate.updatedBy = req.user._id;

    const updatedRate = await rate.save();
    res.status(200).json(updatedRate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a metal rate
 * @route   DELETE /api/metal-rates/:id
 * @access  Private (Admin)
 */
const deleteMetalRate = async (req, res) => {
  try {
    const rate = await MetalRate.findById(req.params.id);
    if (!rate) {
      return res.status(404).json({ message: 'Metal rate not found' });
    }
    await MetalRate.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Metal rate deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMetalRates,
  createMetalRate,
  updateMetalRate,
  deleteMetalRate
};
