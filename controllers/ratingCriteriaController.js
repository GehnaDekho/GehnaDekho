const RatingCriteria = require('../models/RatingCriteria');

/**
 * @desc    Create a new rating criteria (Admin Only)
 * @route   POST /gehnaDekho/rating-criteria
 * @access  Private (Admin Only)
 */
const createRatingCriteria = async (req, res) => {
  try {
    const { name, category, weightage, isActive } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both name and category',
      });
    }

    const targetName = name.trim();
    const isNewActive = isActive !== undefined ? !!isActive : true;

    // If new configuration is active, deactivate the currently active configuration for this criteria name
    if (isNewActive) {
      await RatingCriteria.updateMany(
        { name: targetName, isActive: true },
        { isActive: false }
      );
    }

    const criteria = await RatingCriteria.create({
      name: targetName,
      category,
      weightage: weightage !== undefined ? Number(weightage) : 1,
      isActive: isNewActive,
    });

    res.status(201).json({
      success: true,
      message: 'Rating criteria created successfully',
      data: criteria,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all rating criteria
 * @route   GET /gehnaDekho/rating-criteria
 * @access  Public
 */
const getRatingCriteria = async (req, res) => {
  try {
    const criteriaList = await RatingCriteria.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: criteriaList.length,
      data: criteriaList,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update rating criteria (Admin Only)
 * @route   PUT /gehnaDekho/rating-criteria/:id
 * @access  Private (Admin Only)
 */
const updateRatingCriteria = async (req, res) => {
  try {
    const { name, category, weightage, isActive } = req.body;

    const criteria = await RatingCriteria.findById(req.params.id);
    if (!criteria) {
      return res.status(404).json({ success: false, message: 'Rating criteria not found' });
    }

    if (name) {
      const nameTrimmed = name.trim();
      if (nameTrimmed !== criteria.name) {
        const existing = await RatingCriteria.findOne({ name: nameTrimmed });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `Rating criteria with name '${nameTrimmed}' already exists.`,
          });
        }
        criteria.name = nameTrimmed;
      }
    }

    if (category !== undefined) criteria.category = category;
    if (weightage !== undefined) criteria.weightage = Number(weightage);
    if (isActive !== undefined) criteria.isActive = isActive;

    await criteria.save();

    res.status(200).json({
      success: true,
      message: 'Rating criteria updated successfully',
      data: criteria,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a rating criteria (Admin Only)
 * @route   DELETE /gehnaDekho/rating-criteria/:id
 * @access  Private (Admin Only)
 */
const deleteRatingCriteria = async (req, res) => {
  try {
    const criteria = await RatingCriteria.findById(req.params.id);
    if (!criteria) {
      return res.status(404).json({ success: false, message: 'Rating criteria not found' });
    }

    await criteria.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Rating criteria deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createRatingCriteria,
  getRatingCriteria,
  updateRatingCriteria,
  deleteRatingCriteria,
};
