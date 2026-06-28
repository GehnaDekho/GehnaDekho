const VoucherConfig = require('../models/VoucherConfig');

/**
 * @desc    Create a new voucher points configuration (Admin Only)
 * @route   POST /gehnaDekho/voucher-configs
 * @access  Private (Admin Only)
 */
const createVoucherConfig = async (req, res) => {
  try {
    const { actionName, pointsAwarded, description } = req.body;

    if (!actionName || pointsAwarded === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide actionName and pointsAwarded',
      });
    }

    const targetAction = actionName;
    const isNewActive = req.body.isActive !== undefined ? !!req.body.isActive : true;

    // If new configuration is active, deactivate the currently active configuration for this action
    if (isNewActive) {
      await VoucherConfig.updateMany(
        { actionName: targetAction, isActive: true },
        { isActive: false }
      );
    }

    const config = await VoucherConfig.create({
      actionName: targetAction,
      pointsAwarded: Number(pointsAwarded),
      description,
      isActive: isNewActive,
    });

    res.status(201).json({
      success: true,
      message: 'Voucher configuration created successfully',
      data: config,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all configured voucher points actions
 * @route   GET /gehnaDekho/voucher-configs
 * @access  Private (Authenticated users)
 */
const getVoucherConfigs = async (req, res) => {
  try {
    const configs = await VoucherConfig.find().sort({ actionName: 1 });
    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update a voucher points configuration (Admin Only)
 * @route   PUT /gehnaDekho/voucher-configs/:id
 * @access  Private (Admin Only)
 */
const updateVoucherConfig = async (req, res) => {
  try {
    const { pointsAwarded, description, isActive } = req.body;

    const config = await VoucherConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Voucher config not found' });
    }

    if (pointsAwarded !== undefined) config.pointsAwarded = pointsAwarded;
    if (description !== undefined) config.description = description;
    if (isActive !== undefined) config.isActive = isActive;

    await config.save();

    res.status(200).json({
      success: true,
      message: 'Voucher configuration updated successfully',
      data: config,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a voucher points configuration (Admin Only)
 * @route   DELETE /gehnaDekho/voucher-configs/:id
 * @access  Private (Admin Only)
 */
const deleteVoucherConfig = async (req, res) => {
  try {
    const config = await VoucherConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Voucher config not found' });
    }

    await config.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Voucher configuration deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createVoucherConfig,
  getVoucherConfigs,
  updateVoucherConfig,
  deleteVoucherConfig,
};
