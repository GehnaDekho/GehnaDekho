const Brand = require('../models/Brand');

/**
 * @desc    Get all active brands
 * @route   GET /api/brands
 * @access  Public
 */
const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true }).select('-sections').sort({ name: 1 });
    res.status(200).json({ success: true, count: brands.length, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get brands for the home screen
 * @route   GET /api/brands/home
 * @access  Public
 */
const getHomeBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true, showOnHomeScreen: true })
      .select('name logo tagline establishedYear')
      .sort({ name: 1 });
    res.status(200).json({ success: true, count: brands.length, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single brand by ID (including all sections)
 * @route   GET /api/brands/:id
 * @access  Public
 */
const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    if (!brand.isActive) {
      return res.status(404).json({ success: false, message: 'Brand is currently inactive' });
    }

    // Sort sections by order
    if (brand.sections && brand.sections.length > 0) {
      brand.sections.sort((a, b) => a.order - b.order);
    }

    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create a new brand
 * @route   POST /api/brands
 * @access  Private (Admin)
 */
const createBrand = async (req, res) => {
  try {
    const brand = await Brand.create(req.body);
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    // Check for duplicate name
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Brand name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update a brand
 * @route   PUT /api/brands/:id
 * @access  Private (Admin)
 */
const updateBrand = async (req, res) => {
  try {
    let brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    brand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    // Check for duplicate name
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Brand name already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a brand
 * @route   DELETE /api/brands/:id
 * @access  Private (Admin)
 */
const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    await brand.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBrands,
  getHomeBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand
};
