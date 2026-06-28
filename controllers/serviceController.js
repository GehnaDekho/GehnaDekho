const Service = require('../models/Service');

/**
 * @desc    Create a new support service configuration (Admin Only)
 * @route   POST /gehnaDekho/services
 * @access  Private (Admin Only)
 */
const createService = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide service name'
      });
    }

    // Check for duplicate service name
    const serviceExists = await Service.findOne({ name: name.trim() });
    if (serviceExists) {
      return res.status(400).json({
        success: false,
        message: `Service '${name}' already exists. Duplicate service configurations are not allowed.`
      });
    }

    const service = await Service.create({
      name: name.trim(),
      description: description || '',
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Support service created successfully',
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all configured support services
 * @route   GET /gehnaDekho/services
 * @access  Private (Admin & Outlet Owner)
 */
const getServices = async (req, res) => {
  try {
    const query = {};
    
    // Non-admin can only see active services
    if (req.user.role !== 'admin') {
      query.isActive = true;
    } else if (req.query.isActive) {
      query.isActive = req.query.isActive === 'true';
    }

    const services = await Service.find(query).sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single support service by ID
 * @route   GET /gehnaDekho/services/:id
 * @access  Private (Admin & Outlet Owner)
 */
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update support service configuration (Admin Only)
 * @route   PUT /gehnaDekho/services/:id
 * @access  Private (Admin Only)
 */
const updateService = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (name) {
      // Validate unique name
      const nameExists = await Service.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: `Service name '${name}' is already used by another configuration`
        });
      }
      service.name = name.trim();
    }

    if (description !== undefined) service.description = description;
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();

    res.status(200).json({
      success: true,
      message: 'Support service updated successfully',
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a support service configuration (Admin Only)
 * @route   DELETE /gehnaDekho/services/:id
 * @access  Private (Admin Only)
 */
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await service.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Support service configuration deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService
};
