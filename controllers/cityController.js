const City = require('../models/City');

/**
 * @desc    Get all cities (no pagination)
 * @route   GET /gehnaDekho/cities
 * @access  Public or Admin (assuming public or authenticated needs to fetch cities)
 */
const getCities = async (req, res) => {
  try {
    const query = {};

    // Filter by isActive if provided in query params
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const cities = await City.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create a new city
 * @route   POST /gehnaDekho/cities
 * @access  Private (Admin Only)
 */
const createCity = async (req, res) => {
  try {
    const { name, state, isActive } = req.body;

    if (!name || !state) {
      return res.status(400).json({ success: false, message: 'Please provide both city name and state' });
    }

    const newCity = await City.create({
      name,
      state,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      data: newCity
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'City with this name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update a city
 * @route   PUT /gehnaDekho/cities/:id
 * @access  Private (Admin Only)
 */
const updateCity = async (req, res) => {
  try {
    const { name, state, isActive } = req.body;
    
    let city = await City.findById(req.params.id);
    if (!city) {
      return res.status(404).json({ success: false, message: 'City not found' });
    }

    city = await City.findByIdAndUpdate(
      req.params.id,
      { name, state, isActive },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: city
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'City with this name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a city
 * @route   DELETE /gehnaDekho/cities/:id
 * @access  Private (Admin Only)
 */
const deleteCity = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) {
      return res.status(404).json({ success: false, message: 'City not found' });
    }

    await city.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCities,
  createCity,
  updateCity,
  deleteCity
};
