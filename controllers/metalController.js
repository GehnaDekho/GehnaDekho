const Metal = require('../models/Metal');

/**
 * @desc    Create a new metal
 * @route   POST /api/metals
 * @access  Private (Admin Only)
 */
const createMetal = async (req, res) => {
  try {
    const { metalName, image, description, isActive } = req.body;

    if (!metalName || !image) {
      return res.status(400).json({ message: 'Please provide both metal name and image' });
    }

    const metalExists = await Metal.findOne({ metalName: metalName.trim() });
    if (metalExists) {
      return res.status(400).json({ message: 'A metal with this name already exists' });
    }

    const metal = await Metal.create({
      metalName: metalName.trim(),
      image,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user._id : undefined
    });

    res.status(201).json(metal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all metals
 * @route   GET /api/metals
 * @access  Public
 */
const getMetals = async (req, res) => {
  try {
    const query = {};

    // Support search inside metals
    if (req.query.search) {
      query.metalName = new RegExp(req.query.search, 'i');
    }

    // Filter by active status
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const total = await Metal.countDocuments(query);
    const metals = await Metal.find(query)
      .sort({ metalName: 1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      metals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get a single metal by ID
 * @route   GET /api/metals/:id
 * @access  Public
 */
const getMetalById = async (req, res) => {
  try {
    const metal = await Metal.findById(req.params.id);
    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }
    res.status(200).json(metal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update an existing metal
 * @route   PUT /api/metals/:id
 * @access  Private (Admin Only)
 */
const updateMetal = async (req, res) => {
  try {
    const { metalName, image, description, isActive } = req.body;
    const metal = await Metal.findById(req.params.id);

    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }

    if (metalName) {
      const nameTrimmed = metalName.trim();
      if (nameTrimmed !== metal.metalName) {
        const metalExists = await Metal.findOne({ metalName: nameTrimmed });
        if (metalExists) {
          return res.status(400).json({ message: 'A metal with this name already exists' });
        }
        metal.metalName = nameTrimmed;
      }
    }

    if (image !== undefined) metal.image = image;
    if (description !== undefined) metal.description = description;
    if (isActive !== undefined) metal.isActive = isActive;
    
    if (req.user) metal.updatedBy = req.user._id;

    const updatedMetal = await metal.save();
    res.status(200).json(updatedMetal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a metal
 * @route   DELETE /api/metals/:id
 * @access  Private (Admin Only)
 */
const deleteMetal = async (req, res) => {
  try {
    const metal = await Metal.findById(req.params.id);
    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }

    await Metal.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Metal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createMetal,
  getMetals,
  getMetalById,
  updateMetal,
  deleteMetal
};
