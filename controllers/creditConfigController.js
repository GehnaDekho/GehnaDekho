const CreditConfig = require('../models/CreditConfig');

/**
 * @desc    Create a credit configuration (Admin Only)
 * @route   POST /gehnaDekho/credit-configs
 * @access  Private (Admin)
 */
const createCreditConfig = async (req, res) => {
  try {
    const { actionName, creditsRequired, description, isActive } = req.body;

    if (!actionName || creditsRequired === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide actionName and creditsRequired'
      });
    }

    const targetAction = actionName.trim();
    const isNewActive = isActive !== undefined ? !!isActive : true;

    // If new configuration is active, deactivate the currently active configuration for this action
    if (isNewActive) {
      await CreditConfig.updateMany(
        { actionName: targetAction, isActive: true },
        { isActive: false }
      );
    }

    const config = await CreditConfig.create({
      actionName: targetAction,
      creditsRequired: Number(creditsRequired),
      description: description || '',
      isActive: isNewActive
    });

    res.status(201).json({
      success: true,
      message: 'Credit configuration created successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all credit configurations
 * @route   GET /gehnaDekho/credit-configs
 * @access  Private (Admin & Outlet Owner)
 */
const getCreditConfigs = async (req, res) => {
  try {
    const configs = await CreditConfig.find();
    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get credit configuration by action name
 * @route   GET /gehnaDekho/credit-configs/:actionName
 * @access  Private (Admin & Outlet Owner)
 */
const getCreditConfigByAction = async (req, res) => {
  try {
    const config = await CreditConfig.findOne({
      actionName: req.params.actionName
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Credit configuration for action '${req.params.actionName}' not found`
      });
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update a credit configuration (Admin Only)
 * @route   PUT /gehnaDekho/credit-configs/:id
 * @access  Private (Admin)
 */
const updateCreditConfig = async (req, res) => {
  try {
    const { creditsRequired, description, isActive } = req.body;

    let config = await CreditConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Credit configuration not found'
      });
    }

    if (creditsRequired !== undefined) {
      if (Number(creditsRequired) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Credits required cannot be negative'
        });
      }
      config.creditsRequired = Number(creditsRequired);
    }

    if (description !== undefined) {
      config.description = description;
    }

    if (isActive !== undefined) {
      config.isActive = isActive;
    }

    await config.save();

    res.status(200).json({
      success: true,
      message: 'Credit configuration updated successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a credit configuration (Admin Only)
 * @route   DELETE /gehnaDekho/credit-configs/:id
 * @access  Private (Admin)
 */
const deleteCreditConfig = async (req, res) => {
  try {
    const config = await CreditConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Credit configuration not found'
      });
    }

    await config.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Credit configuration deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createCreditConfig,
  getCreditConfigs,
  getCreditConfigByAction,
  updateCreditConfig,
  deleteCreditConfig
};
