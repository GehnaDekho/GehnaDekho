const Category = require('../models/Category');

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Private (Admin Only)
 */
const createCategory = async (req, res) => {
  try {
    const { name, image, description } = req.body;

    if (!name || !image) {
      return res.status(400).json({ message: 'Please provide both name and image for the category' });
    }

    const categoryExists = await Category.findOne({ name: name.trim() });
    if (categoryExists) {
      return res.status(400).json({ message: 'A category with this name already exists' });
    }

    const category = await Category.create({
      name: name.trim(),
      image,
      description: description || ''
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public
 */
const getCategories = async (req, res) => {
  try {
    const query = {};

    // Support simple search inside categories if query param is passed
    if (req.query.search) {
      query.name = new RegExp(req.query.search, 'i');
    }

    // Usually category lists are simple, but let's implement pagination optionally
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100; // default large limit to return all
    const skip = (page - 1) * limit;

    const total = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      categories,
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
 * @desc    Get a single category by ID
 * @route   GET /api/categories/:id
 * @access  Public
 */
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Update an existing category
 * @route   PUT /api/categories/:id
 * @access  Private (Admin Only)
 */
const updateCategory = async (req, res) => {
  try {
    const { name, image, description } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (name) {
      const nameTrimmed = name.trim();
      if (nameTrimmed !== category.name) {
        const categoryExists = await Category.findOne({ name: nameTrimmed });
        if (categoryExists) {
          return res.status(400).json({ message: 'A category with this name already exists' });
        }
        category.name = nameTrimmed;
      }
    }

    if (image !== undefined) category.image = image;
    if (description !== undefined) category.description = description;

    const updatedCategory = await category.save();
    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a category
 * @route   DELETE /api/categories/:id
 * @access  Private (Admin Only)
 */
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Optional check: we could prevent deletion if jewellery uses it, but we can do a cascade or simple delete
    await Category.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
};
